/**
 * T259 — a truncated traversal ANNOUNCES itself (FR-ENH-010).
 * Written to FAIL before T260 exists (Constitution V).
 *
 * A truncated impact result that does not announce itself reads as
 * completeness — the exact failure this spec exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import { buildImpactPaths } from '../../../src/modules/dependencies/impact-path.js';
import { ImpactService } from '../../../src/modules/dependencies/impact.service.js';
import { InMemoryDependencyStore } from '../../../src/modules/dependencies/dependencies.service.js';
import type { DependencyEdgeShape } from '../../../src/modules/dependencies/cycle-detector.js';

const WS = 'ws_a';

function edge(source: string, target: string): DependencyEdgeShape {
  return {
    source: { artifactType: 'specification', artifactId: source },
    target: { artifactType: 'specification', artifactId: target },
  };
}

const CHAIN = [edge('b', 'a'), edge('c', 'b'), edge('d', 'c'), edge('e', 'd')];
const START = { artifactType: 'specification', artifactId: 'a' };

describe('T259 · bounded results say so, and never silently shorten', () => {
  it('within the bound: everything returned, bounded = false', () => {
    const result = buildImpactPaths(CHAIN, START, { maxDepth: 10 });
    expect(result.affected.length).toBe(4);
    expect(result.bounded).toBe(false);
  });

  it('past the bound: the result is cut AND bounded = true', () => {
    const result = buildImpactPaths(CHAIN, START, { maxDepth: 2 });
    expect(result.affected.map((r) => r.artifact.artifactId)).toEqual(['b', 'c']);
    expect(result.bounded).toBe(true);
  });

  it('exactly at the bound with nothing beyond: NOT reported as bounded', () => {
    const result = buildImpactPaths(CHAIN, START, { maxDepth: 4 });
    expect(result.affected.length).toBe(4);
    expect(result.bounded).toBe(false);
  });

  it('the service carries its configured bound into every answer', async () => {
    const store = new InMemoryDependencyStore();
    for (const e of CHAIN) {
      await store.append({
        id: `de_${e.source.artifactId}`,
        workspaceId: WS,
        source: e.source,
        target: e.target,
        dependencyType: 'consumes',
        createdById: 'u1',
      });
    }
    const service = new ImpactService(store, { maxDepth: 2 });
    const result = await service.impact(WS, START);
    expect(result.bounded).toBe(true);
    expect(result.affected.length).toBe(2);
  });
});
