/**
 * T103 — regeneration warns before replacing existing tasks (US4 scenario 4).
 *
 * The warning is a REFUSAL to proceed without confirmation, not a note
 * attached to the damage: with existing tasks and no confirmation, nothing is
 * replaced and the response names what would be lost. A failed regeneration
 * keeps the old list intact — the engine result is validated whole before the
 * replacement happens (FR-027 applied to replacement).
 *
 * Framework-free (PC-1). Wired in `tasks.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { EngineContext, SpecificationEngine } from '@pmi/engine-contract';
import { assertTaskGenerationPermitted } from '../specifications/lifecycle.machine.js';
import type { LinkWriterService } from '../traceability/link-writer.service.js';
import type {
  GenerateTasksService,
  GenerationSourceSpec,
  TaskRecord,
  TaskStore,
} from './generate-tasks.service.js';

export interface RegenerationOutcome {
  /** True when existing tasks blocked the run pending confirmation. */
  requiresConfirmation: boolean;
  existingTaskCount: number;
  replaced: boolean;
  /** The current list — existing when refused, the new list when replaced. */
  tasks: TaskRecord[];
}

export class TaskRegenerationService {
  constructor(
    private readonly generator: GenerateTasksService,
    private readonly store: TaskStore,
    private readonly links?: LinkWriterService,
  ) {}

  async regenerate(
    engine: SpecificationEngine,
    spec: GenerationSourceSpec,
    ctx: EngineContext,
    requestedById: string,
    options: { confirmed: boolean },
  ): Promise<RegenerationOutcome> {
    assertTaskGenerationPermitted(spec.lifecycleState);
    const existing = await this.store.listForSpecification(spec.workspaceId, spec.id);

    // US4/4: the effect on existing tasks is named BEFORE anything changes.
    if (existing.length > 0 && !options.confirmed) {
      return {
        requiresConfirmation: true,
        existingTaskCount: existing.length,
        replaced: false,
        tasks: existing,
      };
    }

    if (existing.length === 0) {
      // Nothing to warn about — a first generation, through the normal path.
      const tasks = await this.generator.generate(engine, spec, ctx, requestedById);
      return { requiresConfirmation: false, existingTaskCount: 0, replaced: true, tasks };
    }

    // Confirmed replacement: run the engine FIRST, replace only on a whole,
    // ok result — a failed run must leave the old list untouched.
    const result = await engine.generateTasks(
      { projectName: spec.projectId, specificationTitle: spec.title, specificationContent: spec.contentRaw },
      ctx,
    );
    if (!result.ok) {
      throw new Error(`${result.failure.reason}: ${result.failure.message}`);
    }

    const tasks = await this.store.replaceForSpecification(
      spec.workspaceId,
      spec.id,
      result.value.map((task) => ({
        id: randomUUID(),
        workspaceId: spec.workspaceId,
        specificationId: spec.id,
        description: task.description,
        status: 'not_started' as const,
        engineName: result.producedBy.name,
        engineVersion: result.producedBy.version,
      })),
    );
    // SC-003 for the replacements too. The OLD tasks' links remain — links are
    // the audit trail of derivation and are never deleted (FR-029); a trace on
    // a replaced task id resolving to its specification is history, not error.
    await this.links?.linkTasksToSpecification({
      workspaceId: spec.workspaceId,
      specificationId: spec.id,
      taskIds: tasks.map((task) => task.id),
    });
    return {
      requiresConfirmation: false,
      existingTaskCount: existing.length,
      replaced: true,
      tasks,
    };
  }
}
