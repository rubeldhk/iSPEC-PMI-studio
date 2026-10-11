/**
 * `T2604` (EPIC-047 Convergence) — two reassignments at once leave one
 * current assignment.
 *
 * `FR-EXP-055`, Phase 18 finding F1. Each reassignment read the current
 * assignments before recording its own, so neither superseded the other's new
 * row, and the later one's supersede of the shared prior failed after its own
 * row was recorded — two current assignments. Now each, once recorded,
 * supersedes every other current assignment recorded **before** it: the one
 * recorded last stands, and neither request fails over a prior the other
 * already superseded.
 */
import { describe, expect, it } from 'vitest';
import { AssignmentService } from '../../src/modules/experts/assignment.service.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import type { Assignment } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { accessFrom, contract, expert, recordingApprovals, version } from '../helpers/expert-fixtures.js';

/** Holds every `addAssignment` until `waiting` callers have arrived — both have read before either records. */
class BarrierStore extends InMemoryExpertsStore {
  waiting = 0;
  #arrived = 0;
  #release: (() => void) | null = null;
  readonly #gate = new Promise<void>((resolve) => (this.#release = resolve));

  override async addAssignment(row: Assignment): Promise<Assignment> {
    if (this.waiting > 0) {
      this.#arrived += 1;
      if (this.#arrived >= this.waiting) this.#release!();
      await this.#gate;
    }
    return super.addAssignment(row);
  }
}

async function setup() {
  const store = new BarrierStore();
  const approvals = recordingApprovals();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: contract({ capabilities: ['test'] }), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');
  let tick = 0;
  let id = 0;
  const service = new AssignmentService(store, {
    authoring: new Authoring(accessFrom({ 'u_1:task:t_1': 'edit', 'u_2:task:t_1': 'edit' })),
    approvals,
    tasks: { exists: async (_ws, t) => t === 't_1' },
    clock: () => `2026-10-10T09:00:0${(tick += 1)}.000Z`,
    ids: () => `as_${(id += 1)}`,
  });
  return { store, approvals, service };
}

const gated = { assigneeKind: 'expert' as const, assigneeId: 'ex_test', capabilities: ['test'], riskClass: 'high' as const };

describe('T2604 · concurrent reassignments leave exactly one current assignment', () => {
  it('both succeed; the one recorded last is current; the shared prior’s decision is withdrawn once', async () => {
    const { store, approvals, service } = await setup();
    const prior = await service.assign('ws_1', 'u_1', 't_1', gated);
    store.waiting = 2;
    const [a, b] = await Promise.all([
      service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_8' }),
      service.assign('ws_1', 'u_2', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' }),
    ]);
    const history = await service.history('ws_1', 'u_1', 't_1');
    const current = history.filter((h) => h.supersededAt === null);
    const last = [a, b].sort((x, y) => x.assignedAt.localeCompare(y.assignedAt) || x.id.localeCompare(y.id)).at(-1)!;
    expect(current.map((h) => h.id)).toEqual([last.id]);
    expect(history).toHaveLength(3);
    expect(approvals.withdrawn.map((w) => w.decisionId)).toEqual([prior.decisionId]);
  });

  it('a later reassignment supersedes an earlier one recorded at the same instant, by id', async () => {
    const { store, service } = await setup();
    await store.addAssignment({
      id: 'as_0', workspaceId: 'ws_1', taskId: 't_1', assigneeKind: 'person', assigneeId: 'u_7', rule: 'r',
      state: 'standing', decisionId: null, assignedBy: 'u_1', assignedAt: '2026-10-10T09:00:01.000Z',
      supersededAt: null, supersededBy: null,
    });
    const b = await service.assign('ws_1', 'u_1', 't_1', { assigneeKind: 'person', assigneeId: 'u_9' });
    const current = (await service.history('ws_1', 'u_1', 't_1')).filter((h) => h.supersededAt === null);
    expect(current.map((h) => h.id)).toEqual([b.id]);
  });
});
