/**
 * T752 — the Inbox projection. `FR-DPE-020`, `FR-DPE-022`, `FR-DPE-023`,
 * `FR-DPE-024`, `R-031-4`.
 *
 * **Derived at read time, from decisions — no queue table.** So:
 *
 * - membership follows the reader *now*; an entry never persists because it was
 *   once visible (`FR-DPE-022`);
 * - a decided item leaves the moment its resolution is recorded (`FR-DPE-024`);
 * - every entry links to the object and the action it concerns (`FR-DPE-023`).
 *
 * Role-aware: an approval is shown to the humans who may approve it — not the
 * requester, unless policy permits self-approval for that class — and a blocked
 * item is shown to the person blocked by it.
 */
import { describe, expect, it } from 'vitest';
import { inboxFor } from '../../src/modules/decision/inbox.projection.js';
import { PLATFORM_DEFAULT_POLICY } from '../../src/modules/decision/policy.loader.js';
import { engine, gates, request, rules } from '../helpers/decision-engine.js';

const policy = { ...PLATFORM_DEFAULT_POLICY, version: 2, approvedBy: 'owner' };
const human = (id: string) => ({ kind: 'human' as const, id });

async function scene() {
  const harness = engine({
    steering: rules([{ actionPattern: 'deploy', band: 'medium' }]),
    gates: gates({ g1: 'refused' }),
  });
  const pending = await harness.engine.decide(request({ actionType: 'release.promote', requestedBy: 'u_alice', actor: human('u_alice') }));
  const blocked = await harness.engine.decide(request({ requiredGates: ['g1'], requestedBy: 'u_bob', actor: human('u_bob') }));
  const decisions = () => harness.repository.list('ws_dpe');
  return { ...harness, pending, blocked, decisions };
}

describe('T752 · FR-DPE-020 — approvals go to those who may approve them', () => {
  it('shows a pending approval to another human, linking object, action and version', async () => {
    const { pending, decisions } = await scene();
    const entries = inboxFor(human('u_carol'), await decisions(), policy);
    expect(entries).toEqual([
      expect.objectContaining({
        decisionId: pending.decisionId,
        kind: 'approval',
        actionType: 'release.promote',
        objectRef: { type: 'service', id: 'svc-1' },
        objectVersion: '7',
        band: 'high',
        requestedBy: 'u_alice',
      }),
    ]);
  });

  it('does not show the requester their own approval when self-approval is not permitted', async () => {
    const { decisions } = await scene();
    expect(inboxFor(human('u_alice'), await decisions(), policy).filter((e) => e.kind === 'approval')).toEqual([]);
  });

  it('shows automation no approvals — it may never take one', async () => {
    const { decisions } = await scene();
    expect(inboxFor({ kind: 'automation', id: 'bot' }, await decisions(), policy)).toEqual([]);
  });
});

describe('T752 · FR-DPE-020 — blocked work goes to the person it blocks', () => {
  it('shows the refused request to its requester as blocked', async () => {
    const { blocked, decisions } = await scene();
    // Bob also sees Alice's approval — he may approve it — so look at what blocks him.
    const mine = inboxFor(human('u_bob'), await decisions(), policy).filter((e) => e.kind === 'blocked');
    expect(mine).toEqual([expect.objectContaining({ decisionId: blocked.decisionId, kind: 'blocked' })]);
  });

  it('does not show someone else’s blocked request', async () => {
    const { blocked, decisions } = await scene();
    expect(inboxFor(human('u_carol'), await decisions(), policy).map((e) => e.decisionId)).not.toContain(blocked.decisionId);
  });
});

describe('T752 · FR-DPE-022, FR-DPE-024 — derived, so decided items leave', () => {
  it('drops an approval the moment it is approved, and the decision stays retrievable', async () => {
    const { engine: e, repository, pending, decisions } = await scene();
    await e.approve({ workspaceId: 'ws_dpe', decisionId: pending.decisionId, approver: human('u_carol') });
    expect(inboxFor(human('u_carol'), await decisions(), policy).map((x) => x.decisionId)).not.toContain(pending.decisionId);
    expect(await repository.resolutionOf('ws_dpe', pending.decisionId)).toMatchObject({ outcome: 'approved' });
  });

  it('drops a blocked item once a later decision on the same action and object supersedes it', async () => {
    const { engine: e, blocked, decisions } = await scene();
    await e.decide(request({ requiredGates: [], actionType: 'deploy', requestedBy: 'u_bob', actor: human('u_bob') }));
    expect(inboxFor(human('u_bob'), await decisions(), policy).map((x) => x.decisionId)).not.toContain(blocked.decisionId);
  });
});
