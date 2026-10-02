/**
 * `T1783` (EPIC-046, plan.md `link-writer.service.ts` touch-point) — a synced
 * task resolves back to its Epic.
 *
 * ## What `/speckit-converge` found
 *
 * The plan said *task→specification when one exists; **task→Epic otherwise***.
 * Only the first half was built. `epic` was not a traceability artifact type at
 * all, so a task parsed from an Epic whose `spec.md` had not synced resolved
 * back to **nothing** — and `SC-003`'s *every task resolves back through its
 * specification* quietly stopped being true for exactly the tasks this Epic
 * introduced.
 *
 * `EPIC-046`'s `Q1` is what makes it necessary: a synced task's home is its
 * Epic and its specification is optional. A traceability graph that only knows
 * about specifications has no edge for the common case.
 *
 * ## Why `epic` is not a chain stage
 *
 * `CHAIN_STAGES` is the ordered derivation chain and `chain-gap.service.ts`
 * indexes into it to decide what is up-chain of what. An Epic is a container of
 * work, not a stage of derivation — the same argument `T994n` made for `change`
 * and `FR-DFR-050` for `defect`. So `epic` joins them: a legal **target**, never
 * a source, and outside the chain.
 *
 * Written to FAIL before the edge exists.
 */
import { describe, expect, it } from 'vitest';
import {
  CHAIN_STAGES,
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
  NON_CHAIN_ARTIFACT_TYPES,
  PERMITTED_EDGES,
  assertPermittedEdge,
} from '../../../src/modules/traceability/link-writer.service.js';

describe('T1783 · epic is a traceability artifact type', () => {
  it('joins the type without joining the sequence, beside change and defect', () => {
    expect(NON_CHAIN_ARTIFACT_TYPES).toContain('epic');
  });

  it('is NOT a chain stage — an Epic contains work, it does not derive it', () => {
    expect(CHAIN_STAGES as readonly string[]).not.toContain('epic');
  });

  it('permits task → epic and nothing the other way', () => {
    expect(PERMITTED_EDGES).toContainEqual({ sourceType: 'task', targetType: 'epic' });
    expect(PERMITTED_EDGES.some((e) => e.sourceType === 'epic')).toBe(false);
  });

  it('refuses epic as a source, so it cannot enter the chain by the back door', () => {
    expect(() => assertPermittedEdge('epic', 'specification')).toThrow();
  });
});

describe('T1783 · linkTasksToEpic', () => {
  function build(): { links: LinkWriterService; store: InMemoryTraceabilityLinkStore } {
    const store = new InMemoryTraceabilityLinkStore();
    return { links: new LinkWriterService(store), store };
  }

  it('writes one link per task, back to the Epic', async () => {
    const { links } = build();
    const written = await links.linkTasksToEpic({ workspaceId: 'ws_a', epicId: 'e_1', taskIds: ['t_1', 't_2'] });
    expect(written).toHaveLength(2);
    expect(written[0]).toMatchObject({
      sourceType: 'task',
      sourceId: 't_1',
      targetType: 'epic',
      targetId: 'e_1',
      relationship: 'generated_from',
    });
  });

  it('is idempotent — a re-sync of the same tasks writes nothing new', async () => {
    const { links } = build();
    await links.linkTasksToEpic({ workspaceId: 'ws_a', epicId: 'e_1', taskIds: ['t_1'] });
    const again = await links.linkTasksToEpic({ workspaceId: 'ws_a', epicId: 'e_1', taskIds: ['t_1'] });
    expect(again).toHaveLength(0);
  });

  it('writes nothing for an empty task list rather than failing', async () => {
    const { links } = build();
    expect(await links.linkTasksToEpic({ workspaceId: 'ws_a', epicId: 'e_1', taskIds: [] })).toEqual([]);
  });

  it('does not disturb an existing task → specification link', async () => {
    // Both edges can be true at once: a synced task whose Epic later gains a
    // specification-by-sync belongs to both, and neither replaces the other.
    const { links, store } = build();
    await links.linkTasksToSpecification({ workspaceId: 'ws_a', specificationId: 's_1', taskIds: ['t_1'] });
    await links.linkTasksToEpic({ workspaceId: 'ws_a', epicId: 'e_1', taskIds: ['t_1'] });
    const all = await store.bySource('ws_a', 'task', 't_1');
    expect(all.map((l) => l.targetType).sort()).toEqual(['epic', 'specification']);
  });
});
