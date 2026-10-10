/**
 * EPIC-048 `T2390` — amendment `A-031-3`, asserted in `EPIC-031`'s suite.
 *
 * `DecisionEngine.resolutionOf(workspaceId, decisionId)` is the engine's own
 * read of the decision that resolved a pending one. Additive: it delegates to
 * the repository and decides nothing. `null` while pending; another
 * workspace's decision reads as none.
 */
import { describe, expect, it } from 'vitest';
import { engine, request, WS } from '../helpers/decision-engine.js';

describe('A-031-3 · DecisionEngine.resolutionOf', () => {
  it('is null while pending, then the resolving row — the same row the repository holds', async () => {
    const { engine: subject, repository } = engine();
    const pending = await subject.decide(request({ actionType: 'release.promote', requestedBy: 'u_alice', actor: { kind: 'human', id: 'u_alice' } }));
    expect(pending.outcome).toBe('pending');
    await expect(subject.resolutionOf(WS, pending.decisionId)).resolves.toBeNull();
    const approved = await subject.approve({ workspaceId: WS, decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_bob' } });
    const row = await subject.resolutionOf(WS, pending.decisionId);
    expect(row).toMatchObject({ id: approved.decisionId, resolvesDecisionId: pending.decisionId, outcome: 'approved', decidedBy: 'u_bob' });
    expect(row).toEqual(await repository.resolutionOf(WS, pending.decisionId));
  });

  it('reads nothing across workspaces', async () => {
    const { engine: subject } = engine();
    const pending = await subject.decide(request({ actionType: 'release.promote', requestedBy: 'u_alice', actor: { kind: 'human', id: 'u_alice' } }));
    await subject.approve({ workspaceId: WS, decisionId: pending.decisionId, approver: { kind: 'human', id: 'u_bob' } });
    await expect(subject.resolutionOf('ws_other', pending.decisionId)).resolves.toBeNull();
  });
});
