/**
 * `T1566` (EPIC-044, `FR-EPB-001`–`FR-EPB-009`, `FR-EPB-045`–`FR-EPB-046`,
 * data-model.md §4) — the board read over in-memory execution rows: the
 * `BoardRead` shape, `Not started`, missing predecessors, the customer
 * profile's readiness note, `unbound`, the package version. Written to FAIL
 * before `T1567`.
 */
import { describe, expect, it } from 'vitest';
import { packageVersion } from '@pmi/epic-stage';
import { EpicStageService, type ExecutionEvidenceRow } from '../../../src/modules/epics/epic-stage.service.js';
import { InMemoryEpicStore } from '../../../src/modules/epics/epic.store.js';

const CTX = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_member' };
let seq = 0;
const row = (targetId: string, command: string, state: string, comment: string | null = null): ExecutionEvidenceRow => {
  seq += 1;
  const at = `2026-09-05T10:${String(seq).padStart(2, '0')}:00.000Z`;
  return { executionId: `exec_${seq}`, targetId, command, state, registeredAt: at, completedAt: ['registered', 'started', 'blocked'].includes(state) ? null : at, completionComment: comment };
};

async function harness(rows: ExecutionEvidenceRow[]) {
  const store = new InMemoryEpicStore();
  const base = { workspaceId: 'ws_a', projectId: 'p_a', description: '', status: 'active' as const, parentEpicId: null, splitSuffix: null, decisionCommentId: null, lastDecisionCommentId: null, createdById: 'u_owner', closedAt: null };
  const e1 = await store.create({ ...base, id: 'e1', slug: 'intake', title: 'Intake' });
  const e2 = await store.create({ ...base, id: 'e2', slug: 'review', title: 'Review' });
  const e3 = await store.create({ ...base, id: 'e3', slug: 'reports', title: 'Reports' });
  const service = new EpicStageService({ epics: store, evidence: { forProject: async () => rows }, now: () => new Date('2026-09-05T12:00:00Z') });
  return { service, store, e1, e2, e3 };
}

describe('T1566 · the board read', () => {
  it('has the BoardRead shape: every Epic in number order, unbound, the package version, the profile', async () => {
    const { service } = await harness([row('1', 'specify', 'completed'), row('2', 'specify', 'completed'), row('2', 'clarify', 'completed'), row('2', 'checklist', 'completed'), row('2', 'plan', 'completed'), row('99', 'specify', 'completed')]);
    const board = await service.board(CTX);
    expect(board.epics.map((e) => [e.number, e.stage, e.next])).toEqual([
      [1, 'Specified', '/speckit-clarify'],
      [2, 'Planned', '/speckit-tasks'],
      [3, 'Not started', '/speckit-specify'],
    ]);
    expect(board.unbound).toEqual([expect.objectContaining({ command: 'specify', targetId: '99' })]);
    expect(board.packageVersion).toBe(packageVersion());
    expect(board.profile).toBe('product');
    expect(board.columns[0]).toBe('Not started');
    expect(board.columns).toHaveLength(10);
    expect(board.epics[0]).toMatchObject({ epicId: 'e1', slug: 'intake', title: 'Intake', status: 'active', derivedFrom: 'executions' });
  });

  it('Not started: no completed execution; the open one is named as last and running (US2/AC4)', async () => {
    const { service } = await harness([row('1', 'specify', 'registered')]);
    const [e1] = (await service.board(CTX)).epics;
    expect(e1).toMatchObject({ stage: 'Not started', next: '/speckit-specify', last: { command: 'specify', outcome: 'registered' }, running: { executionId: expect.any(String) } });
  });

  it('names a missing predecessor instead of skipping it (FR-EPB-006)', async () => {
    const { service } = await harness([row('1', 'clarify', 'completed'), row('1', 'plan', 'completed')]);
    const [e1] = (await service.board(CTX)).epics;
    expect(e1?.stage).toBe('Not started');
    expect(e1?.missing).toEqual(['specify', 'checklist']);
  });

  it('a failed execution is the last one shown, and advances nothing', async () => {
    const { service } = await harness([row('1', 'specify', 'completed'), row('1', 'clarify', 'failed')]);
    const [e1] = (await service.board(CTX)).epics;
    expect(e1).toMatchObject({ stage: 'Specified', last: { command: 'clarify', outcome: 'failed' }, running: null });
  });

  it('readiness is a separate claim: n/a below Analyzed; Ready with the note under the customer profile at Analyzed, and the card moves to Ready (FR-EPB-045, FR-EPB-046)', async () => {
    const analyzed = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row('1', c, 'completed'));
    const { service } = await harness([...analyzed, row('2', 'specify', 'completed')]);
    const [e1, e2] = (await service.board(CTX)).epics;
    expect(e1).toMatchObject({ stage: 'Ready', next: '/speckit-implement', readiness: { verdict: 'Ready', note: 'no readiness conditions configured', failing: [] } });
    expect(e2?.readiness).toEqual({ verdict: 'n/a', failing: [] });
  });

  it('Implementing and Converged, with next null at the end of the journey', async () => {
    const base = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row('1', c, 'completed'));
    const { service: implementing } = await harness([...base, row('1', 'implement', 'started')]);
    expect((await implementing.board(CTX)).epics[0]).toMatchObject({ stage: 'Implementing', next: '/speckit-converge', running: { executionId: expect.any(String) } });
    const { service: converged } = await harness([...base, row('1', 'implement', 'completed'), row('1', 'converge', 'completed', 'Nothing changed.')]);
    expect((await converged.board(CTX)).epics[0]).toMatchObject({ stage: 'Converged', next: null });
  });

  it('a closed or split Epic has no next command', async () => {
    const { service, store } = await harness([row('1', 'specify', 'completed')]);
    await store.update('e1', { status: 'closed', closedAt: new Date(), updatedAt: new Date() });
    await store.update('e2', { status: 'split', updatedAt: new Date() });
    const [e1, e2] = (await service.board(CTX)).epics;
    expect(e1).toMatchObject({ stage: 'Specified', status: 'closed', next: null });
    expect(e2).toMatchObject({ stage: 'Not started', status: 'split', next: null });
  });

  it('binds 7a to the child through the parent and the suffix', async () => {
    const { service, store } = await harness([row('7a', 'specify', 'completed')]);
    const base = { workspaceId: 'ws_a', projectId: 'p_a', description: '', createdById: 'u_owner', closedAt: null, lastDecisionCommentId: null };
    await store.update('e2', { status: 'split', updatedAt: new Date() });
    // e2 is number 2; make it the parent numbered 7 by creating the tree afresh.
    const parent = await store.create({ ...base, id: 'p7', slug: 'seven', title: 'Seven', status: 'split', parentEpicId: null, splitSuffix: null, decisionCommentId: null });
    const child = await store.create({ ...base, id: 'c7a', slug: 'seven-a', title: 'Seven a', status: 'active', parentEpicId: parent.id, splitSuffix: 'a', decisionCommentId: 'cmt_1' });
    // The parent's number is whatever the store allocated; bind the row to it.
    const rows = [row(`${parent.number}a`, 'specify', 'completed')];
    const bound = new EpicStageService({ epics: store, evidence: { forProject: async () => rows } });
    const board = await bound.board(CTX);
    expect(board.epics.find((e) => e.epicId === child.id)?.stage).toBe('Specified');
    expect(board.unbound).toEqual([]);
  });

  it('stage(epicId) agrees with the board and refuses another project\'s Epic as absence', async () => {
    const { service } = await harness([row('1', 'specify', 'completed')]);
    expect((await service.stage(CTX, 'e1')).stage).toBe('Specified');
    await expect(service.stage({ ...CTX, projectId: 'p_b' }, 'e1')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('T1588 · readiness is layered, not derived: the verdict travels with every stage at or above the one before Ready', () => {
  it('an Implementing Epic still carries the customer profile verdict and note; a Specified one carries n/a', async () => {
    const base = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row('1', c, 'completed'));
    const { service } = await harness([...base, row('1', 'implement', 'started'), row('2', 'specify', 'completed')]);
    const [e1, e2] = (await service.board(CTX)).epics;
    expect(e1).toMatchObject({ stage: 'Implementing', readiness: { verdict: 'Ready', note: 'no readiness conditions configured' } });
    expect(e2?.readiness.verdict).toBe('n/a');
  });
});

describe('T1617 · the card names an unrecognised command instead of a wrong stage (spec §Edge Cases)', () => {
  it('carries unrecognised: [...] and keeps the derived stage from the commands it knows', async () => {
    const { service } = await harness([row('1', 'specify', 'completed'), row('1', 'deploy', 'completed'), row('2', 'specify', 'completed')]);
    const board = await service.board(CTX);
    expect(board.epics[0]).toMatchObject({ number: 1, stage: 'Specified', unrecognised: ['deploy'] });
    expect(board.epics[1]).toMatchObject({ number: 2, unrecognised: [] });
  });
});
