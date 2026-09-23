/**
 * `T1558` (EPIC-044, `FR-EPB-006`, `FR-EPB-010`) — the contiguity rule, pure over
 * an evidence map. The same function the governance register and the product
 * board call; what it does not know is where the evidence came from.
 * Written to FAIL before `T1560`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveStageFromEvidence, evidenceFor, loadStageConfig, nextReaches, productProfile } from '../src/index.js';

const stages = loadStageConfig().stages;
const present = (...names: string[]): Record<string, boolean> => Object.fromEntries(stages.map((s) => [s.name, names.includes(s.name)]));

describe('T1558 · deriveStageFromEvidence', () => {
  it('answers the highest contiguous stage and that stage\'s own next command', () => {
    const result = deriveStageFromEvidence(present('Specified', 'Clarified', 'Checklisted', 'Planned'), stages);
    expect(result).toEqual({ stage: 'Planned', next: '/speckit-tasks', outOfOrder: [] });
  });

  it('never counts evidence above a gap, and names it (FR-EPB-006)', () => {
    const result = deriveStageFromEvidence(present('Specified', 'Clarified', 'Checklisted', 'Tasked'), stages);
    expect(result.stage).toBe('Checklisted');
    expect(result.next).toBe('/speckit-plan');
    expect(result.outOfOrder).toEqual(['Tasked evidence present without the stage before it']);
  });

  it('skips Ready — the readiness verdict is layered on top, not derived here', () => {
    const result = deriveStageFromEvidence(present('Specified', 'Clarified', 'Checklisted', 'Planned', 'Tasked', 'Analyzed'), stages);
    expect(result.stage).toBe('Analyzed');
    expect(result.next).toBe('DOR evaluation');
  });

  it('no evidence → no stage, and the first stage\'s command as next', () => {
    expect(deriveStageFromEvidence(present(), stages)).toEqual({ stage: null, next: '/speckit-clarify', outOfOrder: [] });
  });

  it('a stage whose next command does not reach the Epic\'s kind answers — (DEF-026-007)', () => {
    const planned = present('Specified', 'Clarified', 'Checklisted', 'Planned');
    expect(deriveStageFromEvidence(planned, stages, 'parent-design').next).toBe('—');
    expect(deriveStageFromEvidence(planned, stages, 'delivery').next).toBe('/speckit-tasks');
    expect(deriveStageFromEvidence(planned, stages).next).toBe('/speckit-tasks');
    const plannedStage = stages.find((s) => s.name === 'Planned')!;
    expect(nextReaches(plannedStage, 'parent-design')).toBe(false);
    expect(nextReaches(plannedStage, undefined)).toBe(true);
  });

  it('works over the product profile too: Converged is the highest stage when everything below is present', () => {
    const profile = productProfile();
    const all = Object.fromEntries(profile.map((s) => [s.name, true]));
    expect(deriveStageFromEvidence(all, profile).stage).toBe('Converged');
    expect(deriveStageFromEvidence({ ...all, Converged: false }, profile)).toMatchObject({ stage: 'Implementing', next: '/speckit-converge' });
  });

  it('agrees with the file-tree adapter on a real directory: tasks.md without plan.md is Checklisted', () => {
    const root = mkdtempSync(join(tmpdir(), 'pmi-epic-stage-derive-'));
    try {
      const epic = join(root, '007-intake');
      mkdirSync(join(epic, 'checklists'), { recursive: true });
      writeFileSync(join(epic, 'spec.md'), '# Feature Specification: Intake\n\n## Clarifications\n\n### Session 2026-09-05\n\n- No questions required.\n', 'utf8');
      writeFileSync(join(epic, 'checklists', 'requirements.md'), '- [X] done\n', 'utf8');
      writeFileSync(join(epic, 'tasks.md'), '- [ ] T001 something\n', 'utf8');
      const evidence = evidenceFor(epic);
      expect(evidence).toMatchObject({ Specified: true, Clarified: true, Checklisted: true, Planned: false, Tasked: true, Analyzed: false, Ready: false });
      expect(deriveStageFromEvidence(evidence, stages)).toEqual({ stage: 'Checklisted', next: '/speckit-plan', outOfOrder: ['Tasked evidence present without the stage before it'] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
