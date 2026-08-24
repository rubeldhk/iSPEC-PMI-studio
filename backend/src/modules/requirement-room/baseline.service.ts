/**
 * T338f — the baseline: the entity this Epic exists to add. `FR-RQR-050`,
 * `BR-0026`, `R-033-5`. Unit test: `T338e`.
 *
 * `EPIC-007` versions **a requirement**. Nothing in this repository represented
 * **a set of requirements approved together** — that absence is `BR-0026`, and
 * this file is the whole of this Epic's addition to the data model.
 *
 * **A baseline is ids and a hash.** `memberVersionIds` are `EPIC-007`
 * requirement version ids; `setHash` is `requirementSetHash` over those ids and
 * their content hashes. No requirement text is copied here, ever — a copy would
 * be a second place the same sentence can be edited, and `FR-RQR-052`'s
 * *"a superseded baseline remains readable"* would start meaning "remains
 * readable, and may disagree with the register".
 *
 * **Append-only, and the port enforces it.** `RequirementRoomStore` offers no
 * update and no delete for a baseline; the only mutation is `supersede`, which
 * is exactly what the `baselines_supersede_only` trigger permits. So
 * `FR-RQR-050`'s immutability holds by construction at both layers rather than
 * by a guard somebody can be talked out of.
 *
 * **What lands here later**: `T338h` adds the in-place-edit refusal, `T338k`
 * the gated `approve` — Evidence Contract satisfaction (`FR-RQR-053`), overlap
 * conflict detection (`FR-RQR-054`) and supersession (`FR-RQR-052`). `create`
 * is the record; `approve` is the governed path to one.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { requirementSetHash, type BaselineMember } from '../requirements/requirement-hash.js';
import type { EditableRequirement } from '../requirements/edit-authority.js';
import type {
  BaselineExceptionRow,
  BaselineRow,
  RequirementRoomStore,
} from './requirement-room.store.js';

export interface CreateBaselineInput {
  readonly workspaceId: string;
  readonly projectId: string;
  /** The frozen set. Ids from `EPIC-007`, hashes from `EPIC-007`. */
  readonly members: readonly BaselineMember[];
  readonly approvedBy: string;
  /** `BR-0025` — required. A baseline nobody explained cannot be reviewed. */
  readonly rationale: string;
  /** → the `RequirementDecision` that approved it. */
  readonly decisionId: string;
  /** → `EPIC-032`. Set by `approve` (`T338k`); null on a bare record. */
  readonly evidenceContractRef?: string | null;
}

const REQUIRED = ['workspaceId', 'projectId', 'approvedBy', 'decisionId', 'rationale'] as const;

/**
 * T338k — `EPIC-032`'s seam. `FR-RQR-053`, `BR-0142`, `BR-0144`.
 *
 * The Room asks whether the Contract is satisfied; it does not know what an
 * evidence item is, what kinds exist, or how one is verified. `FR-RQR-003` and
 * the `room-contract-independence` test both keep it that way.
 */
export interface EvidenceContractSource {
  isSatisfied(
    evidenceContractRef: string,
    ctx: { workspaceId: string; projectId: string },
  ): Promise<{ readonly satisfied: boolean; readonly unmet: readonly string[] }>;
}

/**
 * `ROOM_PORTS` declares `refuse` for `EvidenceContractSource`, and this is that
 * refusal. Not a `PlatformError`, for the reason `RegisterUnavailableError`
 * records: the platform's status table documents no code meaning *"a governance
 * seam is unbound"*, and `DEF-008-001` is what happens when an Epic that does
 * not own `platform-api.md` invents one.
 */
export class EvidenceSourceUnavailableError extends Error {
  constructor() {
    super(
      'the EvidenceContractSource seam is unbound — EPIC-032 supplies it, and FR-RQR-053 will ' +
        'not approve a baseline on an unevaluated Contract',
    );
    this.name = 'EvidenceSourceUnavailableError';
  }
}

/**
 * A frozen member, plus which Room candidate it came from.
 *
 * `candidateId` is a **fact the caller knows**, not a judgement it makes: the
 * criteria gate (`T339b`) resolves the candidate itself and reads criteria from
 * this Room's own rows. An approval carrying its own answer to *"does this have
 * acceptance criteria"* would let a caller assert its way past `SC-RQR-003`.
 * Absent ⇒ the gate cannot check, and refuses (`criteria-unverifiable`).
 */
export interface ApprovalMember extends BaselineMember {
  readonly candidateId?: string;
}

/** `FR-RQR-032` — what a waiver must carry. Both fields, always. */
export interface BaselineExceptionInput {
  readonly requirementVersionId: string;
  /** Currently the only waivable precondition (data-model §6). */
  readonly condition: 'missing-acceptance-criteria';
  readonly authorizedBy: string;
  readonly reason: string;
}

export interface ApproveBaselineInput extends CreateBaselineInput {
  readonly members: readonly ApprovalMember[];
  /** `EPIC-032`. Required for an approval — `FR-RQR-053`. */
  readonly evidenceContractRef: string;
  /** The baseline version this replaces. Explicit, never inferred — `T338i`. */
  readonly supersedes?: number;
  /** `FR-RQR-032` — recorded waivers of the criteria precondition. */
  readonly exceptions?: readonly BaselineExceptionInput[];
}

export type BaselineRefusalReason =
  | 'acceptance-criteria-missing'
  | 'criteria-unverifiable'
  | 'evidence-contract-unsatisfied'
  | 'overlapping-scope-conflict'
  | 'supersedes-unknown-baseline'
  | 'supersedes-superseded-baseline';

/**
 * The outcome of a governed approval.
 *
 * **A value, not an exception**, following `EPIC-030`'s `TransitionResult`
 * precedent — the same shape, for the same reason. A governed refusal is a
 * thing that happened and should be recordable and reportable; an exception is
 * something a caller's `catch` can swallow, and a refused approval that nobody
 * can see is how *"declaring completion is not the evidence"* (`BR-0144`) stops
 * being true in practice.
 *
 * `InPlaceEditRefusedError` is deliberately the other shape: contract §5 names
 * a `409` for it because it answers a *caller's* request to edit, not a
 * governance evaluation of an approval.
 */
export type BaselineApproval =
  | { readonly outcome: 'approved'; readonly baseline: BaselineRow }
  | {
      readonly outcome: 'refused';
      readonly reason: BaselineRefusalReason;
      /** What a user has to read to act on it. Never just the reason code. */
      readonly detail: string;
    };

export class BaselineService {
  constructor(
    private readonly store: RequirementRoomStore,
    /** Absent ⇒ refuse. Not defaulted — see `EvidenceSourceUnavailableError`. */
    private readonly evidence?: EvidenceContractSource | undefined,
  ) {}

  /**
   * T338k — the governed path to a baseline. `FR-RQR-053`, `FR-RQR-054`,
   * `FR-RQR-052`. Unit tests: `T338i`, `T338j`.
   *
   * Order matters and is not arbitrary:
   *
   *   1. **shape** — a malformed request is the caller's to fix and costs
   *      nothing to check;
   *   2. **supersession target** — refused before the Contract is consulted,
   *      because evaluating evidence for an approval that cannot land is work
   *      nobody asked for;
   *   3. **overlap** — `FR-RQR-054`, a conflict and never a merge;
   *   4. **the Evidence Contract** — `FR-RQR-053`. Last of the checks, first of
   *      the reasons anyone will argue with;
   *   5. **write, then supersede.** The replacement exists before anything
   *      points at it, so a failure between the two leaves a current baseline
   *      that was replaced by nothing — recoverable — rather than a
   *      `supersededBy` naming a version that does not exist.
   *
   * Nothing takes a version number until every check has passed: a refused
   * approval that consumed one leaves a gap in the history and the question of
   * what happened to it.
   */
  async approve(input: ApproveBaselineInput): Promise<BaselineApproval> {
    assertComplete(input);
    assertRealSet(input.members);
    if (!input.evidenceContractRef?.trim()) {
      throw new ValidationFailedError('an approval requires: evidenceContractRef');
    }
    assertExceptionsAreExplicit(input.exceptions ?? []);
    const evidence = this.evidence;
    if (!evidence) throw new EvidenceSourceUnavailableError();

    const current = (await this.store.listBaselines(input.workspaceId, input.projectId)).filter(
      (baseline) => baseline.supersededBy === null,
    );

    const superseded = input.supersedes;
    if (superseded !== undefined) {
      const target = await this.store.findBaselineByVersion(input.projectId, superseded);
      if (!target) {
        return refused(
          'supersedes-unknown-baseline',
          `there is no baseline v${superseded} in this project to supersede`,
        );
      }
      if (target.supersededBy !== null) {
        return refused(
          'supersedes-superseded-baseline',
          `baseline v${superseded} was already superseded by v${target.supersededBy} — two ` +
            'baselines claiming to have replaced it leaves no single answer to what did',
        );
      }
    }

    const frozen = new Set(input.members.map((member) => member.requirementVersionId));
    const collision = current.find(
      (baseline) =>
        baseline.version !== superseded && baseline.memberVersionIds.some((id) => frozen.has(id)),
    );
    if (collision) {
      const shared = collision.memberVersionIds.filter((id) => frozen.has(id));
      return refused(
        'overlapping-scope-conflict',
        `baseline v${collision.version} already freezes ${shared.join(', ')} — overlapping ` +
          'approval is a conflict to decide, never a merge (FR-RQR-054)',
      );
    }

    // T339b — FR-RQR-030 / FR-RQR-031, before the Contract is consulted for the
    // same reason supersession is: evaluating evidence for an approval that
    // cannot land is work nobody asked for.
    const criteria = await this.checkCriteria(input);
    if (criteria) return criteria;

    const contract = await evidence.isSatisfied(input.evidenceContractRef, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });
    if (!contract.satisfied) {
      return refused(
        'evidence-contract-unsatisfied',
        `Evidence Contract ${input.evidenceContractRef} is not satisfied — unmet: ` +
          `${contract.unmet.join(', ') || 'unreported'} (BR-0144: declaring completion is not ` +
          'the evidence)',
      );
    }

    const baseline = await this.create({
      ...input,
      evidenceContractRef: input.evidenceContractRef,
    });
    if (input.exceptions && input.exceptions.length > 0) {
      // T339d — written AFTER the baseline exists, so an exception can never
      // name a baseline that does not. `FR-RQR-033` reads them back from here.
      await this.store.createBaselineExceptions(
        input.exceptions.map((exception) => ({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          baselineId: baseline.id,
          requirementVersionId: exception.requirementVersionId,
          condition: exception.condition,
          authorizedBy: exception.authorizedBy.trim(),
          reason: exception.reason.trim(),
          createdAt: new Date(),
        })),
      );
    }
    if (superseded !== undefined) {
      const target = await this.store.findBaselineByVersion(input.projectId, superseded);
      // The only mutation a baseline row accepts, and the only one the
      // `baselines_supersede_only` trigger permits.
      if (target) await this.store.supersede(target.id, baseline.version);
    }
    return { outcome: 'approved', baseline };
  }

  /**
   * Write the frozen set.
   *
   * Everything refused below is refused *before* a version number is taken, so
   * a rejected approval does not consume one. Versions are never reused, and a
   * project whose history skips 4 invites the question of what happened to it.
   */
  async create(input: CreateBaselineInput): Promise<BaselineRow> {
    assertComplete(input);
    assertRealSet(input.members);

    const version = await this.store.nextBaselineVersion(input.projectId);
    return this.store.createBaseline({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      version,
      memberVersionIds: input.members.map((member) => member.requirementVersionId),
      setHash: requirementSetHash(input.members),
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
      rationale: input.rationale.trim(),
      decisionId: input.decisionId,
      // Current until something replaces it — FR-RQR-052.
      supersededBy: null,
      evidenceContractRef: input.evidenceContractRef ?? null,
    });
  }

  /**
   * T339b — `FR-RQR-030`, `FR-RQR-031`, `SC-RQR-003`. Returns a refusal, or
   * `null` to proceed.
   *
   * **Fails closed twice.** `intendedForImplementation` defaults **true**, so a
   * candidate nobody has looked at blocks; and a member this Room cannot
   * resolve to a candidate is refused rather than waved past, because a member
   * it cannot check is one it cannot gate and `SC-RQR-003` says *zero*. The
   * documented escape from both is `FR-RQR-032`'s recorded exception —
   * attributed, reasoned and enumerable — never a silent pass.
   *
   * **Every offender is named, not the first.** Naming one sends the approver
   * round the loop once per missing member, which is how a gate becomes
   * something people route around.
   *
   * *What is checked is that criteria were **stated**.* Judging whether they
   * are **measurable** is a human's job and the analysis half's; a rule
   * claiming to detect measurability would put a heuristic between a
   * requirement and its baseline and call the result a guarantee.
   */
  private async checkCriteria(input: ApproveBaselineInput): Promise<BaselineApproval | null> {
    const waived = new Set(
      (input.exceptions ?? [])
        .filter((e) => e.condition === 'missing-acceptance-criteria')
        .map((e) => e.requirementVersionId),
    );
    const unverifiable: string[] = [];
    const missing: string[] = [];

    for (const member of input.members) {
      if (waived.has(member.requirementVersionId)) continue;
      if (!member.candidateId) {
        unverifiable.push(member.requirementVersionId);
        continue;
      }
      const candidate = await this.store.findCandidateById(member.candidateId);
      // A candidate in another workspace is indistinguishable from one that
      // does not exist (FR-002 / SC-004) — and both mean "cannot check".
      if (!candidate || candidate.workspaceId !== input.workspaceId) {
        unverifiable.push(member.requirementVersionId);
        continue;
      }
      if (!candidate.intendedForImplementation) continue;
      const stated = candidate.acceptanceCriteria ?? [];
      if (stated.length === 0) {
        missing.push(`${member.requirementVersionId} ("${candidate.normalizedText}")`);
      }
    }

    if (unverifiable.length > 0) {
      return refused(
        'criteria-unverifiable',
        `this Room cannot check acceptance criteria for ${unverifiable.join(', ')} — no ` +
          'candidate names them. Record an exception (FR-RQR-032) if the baseline should ' +
          'proceed anyway',
      );
    }
    if (missing.length > 0) {
      return refused(
        'acceptance-criteria-missing',
        `these requirements are intended for implementation and state no acceptance criteria: ` +
          `${missing.join('; ')} (FR-RQR-030)`,
      );
    }
    return null;
  }

  /**
   * T339f — `FR-RQR-033`. Every waiver on a baseline, in one call.
   *
   * *"Exceptions on a baseline MUST be enumerable without opening each
   * requirement."* One lookup by `baselineId`, which is why this is a table and
   * not a flag on the member (data-model §6): **an exception that becomes
   * invisible is a rule waived once and then forgotten**, and a reader who has
   * to open thirty requirements to find the two waivers will not.
   */
  async exceptionsFor(workspaceId: string, baselineId: string): Promise<BaselineExceptionRow[]> {
    const baseline = await this.store.findBaselineById(baselineId);
    if (!baseline || baseline.workspaceId !== workspaceId) {
      throw new NotFoundError('Not found.');
    }
    return this.store.listBaselineExceptions(workspaceId, baselineId);
  }

  /**
   * T338h — `FR-RQR-051`, `RULE-02`, `BR-0042`. The seam `EPIC-034` receives.
   *
   * *"An edit to a baselined requirement MUST be refused as an in-place change
   * and offered as a Change Request against that baseline."*
   *
   * Both halves matter. A refusal that only says no leaves the user with a
   * requirement they cannot change and no route to change it — which is how
   * in-place editing gets argued back in, one urgent Friday at a time. So the
   * refusal carries the baseline it is against and where to raise the request.
   *
   * **Current baselines only.** `FR-RQR-052` keeps a superseded baseline
   * *readable*; it does not keep it *governing*. Counting superseded sets would
   * make every requirement permanently uneditable after its first baseline,
   * which no requirement says and every user would report as a bug.
   *
   * The caller supplies the requirement's version ids — the join between a
   * requirement and the versions a baseline froze belongs to `EPIC-007`, and
   * doing it here would mean this service holding the register (`FR-RQR-002`).
   */
  async assertEditable(
    ctx: { workspaceId: string },
    requirement: EditableRequirement,
    requirementVersionIds: readonly string[],
  ): Promise<void> {
    if (requirementVersionIds.length === 0) return;
    const frozen = new Set(requirementVersionIds);
    const current = (await this.store.listBaselines(ctx.workspaceId, requirement.projectId)).filter(
      (baseline) => baseline.supersededBy === null,
    );
    const blocking = current.find((baseline) =>
      baseline.memberVersionIds.some((id) => frozen.has(id)),
    );
    if (blocking) throw new InPlaceEditRefusedError(blocking, requirement.id);
  }
}

/** What a refused edit offers instead. `BR-0042`, contract §5. */
export interface ChangeRequestAffordance {
  readonly remedy: 'change-request';
  readonly baselineId: string;
  readonly baselineVersion: number;
  /** Unchanged by the refusal, and checkable — `R-033-5`. */
  readonly setHash: string;
  readonly requirementId: string;
  /**
   * `EPIC-034`'s inbound route, from `specs/034-change-room/contracts/change-contract.md` §6.
   *
   * A route string and nothing more. `FR-RQR-003` forbids this Epic
   * *implementing* the Change Room, and it does not — but `BR-0042` requires
   * the refusal to *offer* the change, and an affordance the user has to go
   * looking for is not one.
   */
  readonly raiseAt: 'POST /rooms/change/requests';
}

/**
 * `409`, per contract §5. A `ConflictError` because that is exactly what this
 * is — the request is well-formed and conflicts with the state of an approved
 * baseline — and because inventing a status from an Epic that does not own
 * `platform-api.md` is the mistake `DEF-008-001` records.
 */
export class InPlaceEditRefusedError extends ConflictError {
  constructor(baseline: BaselineRow, requirementId: string) {
    const affordance: ChangeRequestAffordance = {
      remedy: 'change-request',
      baselineId: baseline.id,
      baselineVersion: baseline.version,
      setHash: baseline.setHash,
      requirementId,
      raiseAt: 'POST /rooms/change/requests',
    };
    super(
      `This requirement is frozen into baseline v${baseline.version} and cannot be edited in ` +
        'place (RULE-02). Raise a Change Request against that baseline instead.',
      affordance,
    );
  }
}

function refused(reason: BaselineRefusalReason, detail: string): BaselineApproval {
  return { outcome: 'refused', reason, detail };
}

/**
 * T339d — `FR-RQR-032`. *"The exception MUST carry its authorizer and reason."*
 *
 * Both, and neither may be blank — the `baseline_exceptions_are_explicit` CHECK
 * constraint says the same thing at the row. A waiver with no authorizer is a
 * rule that waived itself; one with no reason is a decision nobody can review,
 * and it looks identical to one that was reasoned.
 *
 * **Refused, not dropped.** An invalid exception silently ignored would send
 * the approval back to the criteria gate and refuse it there, for a reason the
 * caller did not cause — and they would fix the wrong thing.
 */
function assertExceptionsAreExplicit(exceptions: readonly BaselineExceptionInput[]): void {
  exceptions.forEach((exception, index) => {
    const missing: string[] = [];
    if (!exception?.requirementVersionId?.trim()) missing.push('requirementVersionId');
    if (!exception?.authorizedBy?.trim()) missing.push('authorizedBy');
    if (!exception?.reason?.trim()) missing.push('reason');
    if (exception?.condition !== 'missing-acceptance-criteria') missing.push('condition');
    if (missing.length > 0) {
      throw new ValidationFailedError(
        `exception ${index + 1} requires: ${missing.join(', ')} — a waiver with no authorizer or ` +
          'no reason is not reviewable (FR-RQR-032)',
      );
    }
  });
}

/** Names every missing field at once, so a caller fixes the request in one go. */
function assertComplete(input: CreateBaselineInput): void {
  const record = input as unknown as Record<string, unknown> | null | undefined;
  const missing = REQUIRED.filter((field) => {
    const value = record?.[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new ValidationFailedError(`a baseline requires: ${missing.join(', ')}`);
  }
}

/**
 * A baseline of nothing hashes cleanly, satisfies every downstream check and
 * approves no requirement — so it is refused here rather than discovered later.
 * A duplicated member is refused **by name**: `requirementSetHash` is total and
 * would hash the duplicate happily, and a set that silently collapsed to fewer
 * members than the approver listed is not the set they approved.
 */
function assertRealSet(members: readonly BaselineMember[]): void {
  if (members.length === 0) {
    throw new ValidationFailedError('a baseline must freeze at least one requirement version');
  }
  const seen = new Set<string>();
  const duplicated = members
    .map((member) => member.requirementVersionId)
    .filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  if (duplicated.length > 0) {
    throw new ValidationFailedError(
      `a baseline lists each requirement version once — duplicated: ${[...new Set(duplicated)].join(', ')}`,
    );
  }
}
