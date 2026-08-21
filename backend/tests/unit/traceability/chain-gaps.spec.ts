/**
 * T305 — a broken chain names its FIRST missing link, never a silently
 * shortened result (FR-ENH-022, SC-ENH-007).
 * Written to FAIL before T306 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import { findChainGap } from '../../../src/modules/traceability/chain-gap.service.js';

const CHAIN = [
  { sourceType: 'goal', sourceId: 'goal_1', targetType: 'vision', targetId: 'vis_1' },
  { sourceType: 'capability', sourceId: 'cap_1', targetType: 'goal', targetId: 'goal_1' },
  { sourceType: 'requirement', sourceId: 'req_1', targetType: 'capability', targetId: 'cap_1' },
  { sourceType: 'specification', sourceId: 'spec_1', targetType: 'requirement', targetId: 'req_1' },
  { sourceType: 'architecture', sourceId: 'arch_1', targetType: 'specification', targetId: 'spec_1' },
  { sourceType: 'plan', sourceId: 'plan_1', targetType: 'architecture', targetId: 'arch_1' },
  { sourceType: 'task', sourceId: 'task_1', targetType: 'plan', targetId: 'plan_1' },
  { sourceType: 'code', sourceId: 'code_1', targetType: 'task', targetId: 'task_1' },
  { sourceType: 'test', sourceId: 'test_1', targetType: 'code', targetId: 'code_1' },
  { sourceType: 'release', sourceId: 'rel_1', targetType: 'test', targetId: 'test_1' },
  { sourceType: 'operation', sourceId: 'op_1', targetType: 'release', targetId: 'rel_1' },
] as const;

const OP = { artifactType: 'operation', artifactId: 'op_1' } as const;

describe('T305 · first-missing-link reporting (FR-ENH-022, SC-ENH-007)', () => {
  it('a complete chain reaches the vision — no gap', () => {
    const gap = findChainGap([...CHAIN] as never, OP);
    expect(gap.complete).toBe(true);
    expect(gap.missingLink).toBeNull();
    expect(gap.reachedStage).toBe('vision');
  });

  it('one link removed → the traversal names EXACTLY that link, not a shorter chain', () => {
    const broken = CHAIN.filter((l) => l.sourceId !== 'plan_1'); // plan→architecture gone
    const gap = findChainGap(broken as never, OP);
    expect(gap.complete).toBe(false);
    // The chain climbed op→…→plan and stopped: the missing segment is
    // plan → architecture, named by its stages.
    expect(gap.missingLink).toEqual({ fromStage: 'plan', toStage: 'architecture' });
    expect(gap.reachedStage).toBe('plan');
  });

  it('the FIRST missing link is reported when several are absent — nearest to the start', () => {
    const broken = CHAIN.filter((l) => l.sourceId !== 'test_1' && l.sourceId !== 'cap_1');
    const gap = findChainGap(broken as never, OP);
    expect(gap.missingLink).toEqual({ fromStage: 'test', toStage: 'code' });
  });

  it('an artifact with no links at all reports its own first segment missing', () => {
    const gap = findChainGap([] as never, OP);
    expect(gap.complete).toBe(false);
    expect(gap.missingLink).toEqual({ fromStage: 'operation', toStage: 'release' });
    expect(gap.reachedStage).toBe('operation');
  });

  it('a partial result is NEVER silently returned as complete', () => {
    const broken = CHAIN.slice(0, 5); // upper chain only; nothing from op_1
    const gap = findChainGap(broken as never, OP);
    expect(gap.complete).toBe(false);
    expect(gap.missingLink).not.toBeNull();
  });
});
