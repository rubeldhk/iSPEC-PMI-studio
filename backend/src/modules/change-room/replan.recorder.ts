/**
 * `T994k`, `T994n` (EPIC-034) — a recorder that performs no re-plan.
 *
 * `FR-CHR-062`, `FR-CHR-064`, `FR-CHR-065`, `R-034-2`.
 *
 * ## Why there is no execute path
 *
 * `FR-CHR-062` asks that downstream work be updated *"through `BR-0154`'s
 * mechanism"*. `TaskRegenerationService.regenerate()` exists, is named exactly
 * for the job, and satisfies that sentence in one call — while **replacing** a
 * task list. `BR-0154` requires revision without destroying completed-work
 * history, and `FR-CHR-065` forbids the shortcut outright.
 *
 * `EPIC-012` built regeneration as replace-with-confirmation. The confirmation
 * makes the replacement deliberate; it does not make it non-destructive. So the
 * shortcut is available, plausible, and wrong, and an implementer who takes it
 * sees a green suite.
 *
 * This module therefore **records** what must be re-planned and surfaces it. The
 * obligation sits in `recorded` where anyone can see it is outstanding, until
 * `U-12` exists to discharge it. There is no `execute`, no `apply`, no
 * `regenerate`, and `REPLAN_STATES` has no `executed` for one to produce.
 *
 * `change-room-independence.spec.ts` asserts the import ban across the module,
 * because a boundary that depends on remembering is not a boundary.
 *
 * ## Traceability uses EPIC-011, and adds no second link store
 *
 * `FR-CHR-064` wants specification, task and test changes arising from an
 * approved change traceable **to that change**. Those links go through
 * `LinkWriterService` — the one place links live. A table of this Room's own
 * would answer the same question in a second voice, and the day the two
 * disagreed nobody would know which was the trace.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import type { ChangeRoomStore } from './change-room.store.js';
import type { RePlanObligation } from './replan.types.js';

export interface RecordRePlanInput {
  readonly workspaceId: string;
  readonly changeDecisionId: string;
  readonly affectedSpecificationId: string;
  /** Prose, because `U-12` will read it. */
  readonly whatMustChange: string;
  readonly why: string;
}

/**
 * The slice of `EPIC-011`'s `LinkWriterService` this Room uses.
 *
 * Named structurally rather than imported as a class, so the recorder stays
 * framework-free and the composition root supplies the real service. It is
 * still `EPIC-011`'s writer — that is the whole point of `T994n`.
 */
export interface ChangeTraceWriterPort {
  linkArtifactToChange(input: {
    workspaceId: string;
    sourceType: 'specification' | 'task' | 'test';
    sourceId: string;
    changeRequestId: string;
  }): Promise<unknown>;
}

export class RePlanRecorder {
  constructor(
    private readonly store: ChangeRoomStore,
    private readonly links?: ChangeTraceWriterPort | undefined,
  ) {}

  /**
   * `FR-CHR-062` — record what a re-plan must address.
   *
   * Every check runs before anything is written, so a refused obligation
   * cannot leave a half-recorded one behind.
   */
  async record(input: RecordRePlanInput): Promise<RePlanObligation> {
    if (input.affectedSpecificationId.trim() === '') {
      throw new ValidationFailedError(
        'a re-plan obligation names the specification it affects (FR-CHR-062)',
      );
    }
    for (const field of ['whatMustChange', 'why'] as const) {
      if (input[field].trim() === '') {
        // An obligation with nothing in it is a reminder that something is
        // outstanding without saying what — worse than none, because it looks
        // discharged once somebody glances at it.
        throw new ValidationFailedError(`a re-plan obligation states: ${field} (FR-CHR-062)`);
      }
    }

    return this.store.recordRePlanObligation({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      changeDecisionId: input.changeDecisionId,
      affectedSpecificationId: input.affectedSpecificationId,
      whatMustChange: input.whatMustChange.trim(),
      why: input.why.trim(),
      // The only state this Epic can produce. `discharged-by-U-12` is `U-12`'s
      // to set, and there is no third.
      state: 'recorded',
    });
  }

  /**
   * `FR-CHR-064` — an artifact that changed because of this change says so.
   *
   * Written through `EPIC-011`'s link writer. Refuses when unbound rather than
   * recording the link somewhere local: a trace nobody else can traverse is not
   * a trace, and a second store for it is the failure `T994n` names.
   */
  async traceToChange(input: {
    workspaceId: string;
    changeRequestId: string;
    artifacts: readonly { type: 'specification' | 'task' | 'test'; id: string }[];
  }): Promise<number> {
    if (!this.links) {
      throw new ValidationFailedError(
        'no traceability link writer is bound (EPIC-011 supplies it), so a change cannot be ' +
          'traced to the work that arose from it (FR-CHR-064)',
      );
    }
    for (const artifact of input.artifacts) {
      if (artifact.id.trim() === '') {
        throw new ValidationFailedError('a traced artifact has an id (FR-CHR-064)');
      }
    }
    for (const artifact of input.artifacts) {
      await this.links.linkArtifactToChange({
        workspaceId: input.workspaceId,
        sourceType: artifact.type,
        sourceId: artifact.id,
        changeRequestId: input.changeRequestId,
      });
    }
    return input.artifacts.length;
  }
}
