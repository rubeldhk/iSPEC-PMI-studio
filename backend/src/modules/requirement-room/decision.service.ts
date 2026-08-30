/**
 * T339p, T339s — recording a requirement decision. `FR-RQR-023`,
 * `FR-RQR-040`–`FR-RQR-044`, `BR-0025`, `RULE-03`. Unit test: `T339o`;
 * database proof: `T339q`.
 *
 * **Authority is `EPIC-031`'s, and this file has none of its own**
 * (`FR-RQR-042`). It calls `@pmi/loop-contract`'s `PolicyProvider` — the seam
 * `EPIC-030` `FR-GEL-062` defaults to **refuse** — and records the
 * `decisionId` that comes back. There is deliberately no role list, no
 * permission table and no *"is this person allowed"* branch anywhere in this
 * module: a second answer to that question is one that can disagree with the
 * first, and the disagreement stays invisible until an audit.
 *
 * **The recorded `decisionId` is also how `FR-RQR-044` is satisfied.**
 * *"Decisions MUST surface in the Decision Inbox rather than only inside this
 * Room"* — routing every decision through `EPIC-031` **is** the surfacing, and
 * the id is the link to it. The alternative, deciding here and pushing a copy
 * to the Inbox, would leave two records of one decision, and one of them would
 * go stale the first time either side was edited.
 *
 * **`RULE-03` is enforced twice, and the two halves protect different people.**
 * The check here refuses a non-human actor before anything is written, which
 * protects callers who come through this service. The
 * `requirement_decisions_decided_by_a_human` CHECK constraint refuses the same row at
 * the database, which protects everyone else — a migration, a maintenance
 * script, a psql session, a future Room that forgot. `T339q` proves the second
 * half independently, because a service test cannot.
 *
 * **The AI check comes before the policy call, deliberately.** Asking
 * `EPIC-031` whether an agent may take a requirement decision would imply a
 * configuration in which the answer could be yes. `RULE-03` is not a policy
 * setting.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import type { ActorRef, PolicyProvider } from '@pmi/loop-contract';
import type { Labelled } from '@pmi/room-contract';
import { ForbiddenError, ValidationFailedError,
  GovernanceSeamUnboundError,
} from '../../core/errors.js';
import type { PresentedOption } from './options.service.js';
import type { DecisionRow, RequirementRoomStore } from './requirement-room.store.js';

/** This Room's `workflowType`, matching `workflows/requirement-room.json`. */
const WORKFLOW_TYPE = 'requirement-room';

export interface RecordDecisionInput {
  readonly workspaceId: string;
  readonly roomObjectId: string;
  /** The `BR-0005` record's object version — `EPIC-031`'s field, not ours. */
  readonly objectVersion: number;
  readonly actor: ActorRef;
  /** The set as presented, so the declined ones can be retained in full. */
  readonly options: readonly Labelled<PresentedOption>[];
  readonly chosenOptionId: string;
  /** `BR-0025` — required. */
  readonly rationale: string;
}

/**
 * `ROOM_PORTS` declares `refuse` for `PolicyProvider`, and this is that
 * refusal. Not a `PlatformError`, for the reason `RegisterUnavailableError`
 * records: no documented status code means *"a governance seam is unbound"*.
 *
 * **`T1195` closed that gap.** `EPIC-001` added `governance_seam_unbound` (503)
 * to `platform-api.md` and to `core/errors.ts`, so this now extends a
 * `PlatformError` and the message reaches the caller instead of being flattened
 * to *"An unexpected error occurred."* The original judgment stands — the code
 * was added by the Epic that owns the contract, not invented here.
 */
export class PolicyUnavailableError extends GovernanceSeamUnboundError {
  constructor() {
    super(
      'the PolicyProvider seam is unbound — EPIC-031 supplies it, and FR-GEL-062 will not treat ' +
        'an undecided decision as an approval',
    );
    this.name = 'PolicyUnavailableError';
  }
}

/**
 * `403`, per contract §5, carrying the `EPIC-031` decision id and explanation
 * so the Room can render the policy that refused (`FR-RQR-043`, `UX-0033`).
 *
 * A `ForbiddenError` rather than a 404, and this is the one place in the Room
 * where that is right: `core/errors.ts` records that the taxonomy deliberately
 * hides existence behind 404 — but what is refused here is the **authority to
 * decide**, not the visibility of the object. The user can already see the set;
 * they need to know which rule stopped them. `EPIC-023` took the same exception
 * for the same reason.
 */
export class DecisionRefusedError extends ForbiddenError {
  constructor(decisionId: string, explanation: string) {
    super(`The policy engine refused this decision: ${explanation}`, {
      decisionId,
      explanation,
    });
    this.name = 'DecisionRefusedError';
  }
}

export class DecisionService {
  constructor(
    private readonly store: RequirementRoomStore,
    /** Absent ⇒ refuse. Never defaulted — see `PolicyUnavailableError`. */
    private readonly policy?: PolicyProvider | undefined,
  ) {}

  async decide(input: RecordDecisionInput): Promise<DecisionRow> {
    // RULE-03 first, and never as a policy question. See the header.
    if (input.actor?.kind !== 'human') {
      throw new ValidationFailedError(
        `a requirement decision is taken by a human; the actor is a ${input.actor?.kind ?? 'unknown kind'}. ` +
          'AI may prepare, propose and recommend (FR-RQR-041, RULE-03)',
      );
    }
    if (!input.rationale?.trim()) {
      throw new ValidationFailedError(
        'a decision requires a rationale — one without is a decision nobody can review, and it ' +
          'looks identical to one that was reasoned (BR-0025)',
      );
    }
    const chosen = input.options.find((option) => option.value.id === input.chosenOptionId);
    if (!chosen) {
      throw new ValidationFailedError(
        `"${input.chosenOptionId}" is not one of the options presented — deciding for an option ` +
          'nobody presented leaves every presented option declined and the chosen one nowhere',
      );
    }

    const policy = this.policy;
    if (!policy) throw new PolicyUnavailableError();

    const verdict = await policy.decide({
      object: { workflowType: WORKFLOW_TYPE, objectId: input.roomObjectId },
      toStage: 'Decide',
      actor: input.actor,
    });
    if (!verdict.permitted) {
      throw new DecisionRefusedError(verdict.decisionId, verdict.explanation);
    }

    return this.store.createDecision({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      roomObjectId: input.roomObjectId,
      decidedBy: input.actor.id,
      decidedByKind: 'human',
      // EPIC-031's own words for why this was permitted. Copying a Room-local
      // phrase here would be the second authority record FR-RQR-042 forbids.
      authorityBasis: verdict.explanation,
      objectVersion: input.objectVersion,
      chosenOption: chosen.value.id,
      // FR-RQR-023 — the options NOT taken, in full. Ids alone cannot answer
      // "what else was considered": the trade-offs and risks are the answer,
      // and they are persisted nowhere else.
      declinedOptions: input.options
        .filter((option) => option.value.id !== chosen.value.id)
        .map((option) => option.value),
      rationale: input.rationale.trim(),
      decisionId: verdict.decisionId,
      decidedAt: new Date(),
    });
  }

  /**
   * T339s — what this Room has decided, for its own timeline.
   *
   * **Not a second Inbox.** `FR-RQR-044`'s Inbox is `EPIC-031`'s, and every row
   * here carries the `decisionId` that puts it there. This reads the Room's
   * side of that link — the Activity Timeline region (`UX-0030`) — and is
   * deliberately incapable of listing a decision that `EPIC-031` never saw,
   * because `decide` is the only writer and it cannot reach the store without a
   * verdict.
   */
  async list(workspaceId: string, roomObjectId: string): Promise<DecisionRow[]> {
    return this.store.listDecisions(workspaceId, roomObjectId);
  }
}
