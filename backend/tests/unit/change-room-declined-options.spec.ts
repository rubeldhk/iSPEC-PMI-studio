/**
 * `T996t`, `T996u` (EPIC-034) — the chosen option, its rationale, and the ones
 * declined.
 *
 * `FR-CHR-043`. The third of those is the one that gets dropped, because it is
 * the only one nobody needs in order to proceed. A decision that records only
 * what was chosen reads, a year later, as though there was nothing else to
 * choose — which is how a reviewer concludes the decision was obvious and stops
 * asking whether it was right.
 *
 * `BR-0023`'s objection applies after the fact as much as before it: a single
 * path on the record is a conclusion wearing a decision's clothes.
 *
 * ## What this file deliberately does not test
 *
 * Authority, band and separation of duties are `FR-CHR-050`–`FR-CHR-054` and
 * belong to Phases 6 and 7. What is asserted here is that this service
 * **refuses** to record anything while `PolicyProvider` is unbound — the
 * declared behaviour of five of the Room's six ports, and the reason recording
 * retention early is safe. An unbound policy provider means nobody authorised
 * the change, and a default that permits is invisible at every call site
 * (`FR-GEL-062`).
 */
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  DecisionService,
  type ChangeDecisionPolicyPort,
} from '../../src/modules/change-room/decision.service.js';
import type { ChangeOption, ChangeOptions } from '../../src/modules/change-room/option.types.js';
import { TRADEOFF_DIMENSIONS } from '../../src/modules/change-room/option.types.js';

const tradeOffs = () => {
  const out = {} as ChangeOption['tradeOffs'];
  for (const d of TRADEOFF_DIMENSIONS) {
    (out as Record<string, unknown>)[d] = { stated: true, detail: `${d} considered` };
  }
  return out;
};

const option = (id: string): ChangeOption => ({
  optionId: id,
  summary: `Option ${id}`,
  reasoning: `Because of ${id}.`,
  tradeOffs: tradeOffs(),
  epistemic: 'recommendation',
});

const OPTIONS: ChangeOptions = [option('a'), option('b'), option('c')];

/** A policy provider that answers. Authority itself is Phase 6's subject. */
const permits: ChangeDecisionPolicyPort = {
  async authorize() {
    return { authorized: true, authorityBasis: 'DA-0007', band: 'high' };
  },
};

const refuses: ChangeDecisionPolicyPort = {
  async authorize() {
    return { authorized: false, reason: 'the decider holds no authority for this band' };
  },
};

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  decisionId: 'dec_1',
  impactViewId: 'iv_1',
  decidedBy: 'u_1',
  decidedByKind: 'human' as const,
  objectVersion: 1,
  options: OPTIONS,
  chosenOptionId: 'b',
  rationale: 'B keeps the migration reversible, which the regulator will ask about.',
  now: new Date('2026-08-30T12:00:00Z'),
  ...over,
});

/**
 * Two helpers rather than one with a default.
 *
 * The first draft was `service(policy = permits)`, and `service(undefined)`
 * quietly resolved to `permits` — a default parameter treats "explicitly
 * nothing" as "not supplied". So the two tests asserting that an **unbound**
 * provider refuses were exercising a bound one that permits, and passing.
 *
 * A test helper that defaults to permitting, in a file about the danger of
 * defaults that permit. `FR-GEL-062` applies to fixtures too.
 */
const service = (policy: ChangeDecisionPolicyPort) =>
  new DecisionService(new InMemoryChangeRoomStore(), policy);
const unboundService = () => new DecisionService(new InMemoryChangeRoomStore(), undefined);

describe('T996t · what a decision retains', () => {
  it('the option chosen', async () => {
    const decision = await service(permits).record(input());
    expect(decision.chosenOption.optionId).toBe('b');
    // The whole option, not its id. An id alone sends a later reader looking
    // for a set of options nothing retained.
    expect(decision.chosenOption.summary).toBe('Option b');
    expect(decision.chosenOption.tradeOffs.security.detail).toBe('security considered');
  });

  it('its rationale', async () => {
    const decision = await service(permits).record(input());
    expect(decision.rationale).toContain('reversible');
  });

  it('and the options declined — all of them', async () => {
    // `FR-CHR-043`. The part that gets dropped, because it is the only one
    // nobody needs in order to proceed.
    const decision = await service(permits).record(input());
    expect(decision.declinedOptions.map((o) => o.optionId)).toEqual(['a', 'c']);
  });

  it('declined options keep their trade-offs, not just their names', async () => {
    // A declined option reduced to a label cannot answer "what did we give up",
    // which is the only question it exists to answer.
    const decision = await service(permits).record(input());
    const declined = decision.declinedOptions[0]!;
    expect(Object.keys(declined.tradeOffs)).toHaveLength(6);
    expect(declined.reasoning).toBe('Because of a.');
  });

  it('and are still labelled recommendations', async () => {
    // They were recommendations when offered and they do not become anything
    // else by being declined.
    const decision = await service(permits).record(input());
    expect(decision.declinedOptions.every((o) => o.epistemic === 'recommendation')).toBe(true);
  });

  it('the impact view it was taken against', async () => {
    // `FR-CHR-035`. Without it, "has the impact changed since the decision?"
    // has no left-hand side.
    const decision = await service(permits).record(input());
    expect(decision.impactViewId).toBe('iv_1');
  });
});

describe('T996t · what it refuses', () => {
  it('a chosen option that was never offered', async () => {
    // Otherwise the declined set is everything and the chosen one came from
    // nowhere — a decision about options nobody saw.
    await expect(service(permits).record(input({ chosenOptionId: 'z' }))).rejects.toThrow(
      /not among the options/i,
    );
  });

  it('an empty rationale', async () => {
    // The database CHECK says the same thing. Both, because the one that fires
    // first gives the better message and the other cannot be bypassed.
    await expect(service(permits).record(input({ rationale: '   ' }))).rejects.toThrow(/rationale/i);
  });

  it('a decision by a non-human', async () => {
    // `SC-CHR-003` — zero auto-approvals under any tenant policy. `RULE-03`.
    await expect(service(permits).record(input({ decidedByKind: 'ai' }))).rejects.toThrow(/human/i);
  });

  it('and writes nothing when it refuses', async () => {
    const store = new InMemoryChangeRoomStore();
    const decisions = new DecisionService(store, permits);
    await expect(decisions.record(input({ rationale: '' }))).rejects.toThrow();
    expect(await store.listDecisionsFor('ws_1', 'cr_1')).toHaveLength(0);
  });
});

describe('T996t · an unbound policy provider refuses', () => {
  it('rather than recording an unauthorised decision', async () => {
    // `CHANGE_ROOM_PORTS` — `PolicyProvider` absent ⇒ **refuse**. This is the
    // reason retention can be built before authority is: nothing can be
    // recorded yet.
    await expect(unboundService().record(input())).rejects.toThrow(/EPIC-031/);
  });

  it('and the refusal names the seam rather than blaming the caller', async () => {
    await expect(unboundService().record(input())).rejects.toThrow(/no policy provider is bound/i);
  });

  it('a policy that declines is refused too, with its reason', async () => {
    await expect(service(refuses).record(input())).rejects.toThrow(/no authority/i);
  });

  it('nothing is written in either case', async () => {
    const store = new InMemoryChangeRoomStore();
    await expect(new DecisionService(store, undefined).record(input())).rejects.toThrow();
    await expect(new DecisionService(store, refuses).record(input())).rejects.toThrow();
    expect(await store.listDecisionsFor('ws_1', 'cr_1')).toHaveLength(0);
  });
});

describe('T996t · the authority basis is recorded, not assumed', () => {
  it('carries what the policy provider returned', async () => {
    // `FR-CHR-052` — evaluated through `EPIC-031`, using the `BR-0005`
    // decision-authority record. Copied onto the decision so the basis survives
    // a later policy change.
    const decision = await service(permits).record(input());
    expect(decision.authorityBasis).toBe('DA-0007');
  });

  it('and never a default when the provider gives none', async () => {
    const vague: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: true, authorityBasis: '', band: 'high' };
      },
    };
    // An authorised decision with no stated basis is an approval nobody can
    // trace. Refused rather than filled in.
    await expect(service(vague).record(input())).rejects.toThrow(/authority basis/i);
  });
});
