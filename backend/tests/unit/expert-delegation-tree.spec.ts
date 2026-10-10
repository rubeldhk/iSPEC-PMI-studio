/**
 * `T1955` (EPIC-047) — any delegation tree is reconstructable from the record.
 *
 * `SC-EXP-005`, `SC-EXP-006`. From any session: its ancestors to the root and
 * its descendants to the leaves, each node naming its Expert and the contract
 * version it ran under. Nothing in another workspace is ever part of a tree.
 */
import { describe, expect, it } from 'vitest';
import type { ExpertSession } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { delegationTree } from '../../src/modules/experts/delegation.service.js';
import { expert, version } from '../helpers/expert-fixtures.js';

function session(executionId: string, parent: string | null, depth: number, over: Partial<ExpertSession> = {}): ExpertSession {
  return {
    executionId, workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1', delegatedFromExecutionId: parent, actorId: 'u_1',
    depth, model: 'm', usedFallback: false, fallbackReason: null,
    effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
    toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: 'succeeded',
    startedAt: `2026-10-09T09:00:0${depth}.000Z`, endedAt: `2026-10-09T09:01:0${depth}.000Z`, ...over,
  };
}

async function store(): Promise<InMemoryExpertsStore> {
  const s = new InMemoryExpertsStore();
  await s.addExpert(expert());
  await s.addVersion(version());
  for (const row of [
    session('root', null, 0),
    session('a', 'root', 1),
    session('b', 'root', 1, { startedAt: '2026-10-09T09:00:05.000Z' }),
    session('a1', 'a', 2),
    session('elsewhere', 'root', 1, { workspaceId: 'ws_2' }),
  ]) {
    await s.addSession(row);
  }
  return s;
}

describe('T1955 · the delegation tree', () => {
  it('from a middle node: ancestors to the root, descendants to the leaves', async () => {
    const tree = await delegationTree(await store(), 'ws_1', 'a');
    expect(tree.ancestors.map((n) => n.executionId)).toEqual(['root']);
    expect(tree.node.executionId).toBe('a');
    expect(tree.node.children.map((n) => n.executionId)).toEqual(['a1']);
  });

  it('from the root: the whole tree, never crossing a workspace', async () => {
    const tree = await delegationTree(await store(), 'ws_1', 'root');
    expect(tree.ancestors).toEqual([]);
    expect(tree.node.children.map((n) => n.executionId)).toEqual(['a', 'b']);
    expect(tree.node.children[0]?.children.map((n) => n.executionId)).toEqual(['a1']);
  });

  it('each node names its Expert and the version it ran under', async () => {
    const tree = await delegationTree(await store(), 'ws_1', 'a1');
    expect(tree.node).toMatchObject({ expertKey: 'test-engineer', contractVersion: 1, depth: 2, outcome: 'succeeded' });
  });
});
