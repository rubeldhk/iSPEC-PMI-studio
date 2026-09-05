/**
 * `T1562` (EPIC-044, `FR-EPB-002`–`FR-EPB-009`, `R-044-3`, `R-044-4`) — the
 * product's evidence adapter: execution records in, an evidence map out, fed to
 * the same contiguity rule the register uses. Every rule of data-model.md §4.
 *
 * `SC-EPB-001` mutation targets, both owed at closure:
 *   (M1) let a `failed` execution count as completed → `a failed plan…` red;
 *   (M2) let `deriveStageFromEvidence` ignore gaps → `…never counts evidence above a gap` red.
 * Written to FAIL before `T1563`.
 */
import { describe, expect, it } from 'vitest';
import { bindExecutions, deriveStageFromEvidence, evidenceFromExecutions, productProfile, type ExecutionRow } from '../src/index.js';

const profile = productProfile();
let seq = 0;
const row = (command: string, state: string, over: Partial<ExecutionRow> = {}): ExecutionRow => {
  seq += 1;
  const registeredAt = `2026-09-05T10:${String(seq).padStart(2, '0')}:00.000Z`;
  return { executionId: `exec_${seq}`, command, state, registeredAt, completedAt: state === 'registered' || state === 'started' || state === 'blocked' ? null : registeredAt, completionComment: null, ...over };
};
const stageOf = (rows: ExecutionRow[]): string | null => deriveStageFromEvidence(evidenceFromExecutions(rows, profile).evidence, profile).stage;

describe('T1562 · evidenceFromExecutions — what reaches a stage', () => {
  it('a completed execution reaches its reachedBy stage; the contiguous rule applies', () => {
    expect(stageOf([row('specify', 'completed')])).toBe('Specified');
    expect(stageOf([row('specify', 'completed'), row('clarify', 'completed'), row('checklist', 'completed'), row('plan', 'completed')])).toBe('Planned');
  });

  it('a failed plan after a completed clarify leaves Clarified, and is the last execution (M1)', () => {
    const rows = [row('specify', 'completed'), row('clarify', 'completed'), row('checklist', 'completed'), row('plan', 'failed')];
    const result = evidenceFromExecutions(rows, profile);
    expect(result.evidence['Planned']).toBe(false);
    expect(stageOf(rows)).toBe('Checklisted');
    expect(result.last).toMatchObject({ command: 'plan', state: 'failed' });
    expect(result.running).toBeNull();
  });

  it('cancelled and timed-out executions are evidence of nothing', () => {
    expect(evidenceFromExecutions([row('specify', 'cancelled')], profile).evidence['Specified']).toBe(false);
    expect(evidenceFromExecutions([row('specify', 'timed-out')], profile).evidence['Specified']).toBe(false);
    expect(stageOf([row('specify', 'cancelled')])).toBeNull();
  });

  it('never counts evidence above a gap: a completed plan with no specify is missing: specify (M2)', () => {
    const result = deriveStageFromEvidence(evidenceFromExecutions([row('plan', 'completed')], profile).evidence, profile);
    expect(result.stage).toBeNull();
    expect(result.outOfOrder).toEqual(['Planned evidence present without the stage before it']);
  });

  it('partially-completed counts for implement only', () => {
    expect(evidenceFromExecutions([row('specify', 'partially-completed')], profile).evidence['Specified']).toBe(false);
    const rows = [...['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row(c, 'completed')), row('implement', 'partially-completed')];
    const evidence = evidenceFromExecutions(rows, profile).evidence;
    expect(evidence['Implementing']).toBe(true);
    expect(deriveStageFromEvidence(evidence, profile).stage).toBe('Implementing');
  });

  it('Implementing while the latest implement is registered, started or blocked — and it is running', () => {
    const base = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row(c, 'completed'));
    for (const state of ['registered', 'started', 'blocked']) {
      const rows = [...base, row('implement', state)];
      const result = evidenceFromExecutions(rows, profile);
      expect(result.evidence['Implementing'], state).toBe(true);
      expect(result.running?.command).toBe('implement');
      expect(deriveStageFromEvidence(result.evidence, profile).stage).toBe('Implementing');
    }
  });

  it('Converged only when the latest converge completed reporting no tasks.md change, and no implement came after', () => {
    const base = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row(c, 'completed'));
    base.push(row('implement', 'completed'));
    const appended = [...base, row('converge', 'completed', { completionComment: 'Changed: specs/007-intake/tasks.md. New: none.' })];
    expect(evidenceFromExecutions(appended, profile).evidence['Converged']).toBe(false);
    expect(stageOf(appended)).toBe('Implementing');
    const clean = [...base, row('converge', 'completed', { completionComment: 'Nothing changed.' })];
    expect(evidenceFromExecutions(clean, profile).evidence['Converged']).toBe(true);
    expect(stageOf(clean)).toBe('Converged');
    const otherFile = [...base, row('converge', 'completed', { completionComment: 'Changed: specs/007-intake/analysis.md. New: none.' })];
    expect(stageOf(otherFile)).toBe('Converged');
    const afterwards = [...clean, row('implement', 'registered')];
    expect(evidenceFromExecutions(afterwards, profile).evidence['Converged']).toBe(false);
    expect(stageOf(afterwards)).toBe('Implementing');
  });

  it('a completed implement with nothing after it is Implementing no longer: the stage is Ready\'s predecessor chain plus implement completed', () => {
    const rows = [...['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze'].map((c) => row(c, 'completed')), row('implement', 'completed')];
    const evidence = evidenceFromExecutions(rows, profile).evidence;
    // A completed implement reaches Implementing as a stage; it is Converged only after a clean converge.
    expect(evidence['Implementing']).toBe(true);
    expect(evidence['Converged']).toBe(false);
  });

  it('last is the newest execution whatever its outcome; running is the newest non-terminal one', () => {
    const rows = [row('specify', 'completed'), row('clarify', 'registered')];
    const result = evidenceFromExecutions(rows, profile);
    expect(result.last?.command).toBe('clarify');
    expect(result.running?.command).toBe('clarify');
    expect(evidenceFromExecutions([], profile)).toEqual({ evidence: Object.fromEntries(profile.map((s) => [s.name, false])), last: null, running: null });
  });

  it('is deterministic under any arrival order (FR-EPB-009)', () => {
    const rows = [row('specify', 'completed'), row('clarify', 'completed'), row('checklist', 'failed'), row('plan', 'completed'), row('implement', 'started')];
    const forward = evidenceFromExecutions(rows, profile);
    const shuffled = evidenceFromExecutions([rows[3]!, rows[0]!, rows[4]!, rows[2]!, rows[1]!], profile);
    expect(shuffled).toEqual(forward);
  });

  it('derives 500 executions in under 50 ms (SC-EPB-005)', () => {
    const rows: ExecutionRow[] = [];
    const commands = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze', 'implement', 'converge'];
    for (let i = 0; i < 500; i += 1) rows.push(row(commands[i % commands.length]!, i % 7 === 0 ? 'failed' : 'completed'));
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) deriveStageFromEvidence(evidenceFromExecutions(rows, profile).evidence, profile);
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });
});

describe('T1562 · bindExecutions — which Epic an execution belongs to (R-044-3)', () => {
  const epics = [
    { id: 'e7', number: 7 },
    { id: 'e8', number: 8, parentNumber: 7, splitSuffix: 'a' },
    { id: 'e9', number: 9, parentNumber: 7, splitSuffix: 'b' },
  ];

  it('a numeric targetId binds by number; number+letter binds through the parent and the suffix', () => {
    const rows = [
      { ...row('specify', 'completed'), targetId: '7' },
      { ...row('specify', 'completed'), targetId: '7a' },
      { ...row('specify', 'completed'), targetId: '7b' },
      { ...row('specify', 'completed'), targetId: '8' },
    ];
    const bound = bindExecutions(rows, epics);
    expect(bound.byEpic.get('e7')?.map((r) => r.targetId)).toEqual(['7']);
    expect(bound.byEpic.get('e8')?.map((r) => r.targetId)).toEqual(['7a', '8']);
    expect(bound.byEpic.get('e9')?.map((r) => r.targetId)).toEqual(['7b']);
    expect(bound.unbound).toEqual([]);
  });

  it('anything that resolves to no Epic is unbound, never attached by inference (FR-EPB-008)', () => {
    const rows = [{ ...row('specify', 'completed'), targetId: '99' }, { ...row('plan', 'completed'), targetId: '7c' }, { ...row('plan', 'completed'), targetId: 'intake' }];
    const bound = bindExecutions(rows, epics);
    expect(bound.unbound.map((r) => r.targetId)).toEqual(['99', '7c', 'intake']);
    expect([...bound.byEpic.values()].flat()).toEqual([]);
  });
});
