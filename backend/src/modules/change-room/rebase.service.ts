/**
 * `T994e`, `T994i` (EPIC-034) — re-baselining, and explicit rebase.
 *
 * `BR-0047`, the phase goal calls it *"the half of change control usually
 * skipped"*: approving a change is the visible half, and moving the baseline
 * the approval referred to is the half that quietly does not happen.
 *
 * ## `FR-CHR-061` — unchanged, and naming its successor
 *
 * Those cannot both be literally true of every field; naming a successor is a
 * change. `EPIC-033` settled it: `supersede` **updates** rather than deletes,
 * and only `supersededBy` moves. `memberVersionIds` and `setHash` in particular
 * are what a baseline **is**, and editing them in place would rewrite history
 * rather than extend it.
 *
 * ## `FR-CHR-050` — the ordering
 *
 * A baseline does not move without a decision, and this service refuses rather
 * than trusting its caller. *"An authorized decision before implementation
 * affects an approved baseline"* is a sentence until something declines to
 * proceed without one.
 *
 * ## `FR-CHR-054` — and `EPIC-030`'s rule is deliberately not inherited
 *
 * `FR-GEL-015`'s first-commit-wins settles which *transition* won. It says
 * nothing about what a decision was **made against**, which is the part that
 * matters here: a change approved against v1 must not silently apply to v2,
 * because the impact view, the trade-offs and the approval all referred to v1.
 * So a change targeting a superseded baseline is **rebased as a recorded act**
 * and **re-decided where the rebase changes its impact view** (`R-034-5`).
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import { randomUUID } from 'node:crypto';
import type { ChangeRequestRow, ChangeRoomStore } from './change-room.store.js';
import { computeBaselineDelta } from './delta.service.js';
import type { ImpactView } from './impact.types.js';

/**
 * A baseline as this Room reads it.
 *
 * `EPIC-033`'s `BaselineRow`, restated structurally rather than imported: this
 * is the shape the port speaks, and a Room that imported the other Epic's row
 * type would be coupled to its storage rather than to its contract.
 */
export interface BaselineSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  /** `R-033-5` — `EPIC-007` requirement VERSION ids. Never their text. */
  readonly memberVersionIds: readonly string[];
  readonly setHash: string;
  readonly approvedBy: string;
  readonly approvedAt: Date;
  readonly rationale: string;
  readonly decisionId: string;
  readonly supersededBy: number | null;
  readonly evidenceContractRef: string | null;
}

/**
 * The write side of the baseline seam (`BASELINE_READER`'s port, extended).
 *
 * `EPIC-033` owns baselines; this Room asks it to approve a new version and to
 * mark the prior one superseded. Absent ⇒ **refuse**, like the other four: a
 * change with no target has nothing to be a change to.
 */
export interface BaselineWriterPort {
  current(workspaceId: string, projectId: string): Promise<BaselineSnapshot | null>;
  approve(input: {
    workspaceId: string;
    projectId: string;
    version: number;
    memberVersionIds: readonly string[];
    approvedBy: string;
    approvedAt: Date;
    rationale: string;
    decisionId: string;
    evidenceContractRef: string | null;
  }): Promise<BaselineSnapshot>;
  /** Updates. Never deletes — `FR-RQR-052` keeps a superseded baseline readable. */
  supersede(id: string, byVersion: number): Promise<BaselineSnapshot>;
}

export interface RebaselineInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly changeRequestId: string;
  /**
   * `SC-CHR-009` — the baseline version the decision was actually taken
   * against.
   *
   * Required, and compared against what is current. Without it this method
   * would supersede whatever happened to be current, which is the silent
   * retarget the whole requirement exists to forbid.
   */
  readonly decidedAgainstVersion: number;
  /** Resolved by the caller through `EPIC-007`, as `assertEditable` requires. */
  readonly memberVersionIds: readonly string[];
  readonly approvedBy: string;
  readonly rationale: string;
  readonly evidenceContractRef: string | null;
  readonly now: Date;
  /**
   * `EPIC-007`'s join, for the delta's version-changed category (`R-034-4`).
   *
   * Required rather than optional: an optional join would produce a delta that
   * silently reported one requirement moving forward as a deletion plus an
   * unrelated arrival, and nothing on the screen would say the join was
   * missing.
   */
  requirementOf(versionId: string): string | null;
}

export interface RebaselineResult {
  readonly baseline: BaselineSnapshot;
  readonly supersededVersion: number;
  /** `FR-CHR-063` — readable as a delta, not only as two full versions. */
  readonly deltaId: string;
}

/** `FR-CHR-013`, `FR-CHR-054` — a rebase, recorded rather than inferred. */
export interface RebaseAssessment {
  /** The baseline the decision was taken against. */
  readonly decidedAgainstVersion: number;
  readonly currentVersion: number;
  readonly rebaseRequired: boolean;
  /**
   * `R-034-5` — true when the recomputed impact view differs from the retained
   * one. **Not** a judgement about severity: any difference means the decision
   * referred to something that has moved.
   */
  readonly reDecisionRequired: boolean;
  readonly because: string;
}

export class RebaselineService {
  constructor(
    private readonly store: ChangeRoomStore,
    private readonly baselines?: BaselineWriterPort | undefined,
  ) {}

  async rebaseline(input: RebaselineInput): Promise<RebaselineResult> {
    if (input.memberVersionIds.length === 0) {
      // A baseline with no members is not a baseline; it is a deletion wearing
      // one's clothes.
      throw new ValidationFailedError(
        'a baseline has at least one member version (FR-CHR-060)',
      );
    }

    // `FR-CHR-050`, checked before anything is written.
    const decision = await this.decisionFor(input.workspaceId, input.changeRequestId);
    if (!decision) {
      throw new ValidationFailedError(
        `no decision has been recorded for ${input.changeRequestId}, and a baseline does not ` +
          'move without one (FR-CHR-050)',
      );
    }

    if (!this.baselines) {
      throw new ValidationFailedError(
        'no baseline writer is bound (EPIC-033 supplies it), so there is nothing to re-baseline',
      );
    }

    const current = await this.baselines.current(input.workspaceId, input.projectId);
    if (!current) {
      // Re-baselining supersedes something. `EPIC-033`'s approve path is where
      // a first baseline comes from.
      throw new ValidationFailedError(
        `no current baseline for project ${input.projectId} to supersede (FR-CHR-061)`,
      );
    }

    if (current.version !== input.decidedAgainstVersion) {
      // `SC-CHR-009`, `FR-CHR-054`. THE failure this guard exists to prevent:
      // applying to whatever is current would ship an approval whose impact
      // view, trade-offs and authority all referred to a baseline no longer in
      // force — and nothing would error.
      throw new ValidationFailedError(
        `this change was decided against v${input.decidedAgainstVersion} and the current ` +
          `baseline is v${current.version}; it must be explicitly rebased first, and ` +
          're-decided if the rebase changes its impact view (FR-CHR-054)',
      );
    }

    const next = await this.baselines.approve({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      version: current.version + 1,
      memberVersionIds: input.memberVersionIds,
      approvedBy: input.approvedBy,
      approvedAt: input.now,
      rationale: input.rationale,
      // The decision that authorised this, not a new one: the approval and the
      // baseline it produced must be the same act.
      decisionId: decision.decisionId,
      evidenceContractRef: input.evidenceContractRef,
    });

    // Only after the successor exists. A prior baseline naming a version that
    // was never created would point at nothing.
    await this.baselines.supersede(current.id, next.version);

    // `FR-CHR-063`. Computed here, while both member sets are in hand, and
    // stored: by the time anyone reads it both baselines may be superseded, and
    // a delta recomputed from whatever is current would describe a move that
    // never happened.
    const delta = computeBaselineDelta({
      fromBaselineVersion: current.version,
      toBaselineVersion: next.version,
      from: current.memberVersionIds,
      to: next.memberVersionIds,
      requirementOf: input.requirementOf,
    });
    const stored = await this.store.saveDelta({
      ...delta,
      id: randomUUID(),
      workspaceId: input.workspaceId,
      changeDecisionId: decision.id,
    });

    return { baseline: next, supersededVersion: current.version, deltaId: stored.id };
  }

  /**
   * `FR-CHR-013` — move the change onto the newer baseline, as a recorded act.
   *
   * The record is the point. A rebase that left no trace would be
   * indistinguishable from a change that had targeted the new baseline all
   * along, and the question *"what was this decided against?"* would have no
   * answer.
   */
  async recordRebase(input: {
    workspaceId: string;
    changeRequestId: string;
    toBaselineId: string;
    toBaselineVersion: number;
  }): Promise<ChangeRequestRow> {
    const request = await this.store.findById(input.workspaceId, input.changeRequestId);
    if (!request) throw new ValidationFailedError('Not found.');
    if (input.toBaselineVersion <= request.targetBaselineVersion) {
      throw new ValidationFailedError(
        `a rebase moves forward: this change already targets ` +
          `v${request.targetBaselineVersion} (FR-CHR-013)`,
      );
    }
    return this.store.setRebaseTarget(input.workspaceId, input.changeRequestId, {
      toBaselineId: input.toBaselineId,
      toBaselineVersion: input.toBaselineVersion,
      // Where it came from, so the trail runs backwards from wherever it ended.
      rebasedFrom: request.targetBaselineVersion,
    });
  }

  /**
   * `FR-CHR-013`, `FR-CHR-054`, `R-034-5` — does this change need rebasing, and
   * does it need deciding again?
   *
   * The second question is answered by **comparing two stored snapshots**: the
   * impact view the decision was taken against, and one recomputed against the
   * baseline now current. `FR-CHR-035` exists so this is a comparison rather
   * than a human's recollection of whether anything material moved.
   *
   * Any difference counts. Grading which differences are "material" would put
   * this Room in the business of deciding which changed impacts a person may be
   * spared — which is the decision it exists to put in front of them.
   */
  async assessRebase(input: {
    workspaceId: string;
    changeRequestId: string;
    decidedAgainstVersion: number;
    currentVersion: number;
    recomputed: ImpactView;
  }): Promise<RebaseAssessment> {
    const decision = await this.decisionFor(input.workspaceId, input.changeRequestId);
    if (!decision) {
      throw new ValidationFailedError(
        `no decision has been recorded for ${input.changeRequestId} to rebase (FR-CHR-054)`,
      );
    }

    const rebaseRequired = input.currentVersion !== input.decidedAgainstVersion;
    if (!rebaseRequired) {
      return {
        decidedAgainstVersion: input.decidedAgainstVersion,
        currentVersion: input.currentVersion,
        rebaseRequired: false,
        reDecisionRequired: false,
        because: 'the baseline the decision was taken against is still current',
      };
    }

    const retained = await this.store.findImpactView(input.workspaceId, decision.impactViewId);
    if (!retained) {
      // The snapshot is gone, so the comparison cannot be made. Requiring a
      // re-decision is the only honest answer: reporting "nothing changed"
      // would be a claim about a view nobody can read.
      return {
        decidedAgainstVersion: input.decidedAgainstVersion,
        currentVersion: input.currentVersion,
        rebaseRequired: true,
        reDecisionRequired: true,
        because:
          `the impact view the decision was taken against (${decision.impactViewId}) cannot be ` +
          'read, so whether the impact changed cannot be established',
      };
    }

    const changed = impactDiffers(retained, input.recomputed);
    return {
      decidedAgainstVersion: input.decidedAgainstVersion,
      currentVersion: input.currentVersion,
      rebaseRequired: true,
      reDecisionRequired: changed.length > 0,
      because:
        changed.length === 0
          ? `the baseline moved from v${input.decidedAgainstVersion} to v${input.currentVersion} ` +
            'and the impact view is unchanged, so the rebase is recorded and the decision stands'
          : `the baseline moved from v${input.decidedAgainstVersion} to v${input.currentVersion} ` +
            `and the impact view changed in: ${changed.join(', ')}`,
    };
  }

  private async decisionFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<{ id: string; decisionId: string; impactViewId: string } | null> {
    const all = await this.store.listDecisionsFor(workspaceId, changeRequestId);
    return all.length === 0 ? null : all[all.length - 1]!;
  }
}

/**
 * Which areas differ between two impact views.
 *
 * Compared per area on **state and count**, not on `detail`: two runs of the
 * same traversal can word themselves differently without anything having moved,
 * and a re-decision triggered by rephrasing would train people to click through
 * them. The architecture panel is compared on its decision set for the same
 * reason.
 */
function impactDiffers(before: ImpactView, after: ImpactView): string[] {
  const changed: string[] = [];
  for (const area of Object.keys(before.areas) as (keyof ImpactView['areas'])[]) {
    const a = before.areas[area];
    const b = after.areas[area];
    if (!b || a.state !== b.state || a.itemCount !== b.itemCount) changed.push(String(area));
  }
  const decisionsOf = (view: ImpactView): string =>
    view.architecture.decisions === null
      ? 'unknown'
      : [...view.architecture.decisions.map((d) => d.reference)].sort().join('|');
  if (decisionsOf(before) !== decisionsOf(after)) changed.push('architecture-decisions');
  return changed;
}
