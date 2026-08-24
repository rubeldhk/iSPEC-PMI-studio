/**
 * T339o — the decision: human, authorized elsewhere, and retained whole.
 * `FR-RQR-023`, `FR-RQR-040`–`FR-RQR-044`, `BR-0025`, `RULE-03`.
 * Quickstart Scenarios 5 and 6.
 *
 * **Authority is evaluated by `EPIC-031`, never here** (`FR-RQR-042`). This
 * service calls `@pmi/loop-contract`'s `PolicyProvider` — the seam `EPIC-030`
 * `FR-GEL-062` defaults to **refuse** — and records the `decisionId` it comes
 * back with. There is deliberately no Room-local authority table, no role list
 * and no "is this person allowed" branch: a second answer to that question is
 * one that can disagree with the first, and the disagreement would be invisible
 * until an audit.
 *
 * **The `decisionId` is also `FR-RQR-044`.** *"Decisions MUST surface in the
 * Decision Inbox rather than only inside this Room"* — routing every decision
 * through `EPIC-031` IS the surfacing, and the recorded id is the link. A Room
 * that decided locally and then pushed a copy somewhere would have two records
 * and one of them would be stale.
 *
 * **`RULE-03` is enforced twice, and the halves are different in kind.** Here,
 * a non-human actor is refused before anything is written — that protects
 * callers who come through this service. `T339q` proves the *database* refuses
 * it too, which protects everyone else: a migration, a maintenance script, a
 * psql session, a future Room that forgot.
 *
 * **Declined options are retained** (`FR-RQR-023`). A decision recording only
 * what was chosen cannot answer *"what else was considered"*, and that question
 * is the whole reason `BR-0023` asks for options at all.
 */
import { describe, expect, it } from 'vitest';
import type { DecisionRequest, DecisionResult, PolicyProvider } from '@pmi/loop-contract';
import { ValidationFailedError } from '../../src/core/errors.js';
import {
  DecisionService,
  PolicyUnavailableError,
  DecisionRefusedError,
  type RecordDecisionInput,
} from '../../src/modules/requirement-room/decision.service.js';
import { OptionsService } from '../../src/modules/requirement-room/options.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const OPTIONS = [
  {
    id: 'opt_a',
    summary: 'Re-authenticate in place.',
    tradeOffs: ['In flow; costs a refresh path.'],
    dependencies: ['EPIC-005 sign-in'],
    risks: ['Refresh loop on clock skew.'],
    reasoning: 'The reviewer loses no context.',
  },
  {
    id: 'opt_b',
    summary: 'Send the reviewer back to the list.',
    tradeOffs: ['Simplest; loses their place.'],
    dependencies: [],
    risks: ['The complaint recurs.'],
    reasoning: 'Cheapest, and honest about it.',
  },
];

/** Stands in for `EPIC-031`. Test-local — the module ships no policy default. */
class ProbePolicy implements PolicyProvider {
  readonly calls: DecisionRequest[] = [];
  constructor(private readonly result: DecisionResult) {}
  async decide(request: DecisionRequest): Promise<DecisionResult> {
    this.calls.push(request);
    return this.result;
  }
}

const PERMITTED: DecisionResult = {
  permitted: true,
  decisionId: 'dpe_4417',
  explanation: 'product-owner may approve a medium-band requirement set',
};

const REFUSED: DecisionResult = {
  permitted: false,
  decisionId: 'dpe_4418',
  explanation: 'a high-band set requires the architecture authority',
};

function fixture(result: DecisionResult = PERMITTED) {
  const store = new InMemoryRequirementRoomStore();
  const policy = new ProbePolicy(result);
  return { store, policy, decisions: new DecisionService(store, policy) };
}

function input(over: Partial<RecordDecisionInput> = {}): RecordDecisionInput {
  return {
    workspaceId: 'ws_1',
    roomObjectId: 'ro_1',
    objectVersion: 3,
    actor: { kind: 'human', id: 'user_1' },
    options: new OptionsService().present(OPTIONS),
    chosenOptionId: 'opt_a',
    rationale: 'The reviewer losing their place is the complaint we had.',
    ...over,
  };
}

describe('T339o · the decision is recorded whole', () => {
  it('records the chosen option and the rationale', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    expect(recorded.chosenOption).toBe('opt_a');
    expect(recorded.rationale).toMatch(/losing their place/);
    expect(recorded.decidedBy).toBe('user_1');
  });

  it('retains the declined options, in full — FR-RQR-023', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    // Not their ids: "what else was considered" is answered by the trade-offs
    // and risks that were weighed, and an id list sends the reader looking for
    // a set that was never persisted anywhere else.
    expect(recorded.declinedOptions).toHaveLength(1);
    expect(recorded.declinedOptions[0]).toMatchObject({
      id: 'opt_b',
      risks: ['The complaint recurs.'],
    });
  });

  it('is the requirement_decisions column set exactly', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    expect(Object.keys(recorded).sort()).toEqual([
      'authorityBasis',
      'chosenOption',
      'decidedAt',
      'decidedBy',
      'decidedByKind',
      'declinedOptions',
      'decisionId',
      'objectVersion',
      'rationale',
      'roomObjectId',
      'workspaceId',
      'id',
    ].sort());
  });

  it('refuses a chosen option that is not in the set', async () => {
    const { decisions } = fixture();

    // Deciding for an option nobody presented leaves `declinedOptions` holding
    // every option that WAS presented, and a chosen one that appears nowhere.
    await expect(decisions.decide(input({ chosenOptionId: 'opt_z' }))).rejects.toThrow(/opt_z/);
  });

  it('refuses an empty rationale — BR-0025, matching the CHECK constraint', async () => {
    const { decisions } = fixture();

    await expect(decisions.decide(input({ rationale: '   ' }))).rejects.toThrow(
      ValidationFailedError,
    );
  });
});

describe('T339o · no AI takes a requirement decision — FR-RQR-041', () => {
  it.each(['agent', 'automation'] as const)('refuses a decision by a %s actor', async (kind) => {
    const { decisions } = fixture();

    await expect(
      decisions.decide(input({ actor: { kind, id: 'claude-1' } })),
    ).rejects.toThrow(/human/i);
  });

  it('writes nothing when the actor is not human', async () => {
    const { decisions, store } = fixture();

    await decisions
      .decide(input({ actor: { kind: 'agent', id: 'claude-1' } }))
      .catch(() => undefined);

    expect(await store.listDecisions('ws_1', 'ro_1')).toEqual([]);
  });

  it('does not even ask policy — an AI decision is refused before authority is a question', async () => {
    const { decisions, policy } = fixture();

    await decisions
      .decide(input({ actor: { kind: 'agent', id: 'claude-1' } }))
      .catch(() => undefined);

    // RULE-03 is not a policy setting. Asking EPIC-031 would imply a
    // configuration in which the answer could be yes.
    expect(policy.calls).toEqual([]);
  });

  it('records decidedByKind as human, matching the DecidedByKind enum', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    expect(recorded.decidedByKind).toBe('human');
  });
});

describe('T339o · authority is EPIC-031s, not this Rooms — FR-RQR-042', () => {
  it('asks the policy provider before recording', async () => {
    const { decisions, policy } = fixture();

    await decisions.decide(input());

    expect(policy.calls).toHaveLength(1);
    expect(policy.calls[0]?.actor).toEqual({ kind: 'human', id: 'user_1' });
  });

  it('asks about the Decide stage of this Rooms workflow', async () => {
    const { decisions, policy } = fixture();

    await decisions.decide(input());

    // The Room's flow maps onto EPIC-030's stages; a requirement decision is
    // the Decide stage of `requirement-room.json`.
    expect(policy.calls[0]?.toStage).toBe('Decide');
    expect(policy.calls[0]?.object).toEqual({
      workflowType: 'requirement-room',
      objectId: 'ro_1',
    });
  });

  it('records the EPIC-031 decision id — which is also the Inbox link, FR-RQR-044', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    // Routing through EPIC-031 IS the surfacing. A Room that decided locally
    // and pushed a copy would hold two records, and one would go stale.
    expect(recorded.decisionId).toBe('dpe_4417');
  });

  it('records the authority basis EPIC-031 applied, not one of its own', async () => {
    const { decisions } = fixture();

    const recorded = await decisions.decide(input());

    expect(recorded.authorityBasis).toBe(
      'product-owner may approve a medium-band requirement set',
    );
  });

  it('declares no local authority vocabulary anywhere in the module', async () => {
    const module = await import('../../src/modules/requirement-room/decision.service.js');
    const local = Object.keys(module).filter((n) => /Role|Authority(?!Basis)|Permission|Policy(?!Unavailable)/.test(n));

    // A Room-local role list is a second answer to "who may decide", and the
    // two would disagree silently until an audit (FR-RQR-042).
    expect(local).toEqual([]);
  });
});

describe('T339o · a refused decision shows the policy that refused it — FR-RQR-043', () => {
  it('refuses, carrying the EPIC-031 decision id', async () => {
    const { decisions } = fixture(REFUSED);

    const error = await decisions.decide(input()).then(
      () => null,
      (err: unknown) => err as DecisionRefusedError,
    );

    expect(error).toBeInstanceOf(DecisionRefusedError);
    expect(error?.details).toMatchObject({ decisionId: 'dpe_4418' });
  });

  it('carries the explanation, so UX-0033 can render the refusing policy', async () => {
    const { decisions } = fixture(REFUSED);

    const error = (await decisions.decide(input()).then(
      () => null,
      (err: unknown) => err,
    )) as { details?: { explanation?: string } };

    // "Refused" with no policy named sends the user to ask someone which rule
    // stopped them, which is the screen UX-0033 exists to remove.
    expect(error?.details?.explanation).toMatch(/architecture authority/);
  });

  it('writes no decision when policy refuses', async () => {
    const { decisions, store } = fixture(REFUSED);

    await decisions.decide(input()).catch(() => undefined);

    expect(await store.listDecisions('ws_1', 'ro_1')).toEqual([]);
  });
});

describe('T339o · an unbound policy provider refuses', () => {
  it('refuses rather than deciding without authority', async () => {
    const store = new InMemoryRequirementRoomStore();
    const decisions = new DecisionService(store, undefined);

    // ROOM_PORTS declares `refuse` for PolicyProvider: an undecided decision is
    // not an approval, and a default that permits is indistinguishable at every
    // call site from a policy that said yes (ADR-0025).
    await expect(decisions.decide(input())).rejects.toThrow(PolicyUnavailableError);
    await expect(decisions.decide(input())).rejects.toThrow(/EPIC-031/);
  });

  it('offers no permissive fallback anywhere in the module', async () => {
    const module = await import('../../src/modules/requirement-room/decision.service.js');
    const fallbacks = Object.keys(module).filter((n) => /InMemory|Fake|Stub|Permissive|Allow/.test(n));

    expect(fallbacks).toEqual([]);
  });
});
