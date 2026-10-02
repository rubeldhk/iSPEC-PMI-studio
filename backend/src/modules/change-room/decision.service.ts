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
import { ForbiddenError, ValidationFailedError } from '../../core/errors.js';
import type { ChangeDecisionRow, ChangeRoomStore } from './change-room.store.js';
import type { ChangeOption, ChangeOptions } from './option.types.js';

/**
 * `FR-CHR-051`, `ADR-0025` constraint 1 — baseline change is high band, and no
 * tenant policy lowers it.
 *
 * Stated here rather than asked for. This Room does not adjudicate policy
 * (`FR-CHR-002`), but it does check that the answer it was given is one the
 * requirement permits: a provider answering `low` is either misconfigured or
 * has been persuaded, and both are refusals rather than a shrug.
 */
const REQUIRED_BAND = 'high';

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

/**
 * `FR-CHR-053`, `BR-0068` — where a change waits for its decision.
 *
 * `EPIC-031` owns the Decision Inbox; this Room publishes into it and reads
 * nothing back but an identifier. Absent ⇒ **refuse**: a change submitted for
 * decision that surfaces nowhere waits forever with nobody aware it is waiting,
 * which is worse than a refusal because a refusal is visible on the spot.
 */
export interface ChangeDecisionInboxPort {
  present(item: {
    workspaceId: string;
    changeRequestId: string;
    impactViewId: string;
    options: ChangeOptions;
    requestedBy: string;
    band: string;
  }): Promise<{ inboxItemId: string }>;
}

export interface SubmitForDecisionInput {
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly impactViewId: string;
  readonly options: ChangeOptions;
  readonly requestedBy: string;
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

/**
 * `403`, carrying the `EPIC-031` decision id (`T994q`, `FR-CHR-084`).
 *
 * `ForbiddenError` rather than the opaque 404 this repository uses for
 * visibility: the caller can already see the change — what is refused is the
 * **authority** to decide it, and telling them so is the only way they can act
 * on it. `UX-0033` requires a policy-refused action to show the refusing
 * policy, and a refusal that named nothing would leave them guessing which of
 * their roles fell short.
 */
export class ChangeDecisionRefusedError extends ForbiddenError {
  constructor(reason: string, decisionId: string) {
    super(`the decision was not authorised: ${reason}`, {
      remedy: 'decision-authority',
      // EPIC-031's Decision — the record that evaluated the band and said no.
      decisionId,
      reason,
    });
  }
}

export class DecisionService {
  constructor(
    private readonly store: ChangeRoomStore,
    private readonly policy?: ChangeDecisionPolicyPort | undefined,
    private readonly inbox?: ChangeDecisionInboxPort | undefined,
  ) {}

  /**
   * `FR-CHR-053` — put the change in front of somebody who can decide it.
   *
   * The band is stated, not asked for. A question invites an answer, and the
   * one answer `FR-CHR-051` does not permit is a lower band.
   */
  async submitForDecision(
    input: SubmitForDecisionInput,
  ): Promise<{ inboxItemId: string }> {
    if (input.options.length < 2) {
      // `FR-CHR-040` reaching the inbox. A single-option item is a
      // confirmation request wearing a decision's clothes.
      throw new ValidationFailedError(
        'a change is submitted for decision with two or more options (FR-CHR-040)',
      );
    }
    if (input.impactViewId.trim() === '') {
      // `BR-0044` — a change decided without its impact view is decided on the
      // part somebody happened to think of.
      throw new ValidationFailedError(
        'a change is submitted for decision with the impact view it must be decided against ' +
          '(FR-CHR-035, BR-0044)',
      );
    }
    if (!this.inbox) {
      throw new ValidationFailedError(
        'no Decision Inbox is bound (EPIC-031 supplies it), so this change would wait where ' +
          'nobody can see it — it is refused rather than queued into a void (FR-CHR-053)',
      );
    }
    return this.inbox.present({
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      impactViewId: input.impactViewId,
      options: input.options,
      requestedBy: input.requestedBy,
      band: REQUIRED_BAND,
    });
  }

  /**
   * `FR-CHR-050` — the decision a baseline move must already have.
   *
   * `null` when none has been taken. `rebase.service.ts` reads this before
   * anything is re-baselined, which is what turns "an authorized decision
   * before implementation affects a baseline" from a sentence into an ordering
   * nothing can take out of order.
   */
  async decidedFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ChangeDecisionRow | null> {
    const all = await this.store.listDecisionsFor(workspaceId, changeRequestId);
    return all.length === 0 ? null : all[all.length - 1]!;
  }

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
      // 403, and it names the `EPIC-031` Decision that refused. `UX-0033`.
      throw new ChangeDecisionRefusedError(verdict.reason, input.decisionId);
    }
    if (verdict.band !== REQUIRED_BAND) {
      // `FR-CHR-051`, `ADR-0025` constraint 1.
      throw new ValidationFailedError(
        `baseline change stays in the high band and no tenant policy lowers it (FR-CHR-051); ` +
          `the policy provider answered ${verdict.band}`,
      );
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

    // `BR-0044`, `FR-CHR-035` - the view must exist before it can be cited.
    //
    // Made explicit by `T1218`. Calling `retainForDecision` on an absent view
    // threw `no impact view <id>`, which is the right outcome reached the wrong
    // way: a decision naming a snapshot nobody can read is decided on the part
    // somebody thought of, and it deserves a refusal that says so rather than a
    // store error surfacing from two layers down.
    const view = await this.store.findImpactView(input.workspaceId, input.impactViewId);
    if (!view) {
      throw new ValidationFailedError(
        `impact view ${input.impactViewId} cannot be read, so this decision would be taken ` +
          'against a blast radius nobody can see (BR-0044, FR-CHR-035)',
      );
    }

    // `FR-CHR-035`, `T1218` - mark the snapshot the decision was taken against.
    //
    // Before this, nothing in `src/` called it: `retainedForDecision` was always
    // `false`, and `R-034-5`'s re-decision comparison read a view nobody had
    // marked. The Tier 2 transcript recorded `retained: false` for exactly that
    // reason. Retention is what makes "has the impact changed since the
    // decision?" a comparison rather than a recollection, so the decision that
    // relies on it is the thing that must claim it.
    await this.store.retainForDecision(input.workspaceId, input.impactViewId);

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
