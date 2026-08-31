/**
 * `T999h`, `T999k` (EPIC-035) — a confirmed defect becomes traceable repair
 * work.
 *
 * `FR-DFR-050`, `FR-DFR-051`, `FR-DFR-052`, `SC-DFR-012`. `BR-0055` is the
 * bridge between confirming a defect and fixing it, **which is where
 * traceability is usually lost**: the defect is discussed in one place, the fix
 * happens in another, and a year later the task says *"fix the notification
 * bug"* and nothing says which one.
 *
 * ## `GenerateTasksService` is banned, and the name is why
 *
 * `R-035-2`. `backend/src/modules/tasks/generate-tasks.service.ts` is named for
 * this requirement and does something else: it takes a `SpecificationEngine`
 * and derives tasks from **specification text**, then stamps that engine's name
 * on them. Repair work derives from a defect and the test that proved it.
 * Calling it here would have produced tasks whose recorded provenance was
 * false, and the architecture test in `defect-room-independence.spec.ts` keeps
 * the import out.
 *
 * ## Where the link lives, and why it is not on the task
 *
 * `R-035-3`. `TaskRecord` has no provenance field — no defect reference, no
 * origin — and `FR-DFR-002` forbids implementing the task model here. So the
 * link is a `RepairLink` row owned by this Room, and `EPIC-012`'s rows are
 * created unmodified.
 *
 * `engineName` and `engineVersion` are **not optional** on that model, and a
 * repair task has no engine. Whatever goes in them is a claim about provenance,
 * so it is a sentinel that could not be mistaken for one — see the constants
 * below, and `T999i`, which asserts the shape so a later tidy-up cannot turn it
 * into something that reads like data.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore, RepairLinkRow } from './defect-room.store.js';

/**
 * `R-035-3` — what goes in `TaskRecord.engineName` when no engine authored the
 * task.
 *
 * Deliberately unmistakable. `'defect-room'` would be a plausible engine
 * identifier sitting in a column named `engineName`, and `BR-0058`'s own
 * analytics would later count it as one. The parentheses and the em dash are
 * load-bearing: they make the value fail any pattern that matches an
 * identifier, which is exactly what `T999i` asserts.
 *
 * This is a **handover, not a solution**. `TaskRecord` provenance for
 * non-engine-authored tasks is `BR-0151`, capability area `U-12`, and unowned.
 */
export const REPAIR_TASK_ENGINE = '(none — authored from a defect)';
export const REPAIR_TASK_ENGINE_VERSION = '(none)';

/** The `EPIC-012` row this Room asks for, before it has an id. */
export interface RepairTaskDraft {
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly description: string;
  readonly status: 'not_started';
  readonly engineName: string;
  readonly engineVersion: string;
}

export interface CreatedTask extends RepairTaskDraft {
  readonly id: string;
}

/**
 * `FR-DFR-051` — the only sanctioned way to create repair work.
 *
 * Its one permitted backing is `EPIC-012`'s `TaskStore.createMany`. The port
 * exists so this Room depends on a shape rather than on that module, and so
 * that its absence **refuses**: a repair task that cannot carry where it came
 * from is indistinguishable from ordinary work nobody can trace to the defect
 * it fixes (`DEFECT_ROOM_PORTS`).
 */
export interface RepairTaskPort {
  createMany(rows: readonly RepairTaskDraft[]): Promise<readonly CreatedTask[]>;
}

/**
 * `T999h` — the `EPIC-011` chain, through a one-method view.
 *
 * `FR-DFR-050` says the tasks are **traceable**, and a `RepairLink` row is this
 * Room's own record — readable here and nowhere else. The traceability chain is
 * what the rest of the programme reads, so the edge is written through
 * `EPIC-011`'s writer rather than being reproduced in a second link store: the
 * same move `EPIC-034` made for `FR-CHR-064`.
 *
 * `task → defect`, never the other way. A defect does not derive from the work
 * that fixed it.
 */
export interface ChainLinkPort {
  linkTaskToDefect(input: {
    workspaceId: string;
    taskId: string;
    defectId: string;
  }): Promise<unknown>;
}

export interface CreateRepairTasksInput {
  readonly workspaceId: string;
  readonly defectId: string;
  /**
   * The specification the repair work belongs to.
   *
   * Supplied by the caller, never inferred from `contestedArtifactRef`: a
   * defect can contest a requirement, and writing that id into a column named
   * `specificationId` would be the same class of lie as the engine name.
   */
  readonly specificationId: string;
  readonly requestedBy: string;
  readonly descriptions: readonly string[];
}

export interface CreateRepairTasksResult {
  readonly tasks: readonly CreatedTask[];
  readonly links: readonly RepairLinkRow[];
}

export class RepairService {
  constructor(
    private readonly store: DefectRoomStore,
    private readonly tasks?: RepairTaskPort | undefined,
    /**
     * Optional, and its absence does **not** silently skip the chain — see
     * `createRepairTasks`, which refuses rather than creating tasks the rest of
     * the programme cannot trace.
     */
    private readonly chain?: ChainLinkPort | undefined,
  ) {}

  async createRepairTasks(input: CreateRepairTasksInput): Promise<CreateRepairTasksResult> {
    if (input.descriptions.length === 0) {
      // A call that created nothing and reported success would read as "this
      // defect has been converted" in every later count.
      throw new ValidationFailedError(
        'converting a defect creates at least one repair task (FR-DFR-050)',
      );
    }
    for (const description of input.descriptions) {
      if (description.trim() === '') {
        throw new ValidationFailedError('a repair task states its description (FR-DFR-050)');
      }
    }

    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    // Absent rather than forbidden (`FR-002`).
    if (!defect) throw new NotFoundError('Not found.');

    // `FR-DFR-052`, `SC-DFR-012` — zero before classification. Work begun
    // before the judgement makes the judgement a formality: nobody unpicks a
    // task somebody has started because triage later called it a change
    // request.
    const classification = await this.store.currentClassification(
      input.workspaceId,
      input.defectId,
    );
    if (!classification) {
      throw new ValidationFailedError(
        'this defect has not been classified, and repair work must not begin before it is ' +
          '(FR-DFR-052, SC-DFR-012)',
      );
    }
    if (classification.outcome !== 'confirmed-defect') {
      throw new ValidationFailedError(
        `this defect is classified ${classification.outcome}, not a confirmed defect: the Room ` +
          'that owns that outcome decides what happens to it (FR-DFR-052)',
      );
    }

    const tests = await this.store.testsFor(input.workspaceId, input.defectId);
    const test = tests[0];
    if (!test) {
      // `FR-DFR-050` links each task to the failing behaviour **and its test**,
      // and `RepairLink.defectTestId` is NOT NULL. There is nothing to link.
      throw new ValidationFailedError(
        'no failing test is on record for this defect, so repair work would trace to nothing ' +
          '(FR-DFR-050, FR-DFR-041)',
      );
    }

    if (!this.tasks) {
      // Refuse, never degrade. Creating the tasks and skipping the link would
      // produce exactly the untraceable repair work `BR-0055` is about.
      throw new ValidationFailedError(
        'no repair task port is bound (EPIC-012 supplies it through TaskStore.createMany), so ' +
          'these tasks could not record the defect they come from',
      );
    }

    if (!this.chain) {
      // Checked BEFORE anything is created. A chain writer discovered missing
      // afterwards would leave tasks in `EPIC-012` that nothing outside this
      // Room can trace — the failure `FR-DFR-050` names, arrived at by being
      // half-finished rather than by being wrong.
      throw new ValidationFailedError(
        'no traceability link writer is bound (EPIC-011 supplies it), so repair work could not ' +
          'be traced back to the defect it fixes (FR-DFR-050)',
      );
    }

    const created = await this.tasks.createMany(
      input.descriptions.map((description) => ({
        workspaceId: input.workspaceId,
        specificationId: input.specificationId,
        description: description.trim(),
        status: 'not_started' as const,
        engineName: REPAIR_TASK_ENGINE,
        engineVersion: REPAIR_TASK_ENGINE_VERSION,
      })),
    );

    const links: RepairLinkRow[] = [];
    for (const task of created) {
      // The programme-wide edge first: if it fails, no `RepairLink` claims a
      // traceability that does not exist.
      await this.chain.linkTaskToDefect({
        workspaceId: input.workspaceId,
        taskId: task.id,
        defectId: defect.id,
      });
      links.push(
        await this.store.recordRepairLink({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          defectId: defect.id,
          defectTestId: test.id,
          taskId: task.id,
          orphanedByClassificationId: null,
          createdAt: new Date(),
        }),
      );
    }

    return { tasks: created, links };
  }

  /**
   * `FR-DFR-025`, `US7` scenario 4 — the tasks that outlive the classification
   * that made them.
   *
   * Called when a defect is reclassified away from `confirmed-defect`. The
   * tasks are **marked, not deleted**: deleting them would make the record say
   * the defect was always a change request, with nothing to show that people
   * were asked to fix it; leaving them unmarked would let a backlog item for a
   * change nobody approved get worked, with every artifact looking correct.
   *
   * Only rows not already cut loose are marked. The first classification that
   * orphaned them is the honest answer — a later one overwriting it would claim
   * the tasks survived until then.
   */
  async orphanFor(
    workspaceId: string,
    defectId: string,
    classificationId: string,
  ): Promise<readonly RepairLinkRow[]> {
    return this.store.orphanRepairLinks(workspaceId, defectId, classificationId);
  }
}
