/**
 * `T996u` (EPIC-034) — a recorded change decision. `FR-CHR-043`.
 *
 * **Three things are retained, and the third is the one that gets dropped:**
 * the option chosen, its rationale, and the options **declined**. The declined
 * set is the only one nobody needs in order to proceed, which is exactly why it
 * goes missing — and a decision recording only what was chosen reads, a year
 * later, as though there was nothing else to choose. `BR-0023`'s objection
 * applies after the fact as much as before it.
 *
 * Declined options are stored whole, with their trade-offs. Reduced to a list
 * of ids they cannot answer *what did we give up*, which is the only question
 * they exist to answer.
 *
 * ## What this file does NOT decide
 *
 * Authority, risk band and separation of duties are `FR-CHR-050`–`FR-CHR-054`
 * and belong to Phases 6 and 7. This service **consults** `EPIC-031` through a
 * port and refuses when it is unbound — the declared behaviour of five of the
 * Room's six ports (`CHANGE_ROOM_PORTS`). It does not adjudicate anything
 * itself: `FR-CHR-002` forbids this Epic implementing policy, and a Room that
 * decided its own authority would be `ADR-0025` constraint 1 broken from the
 * inside.
 *
 * That refusal is also what makes retention safe to build first. Nothing can be
 * recorded until `EPIC-031` is bound, so there is no window in which this
 * service writes an unauthorised decision.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import type { ChangeDecisionRow, ChangeRoomStore } from './change-room.store.js';
import type { ChangeOption, ChangeOptions } from './option.types.js';

/**
 * What `EPIC-031` answers, and nothing more.
 *
 * Deliberately not a boolean: an authorised decision must carry the **basis**
 * on which it was authorised, or it is an approval nobody can trace back to a
 * `BR-0005` decision-authority record (`FR-CHR-052`).
 */
export type ChangeDecisionAuthority =
  | { readonly authorized: true; readonly authorityBasis: string; readonly band: string }
  | { readonly authorized: false; readonly reason: string };

export interface ChangeDecisionPolicyPort {
  authorize(input: {
    workspaceId: string;
    changeRequestId: string;
    decidedBy: string;
    decidedByKind: string;
  }): Promise<ChangeDecisionAuthority>;
}

export interface RecordDecisionInput {
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly decisionId: string;
  readonly impactViewId: string;
  readonly decidedBy: string;
  readonly decidedByKind: string;
  readonly objectVersion: number;
  readonly options: ChangeOptions;
  readonly chosenOptionId: string;
  readonly rationale: string;
  readonly now: Date;
}

export class DecisionService {
  constructor(
    private readonly store: ChangeRoomStore,
    private readonly policy?: ChangeDecisionPolicyPort | undefined,
  ) {}

  /**
   * Every check runs before anything is written, so a refused decision cannot
   * leave a half-recorded one behind.
   */
  async record(input: RecordDecisionInput): Promise<ChangeDecisionRow> {
    // `RULE-03`, `SC-CHR-003` — zero auto-approvals under any tenant policy.
    // Checked here as well as by `change_decisions_decided_by_a_human`: the one
    // that fires first gives the better message, and the other cannot be
    // bypassed by a caller that reaches the database another way.
    if (input.decidedByKind !== 'human') {
      throw new ValidationFailedError(
        'a change decision is taken by a human (RULE-03, SC-CHR-003); ' +
          `this one claims to be ${input.decidedByKind}`,
      );
    }
    if (input.rationale.trim() === '') {
      throw new ValidationFailedError('a change decision states its rationale (FR-CHR-043)');
    }

    const chosen = input.options.find((option) => option.optionId === input.chosenOptionId);
    if (!chosen) {
      // Otherwise the declined set is everything and the chosen option came
      // from nowhere — a decision about options nobody saw.
      throw new ValidationFailedError(
        `the chosen option ${input.chosenOptionId} is not among the options presented`,
      );
    }

    if (!this.policy) {
      // `CHANGE_ROOM_PORTS` — `PolicyProvider` absent ⇒ refuse. `FR-GEL-062`: a
      // default that permits is invisible at every call site.
      throw new ValidationFailedError(
        'no policy provider is bound (EPIC-031 supplies it), so nobody has authorised this ' +
          'decision — it is refused rather than recorded',
      );
    }

    const verdict = await this.policy.authorize({
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      decidedBy: input.decidedBy,
      decidedByKind: input.decidedByKind,
    });
    if (!verdict.authorized) {
      throw new ValidationFailedError(`the decision was not authorised: ${verdict.reason}`);
    }
    if (verdict.authorityBasis.trim() === '') {
      // An authorised decision with no stated basis is an approval nobody can
      // trace. Refused rather than filled in with something plausible.
      throw new ValidationFailedError(
        'the policy provider authorised the decision without stating an authority basis ' +
          '(FR-CHR-052, BR-0005)',
      );
    }

    const declined: ChangeOption[] = input.options.filter(
      (option) => option.optionId !== chosen.optionId,
    );

    return this.store.recordDecision({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      decidedBy: input.decidedBy,
      decidedByKind: input.decidedByKind,
      authorityBasis: verdict.authorityBasis,
      objectVersion: input.objectVersion,
      decidedAt: input.now,
      decisionId: input.decisionId,
      chosenOption: chosen,
      // `FR-CHR-043` — whole, with their trade-offs.
      declinedOptions: declined,
      rationale: input.rationale.trim(),
      impactViewId: input.impactViewId,
    });
  }
}
