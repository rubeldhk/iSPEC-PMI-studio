/**
 * `T994a`, `T994b` (EPIC-034) — the decision path.
 *
 * `FR-CHR-050`: an authorized decision **before implementation affects an
 * approved baseline**. `FR-CHR-052`: authority evaluated through `EPIC-031`
 * using the published `BR-0005` decision-authority record. `FR-CHR-053`:
 * decisions surface in the Decision Inbox.
 *
 * `T996t` covered what a decision **retains**. This file covers the two things
 * around it: how one is asked for, and the ordering that makes `FR-CHR-050`
 * more than a sentence.
 *
 * ## Why submission refuses when the inbox is unbound
 *
 * A change submitted for decision that surfaces nowhere is a change that waits
 * forever with nobody aware it is waiting — worse than a refusal, because a
 * refusal is visible on the spot. `BR-0068`'s inbox is `EPIC-031`'s, and until
 * it is bound this Room says so rather than queueing into a void.
 *
 * That is the same posture as `PolicyProvider`, and for the same reason
 * (`FR-GEL-062`): the failure of a silent success is that it looks, at every
 * call site, exactly like the thing working.
 */
import { describe, expect, it } from 'vitest';
import { storeWithImpactView } from '../helpers/change-room-fixtures.js';
import {
  DecisionService,
  type ChangeDecisionInboxPort,
  type ChangeDecisionPolicyPort,
} from '../../src/modules/change-room/decision.service.js';
import { TRADEOFF_DIMENSIONS, type ChangeOption, type ChangeOptions } from '../../src/modules/change-room/option.types.js';

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

const OPTIONS: ChangeOptions = [option('a'), option('b')];

const permits: ChangeDecisionPolicyPort = {
  async authorize() {
    return { authorized: true, authorityBasis: 'DA-0007', band: 'high' };
  },
};

/** Records what it was handed, so the test can read it back. */
function recordingInbox(): ChangeDecisionInboxPort & { readonly seen: unknown[] } {
  const seen: unknown[] = [];
  return {
    seen,
    async present(item) {
      seen.push(item);
      return { inboxItemId: `inbox_${seen.length}` };
    },
  };
}

const submission = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  impactViewId: 'iv_1',
  options: OPTIONS,
  requestedBy: 'u_1',
  ...over,
});

const decision = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  decisionId: 'dec_1',
  impactViewId: 'iv_1',
  decidedBy: 'u_2',
  decidedByKind: 'human' as const,
  objectVersion: 1,
  options: OPTIONS,
  chosenOptionId: 'b',
  rationale: 'B keeps the migration reversible.',
  now: new Date('2026-08-30T12:00:00Z'),
  ...over,
});

const withInbox = async (inbox: ChangeDecisionInboxPort | undefined) =>
  new DecisionService(await storeWithImpactView(), permits, inbox);

describe('T994a · a change is submitted for decision', () => {
  it('and surfaces in the Decision Inbox', async () => {
    // `FR-CHR-053`, `BR-0068`.
    const inbox = recordingInbox();
    const submitted = await (await withInbox(inbox)).submitForDecision(submission());

    expect(inbox.seen).toHaveLength(1);
    expect(submitted.inboxItemId).toBe('inbox_1');
  });

  it('carrying the options and the impact view it must be decided against', async () => {
    // An inbox item that names only the change sends the approver looking for
    // the two things the decision actually turns on.
    const inbox = recordingInbox();
    await (await withInbox(inbox)).submitForDecision(submission());

    const item = inbox.seen[0] as { options: unknown[]; impactViewId: string; band: string };
    expect(item.options).toHaveLength(2);
    expect(item.impactViewId).toBe('iv_1');
  });

  it('in the high band, always', async () => {
    // `FR-CHR-051`, `ADR-0025` constraint 1. The band is stated by this Room
    // rather than asked for: baseline change is high, and a question invites an
    // answer.
    const inbox = recordingInbox();
    await (await withInbox(inbox)).submitForDecision(submission());
    expect((inbox.seen[0] as { band: string }).band).toBe('high');
  });

  it('refuses when the inbox is unbound', async () => {
    // Queueing into a void is worse than refusing: the change would wait
    // forever with nobody aware it was waiting.
    await expect((await withInbox(undefined)).submitForDecision(submission())).rejects.toThrow(
      /EPIC-031/,
    );
  });

  it('refuses a submission with fewer than two options', async () => {
    // `FR-CHR-040` reaching the inbox. A single-option item is a confirmation
    // request wearing a decision's clothes.
    const inbox = recordingInbox();
    await expect(
      (await withInbox(inbox)).submitForDecision(submission({ options: [option('a')] })),
    ).rejects.toThrow(/two or more/i);
    expect(inbox.seen).toHaveLength(0);
  });

  it('refuses a submission with no impact view', async () => {
    // `BR-0044` — a change decided without its impact view is decided on the
    // part somebody thought of.
    const inbox = recordingInbox();
    await expect(
      (await withInbox(inbox)).submitForDecision(submission({ impactViewId: '' })),
    ).rejects.toThrow(/impact view/i);
    expect(inbox.seen).toHaveLength(0);
  });
});

describe('T994a · FR-CHR-050 — decided before a baseline moves', () => {
  it('a change with no decision is not applicable', async () => {
    const service = (await withInbox(recordingInbox()));
    expect(await service.decidedFor('ws_1', 'cr_1')).toBeNull();
  });

  it('a recorded decision makes it applicable', async () => {
    const store = await storeWithImpactView();
    const service = new DecisionService(store, permits, recordingInbox());
    await service.record(decision());

    const found = await service.decidedFor('ws_1', 'cr_1');
    expect(found?.chosenOption.optionId).toBe('b');
  });

  it('and names the impact view it was decided against', async () => {
    // `R-034-5`'s left-hand side. Without it, "has the impact changed since the
    // decision?" is a human guess.
    const store = await storeWithImpactView();
    const service = new DecisionService(store, permits, recordingInbox());
    await service.record(decision());
    expect((await service.decidedFor('ws_1', 'cr_1'))?.impactViewId).toBe('iv_1');
  });

  it('a decision in another workspace is not visible', async () => {
    const store = await storeWithImpactView();
    const service = new DecisionService(store, permits, recordingInbox());
    await service.record(decision());
    expect(await service.decidedFor('ws_other', 'cr_1')).toBeNull();
  });
});

describe('T994a · FR-CHR-052 — the authority is published, not asserted', () => {
  it('records the basis the provider returned', async () => {
    const store = await storeWithImpactView();
    await new DecisionService(store, permits, recordingInbox()).record(decision());
    expect((await store.listDecisionsFor('ws_1', 'cr_1'))[0]?.authorityBasis).toBe('DA-0007');
  });

  it('refuses an authorisation with no basis', async () => {
    const vague: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: true, authorityBasis: '   ', band: 'high' };
      },
    };
    await expect(
      new DecisionService(await storeWithImpactView(), vague, recordingInbox()).record(decision()),
    ).rejects.toThrow(/authority basis/i);
  });

  it('refuses a decision the provider did not authorise', async () => {
    const denies: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: false, reason: 'no delegation covers this band' };
      },
    };
    await expect(
      new DecisionService(await storeWithImpactView(), denies, recordingInbox()).record(decision()),
    ).rejects.toThrow(/no delegation/);
  });
});

describe('T994a · FR-CHR-051 — the band cannot be lowered', () => {
  it('refuses a decision the policy placed in a lower band', async () => {
    // `ADR-0025` constraint 1: no tenant policy lowers baseline change out of
    // the high band. A provider that answers `low` is either misconfigured or
    // has been persuaded, and both are refusals here rather than a shrug —
    // this Room does not adjudicate policy, but it does check that the answer
    // it was given is one the requirement permits.
    const lowered: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: true, authorityBasis: 'DA-0007', band: 'low' };
      },
    };
    await expect(
      new DecisionService(await storeWithImpactView(), lowered, recordingInbox()).record(
        decision(),
      ),
    ).rejects.toThrow(/high band/i);
  });

  it('and writes nothing when it does', async () => {
    const store = await storeWithImpactView();
    const lowered: ChangeDecisionPolicyPort = {
      async authorize() {
        return { authorized: true, authorityBasis: 'DA-0007', band: 'medium' };
      },
    };
    await expect(
      new DecisionService(store, lowered, recordingInbox()).record(decision()),
    ).rejects.toThrow();
    expect(await store.listDecisionsFor('ws_1', 'cr_1')).toHaveLength(0);
  });

  it('accepts high — or the check means nothing', async () => {
    // The control. Without it, a refusal of every band would satisfy the two
    // assertions above.
    const store = await storeWithImpactView();
    await new DecisionService(store, permits, recordingInbox()).record(decision());
    expect(await store.listDecisionsFor('ws_1', 'cr_1')).toHaveLength(1);
  });
});
