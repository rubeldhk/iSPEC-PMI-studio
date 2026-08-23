/**
 * T403b, T403d — a baselined set becomes an input to specification.
 * `FR-RQR-060`, `FR-RQR-061`, `FR-RQR-062`, `BR-0027`. Unit tests: `T403a`,
 * `T403c`; architecture test: `T403e`.
 *
 * **Without this the Room produces an artifact nothing consumes.** Intake,
 * clarification, criteria, decision and baseline all end in a frozen set
 * sitting in a table; this is what closes the chain, and `SC-RQR-006` asks for
 * the chain to be traceable in both directions — hence `listForBaseline` and
 * `listForWorkflow`.
 *
 * **The VERSION is recorded, not the baseline generally** (`FR-RQR-061`). A
 * handoff pointing at *"the project's baseline"* would silently change meaning
 * every time a new one was approved: a specification written against v1 would,
 * six months later, read as derived from v4, and nobody could say which
 * requirements it was actually built from.
 *
 * **`specificationWorkflowRef` is an opaque string and must stay one**
 * (`FR-RQR-062`). Nothing here names a specification engine, and `T403e`
 * asserts it. A structured reference would grow an `engine` field, and a
 * baseline would become one engine's artifact — which `BR-0027` forbids by
 * saying a baselined set is selectable by *one or more* specification
 * workflows, plural and unnamed.
 *
 * **A superseded baseline is readable but not selectable**, and the refusal
 * names its replacement. `FR-RQR-052` keeps an approved set readable so the
 * approval stays auditable; specifying *new work* against a replaced set is a
 * different act, and letting it happen silently is how a specification comes to
 * derive from requirements nobody has agreed to since. The same line
 * `assertEditable` draws: readable is not governing.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationFailedError } from '../../core/errors.js';
import type { HandoffRow, RequirementRoomStore } from './requirement-room.store.js';

export interface SelectBaselineInput {
  readonly workspaceId: string;
  /** `(projectId, version)` is the baseline's key; a version alone is ambiguous. */
  readonly projectId: string;
  readonly baselineVersion: number;
  /**
   * Opaque, and opaque on purpose (`FR-RQR-062`). Whatever the workflow calls
   * itself — this Room does not parse it, match on it, or know what produced it.
   */
  readonly specificationWorkflowRef: string;
  readonly selectedBy: string;
}

export class HandoffService {
  constructor(private readonly store: RequirementRoomStore) {}

  /** `FR-RQR-060` — one baseline, one or more specification workflows. */
  async select(input: SelectBaselineInput): Promise<HandoffRow> {
    const missing: string[] = [];
    if (typeof input?.specificationWorkflowRef !== 'string' || !input.specificationWorkflowRef.trim()) {
      missing.push('specificationWorkflowRef');
    }
    if (typeof input?.selectedBy !== 'string' || !input.selectedBy.trim()) {
      missing.push('selectedBy');
    }
    if (missing.length > 0) {
      throw new ValidationFailedError(`a handoff requires: ${missing.join(', ')}`);
    }

    const baseline = await this.store.findBaselineByVersion(
      input.projectId,
      input.baselineVersion,
    );
    // A baseline in another workspace is indistinguishable from one that does
    // not exist (FR-002 / SC-004) — a handoff must not confirm that a set
    // exists somewhere the caller cannot see.
    if (!baseline || baseline.workspaceId !== input.workspaceId) {
      throw new ValidationFailedError(
        `there is no baseline v${input.baselineVersion} to select in this project`,
      );
    }
    if (baseline.supersededBy !== null) {
      throw new ConflictError(
        `baseline v${input.baselineVersion} was superseded by v${baseline.supersededBy}. It ` +
          'remains readable, but specifying new work against a replaced set would derive a ' +
          `specification from requirements nobody has agreed to since — select v${baseline.supersededBy}`,
      );
    }

    const ref = input.specificationWorkflowRef.trim();
    const existing = await this.store.listHandoffsForBaseline(input.workspaceId, baseline.id);
    if (existing.some((handoff) => handoff.specificationWorkflowRef === ref)) {
      throw new ConflictError(
        `baseline v${baseline.version} was already selected into "${ref}" — a second identical ` +
          'row records nothing new and leaves a reader asking which of the two mattered',
      );
    }

    return this.store.createHandoff({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      baselineId: baseline.id,
      // Both, deliberately. The version is what FR-RQR-061 names and what a
      // reader sees; the id is what survives a renumbering. Storing only the
      // id would satisfy the schema and fail the requirement.
      baselineVersion: baseline.version,
      specificationWorkflowRef: ref,
      selectedBy: input.selectedBy.trim(),
      selectedAt: new Date(),
    });
  }

  /** `SC-RQR-006` forwards: every specification derived from this set. */
  async listForBaseline(workspaceId: string, baselineId: string): Promise<HandoffRow[]> {
    return this.store.listHandoffsForBaseline(workspaceId, baselineId);
  }

  /**
   * `SC-RQR-006` backwards: which frozen set produced this specification.
   *
   * Without this the trace is one-way, and *"what was this built from"* — the
   * question the whole chain exists to answer — has no answer.
   */
  async listForWorkflow(
    workspaceId: string,
    specificationWorkflowRef: string,
  ): Promise<HandoffRow[]> {
    return this.store.listHandoffsForWorkflow(workspaceId, specificationWorkflowRef);
  }
}
