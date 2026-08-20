/**
 * T096 — every task resolves back through its specification to a requirement.
 * Written to FAIL before T100/T101 exist (Constitution V).
 *
 * FR-029 / SC-003. Generation writes the task→specification links in the same
 * act that creates the tasks (EPIC-011's link writer), so the reverse trace
 * exists the moment the task does — never as a later reconciliation.
 */
import { describe, expect, it } from 'vitest';
import { engineOk, type SpecificationEngine } from '@pmi/engine-contract';
import {
  GenerateTasksService,
  InMemoryTaskStore,
} from '../../../src/modules/tasks/generate-tasks.service.js';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
} from '../../../src/modules/traceability/link-writer.service.js';
import { TraceabilityService } from '../../../src/modules/traceability/traceability.service.js';
import { SpecificationNotApprovedError } from '../../../src/core/errors.js';

const DESCRIPTOR = {
  name: 'fixture',
  version: '0.1.0',
  capabilities: [
    'generate_specification',
    'generate_tasks',
    'validate_specification',
  ] as ('generate_specification' | 'generate_tasks' | 'validate_specification')[],
};

const CTX = { signal: new AbortController().signal, timeoutMs: 1000, correlationId: 'corr-t' };

const SPEC = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Approved spec',
  contentRaw: '# Spec\n',
  lifecycleState: 'approved' as const,
};

function engine(taskDescriptions: string[]): SpecificationEngine {
  return {
    descriptor: DESCRIPTOR,
    generateTasks: async () => engineOk(taskDescriptions.map((description) => ({ description })), DESCRIPTOR),
  } as unknown as SpecificationEngine;
}

function build(): {
  service: GenerateTasksService;
  tasks: InMemoryTaskStore;
  links: InMemoryTraceabilityLinkStore;
  trace: TraceabilityService;
} {
  const tasks = new InMemoryTaskStore();
  const links = new InMemoryTraceabilityLinkStore();
  return {
    service: new GenerateTasksService(tasks, new LinkWriterService(links)),
    tasks,
    links,
    trace: new TraceabilityService(links),
  };
}

describe('T096 · generated tasks are traceable (FR-029, SC-003)', () => {
  it('every generated task links to its specification in the same act', async () => {
    const { service, trace } = build();
    const created = await service.generate(engine(['Do A', 'Do B']), SPEC, CTX, 'u1');
    expect(created).toHaveLength(2);
    for (const task of created) {
      const reverse = await trace.reverseTrace('ws_a', task.id);
      expect(reverse.specifications.map((s) => s.specificationId)).toEqual(['s1']);
    }
  });

  it('the reverse trace reaches the ORIGINATING REQUIREMENTS through the specification', async () => {
    const { service, links, trace } = build();
    // The spec was generated from r1 — the link EPIC-008's generation wrote.
    await new LinkWriterService(links).linkSpecificationToRequirements({
      workspaceId: 'ws_a',
      specificationId: 's1',
      requirementIds: ['r1'],
    });
    const [task] = await service.generate(engine(['Do A']), SPEC, CTX, 'u1');
    const reverse = await trace.reverseTrace('ws_a', task!.id);
    expect(reverse.specifications[0]?.requirementIds).toEqual(['r1']);
  });

  it('generation is REFUSED unless the specification is approved (FR-020) — nothing stored', async () => {
    const { service, tasks } = build();
    await expect(
      service.generate(engine(['Do A']), { ...SPEC, lifecycleState: 'draft' as never }, CTX, 'u1'),
    ).rejects.toBeInstanceOf(SpecificationNotApprovedError);
    expect(await tasks.listForSpecification('ws_a', 's1')).toEqual([]);
  });

  it('an engine failure stores NO partial task list (FR-027)', async () => {
    const { service, tasks } = build();
    const failing = {
      descriptor: DESCRIPTOR,
      generateTasks: async () => ({ ok: false as const, failure: { reason: 'engine_error' as const, message: 'boom' } }),
    } as unknown as SpecificationEngine;
    const result = await service.generate(failing, SPEC, CTX, 'u1').catch((e: unknown) => e);
    expect(result).toBeInstanceOf(Error);
    expect(await tasks.listForSpecification('ws_a', 's1')).toEqual([]);
  });

  it('tasks carry the engine identity that produced them (FR-022)', async () => {
    const { service } = build();
    const [task] = await service.generate(engine(['Do A']), SPEC, CTX, 'u1');
    expect(task?.engineName).toBe('fixture');
    expect(task?.engineVersion).toBe('0.1.0');
  });
});
