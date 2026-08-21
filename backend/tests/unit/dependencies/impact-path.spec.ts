/**
 * T257 — impact path construction as a PURE function (FR-ENH-009, FR-ENH-010).
 * Written to FAIL before T258 exists (Constitution V).
 *
 * Every affected artifact carries the PATH and DISTANCE by which it is
 * affected — an impact list without paths tells a reader that something is
 * affected but not why.
 */
import { describe, expect, it } from 'vitest';
import { buildImpactPaths } from '../../../src/modules/dependencies/impact-path.js';
import type { DependencyEdgeShape } from '../../../src/modules/dependencies/cycle-detector.js';

function edge(source: string, target: string): DependencyEdgeShape {
  return {
    source: { artifactType: 'specification', artifactId: source },
    target: { artifactType: 'specification', artifactId: target },
  };
}

const START = { artifactType: 'specification', artifactId: 'a' };

describe('T257 · paths and distances (FR-ENH-010)', () => {
  it('A←B←C←D: impact of A returns B, C, D each with its path and distance', () => {
    // b depends on a, c on b, d on c.
    const { affected } = buildImpactPaths([edge('b', 'a'), edge('c', 'b'), edge('d', 'c')], START);
    expect(affected.map((r) => [r.artifact.artifactId, r.distance])).toEqual([
      ['b', 1],
      ['c', 2],
      ['d', 3],
    ]);
    expect(affected[2]?.path.map((p) => p.artifactId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a diamond reports each artifact once, by a shortest path', () => {
    // b and c depend on a; d depends on both b and c.
    const { affected } = buildImpactPaths(
      [edge('b', 'a'), edge('c', 'a'), edge('d', 'b'), edge('d', 'c')],
      START,
    );
    const d = affected.find((r) => r.artifact.artifactId === 'd');
    expect(affected.filter((r) => r.artifact.artifactId === 'd').length).toBe(1);
    expect(d?.distance).toBe(2);
    expect(d?.path.length).toBe(3);
  });

  it('an artifact with no dependents has an empty impact', () => {
    const { affected } = buildImpactPaths([edge('b', 'a')], {
      artifactType: 'specification',
      artifactId: 'unrelated',
    });
    expect(affected).toEqual([]);
  });

  it('direction matters: things A depends ON are not "affected by changing A"', () => {
    // a depends on u — changing a does not affect u.
    const { affected } = buildImpactPaths([edge('a', 'u')], START);
    expect(affected).toEqual([]);
  });

  it('is pure — edges are not mutated', () => {
    const edges = [edge('b', 'a')];
    const snapshot = JSON.parse(JSON.stringify(edges)) as unknown;
    buildImpactPaths(edges, START);
    expect(edges).toEqual(snapshot);
  });
});
