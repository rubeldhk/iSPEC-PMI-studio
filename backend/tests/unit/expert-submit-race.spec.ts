/**
 * `T2601` (EPIC-047 Convergence) — the losing submission of a race leaves no
 * orphaned decision.
 *
 * `R-047-17`, `FR-EXP-005`, Phase 17 finding F2. Two submissions of one
 * version both reach `EPIC-031`, which takes a decision for each; only one
 * decision id can be recorded on the version (compare-and-set). The loser's
 * decision stayed pending in every reviewer's Decision Inbox, approving a
 * submission the version never recorded. Now the loser withdraws it and
 * answers 409.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/core/errors.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { RegistryService } from '../../src/modules/experts/registry.service.js';
import { authorOfWs1, contract, evidenceKnowing, recordingApprovals } from '../helpers/expert-fixtures.js';

/** A store in which another submission records its decision just before this one does. */
class RacedStore extends InMemoryExpertsStore {
  raced = false;
  override async recordDecision(ws: string, versionId: string, decisionId: string, prior: string | null = null) {
    if (!this.raced) {
      this.raced = true;
      await super.recordDecision(ws, versionId, 'd_winner', prior);
    }
    return super.recordDecision(ws, versionId, decisionId, prior);
  }
}

function registry() {
  const store = new RacedStore();
  const approvals = recordingApprovals();
  let n = 0;
  const service = new RegistryService(store, {
    authoring: new Authoring(authorOfWs1()),
    approvals,
    evidence: evidenceKnowing('implementation@1'),
    clock: () => '2026-10-10T09:00:00.000Z',
    ids: () => `id_${(n += 1)}`,
  });
  return { store, approvals, service };
}

describe('T2601 · a submission that loses the race withdraws its decision', () => {
  it('answers 409 and withdraws the decision it created, naming why', async () => {
    const { approvals, service } = registry();
    const { expert } = await service.register('ws_1', 'u_1', { key: 'test-engineer', name: 'Test Engineer', contract: contract() });
    const err = await service.submit('ws_1', 'u_1', expert.id, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(approvals.withdrawn).toEqual([
      expect.objectContaining({ workspaceId: 'ws_1', decisionId: 'd_1', actorId: 'u_1' }),
    ]);
    expect(approvals.withdrawn[0]?.reason).toMatch(/another submission|already recorded/i);
    // The winner's decision is the one the version holds.
    expect((await service.get('ws_1', 'u_1', expert.id)).versions[0]?.decisionId).toBe('d_winner');
  });

  it('a submission that wins withdraws nothing', async () => {
    const { store, approvals, service } = registry();
    store.raced = true;
    const { expert } = await service.register('ws_1', 'u_1', { key: 'test-engineer', name: 'Test Engineer', contract: contract() });
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).resolves.toMatchObject({ status: 'submitted' });
    expect(approvals.withdrawn).toEqual([]);
  });
});
