/**
 * T303 — full-chain traversal, both directions (FR-ENH-021).
 * Written to FAIL before T304 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import { traverseChain } from '../../../src/modules/traceability/chain-traversal.service.js';

/** op_1 ← rel_1 ← test_1 ← code_1 ← task_1 ← plan_1 ← arch_1 ← spec_1 ← req_1 ← cap_1 ← goal_1 ← vis_1 */
const FULL_CHAIN = [
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

describe('T303 · traversal in both directions (FR-ENH-021)', () => {
  it('UP: from the operational artifact, every intermediate link returns IN ORDER to the vision', () => {
    const result = traverseChain([...FULL_CHAIN] as never, { artifactType: 'operation', artifactId: 'op_1' }, 'up');
    expect(result.complete).toBe(true);
    expect(result.links.length).toBe(11);
    expect(result.links[0]).toMatchObject({ sourceId: 'op_1', targetId: 'rel_1' });
    expect(result.links[10]).toMatchObject({ sourceId: 'goal_1', targetId: 'vis_1' });
  });

  it('DOWN: from the vision, the chain unrolls to operations', () => {
    const result = traverseChain([...FULL_CHAIN] as never, { artifactType: 'vision', artifactId: 'vis_1' }, 'down');
    expect(result.links.length).toBe(11);
    expect(result.links[0]).toMatchObject({ sourceId: 'goal_1' });
    expect(result.links[10]).toMatchObject({ sourceId: 'op_1' });
  });

  it('an artifact with MULTIPLE parents returns all of them', () => {
    const links = [
      ...FULL_CHAIN,
      { sourceType: 'specification', sourceId: 'spec_1', targetType: 'requirement', targetId: 'req_2' },
      { sourceType: 'requirement', sourceId: 'req_2', targetType: 'capability', targetId: 'cap_1' },
    ];
    const result = traverseChain(links as never, { artifactType: 'specification', artifactId: 'spec_1' }, 'up');
    const requirementLinks = result.links.filter((l) => l.sourceId === 'spec_1');
    expect(requirementLinks.map((l) => l.targetId).sort()).toEqual(['req_1', 'req_2']);
  });

  it('a mid-chain start traverses only its own lineage, not unrelated branches', () => {
    const links = [
      ...FULL_CHAIN,
      { sourceType: 'specification', sourceId: 'spec_other', targetType: 'requirement', targetId: 'req_other' },
    ];
    const result = traverseChain(links as never, { artifactType: 'task', artifactId: 'task_1' }, 'up');
    expect(result.links.some((l) => l.sourceId === 'spec_other')).toBe(false);
  });

  it('is pure — the link list is not mutated', () => {
    const links = [...FULL_CHAIN].map((l) => ({ ...l }));
    const snapshot = JSON.parse(JSON.stringify(links)) as unknown;
    traverseChain(links as never, { artifactType: 'operation', artifactId: 'op_1' }, 'up');
    expect(links).toEqual(snapshot);
  });
});
