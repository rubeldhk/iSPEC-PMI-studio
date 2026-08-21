/**
 * T253 — cycle detection as a PURE function (FR-ENH-011).
 * Written to FAIL before T254 exists (Constitution V).
 *
 * Runs on the PATH, not only the direct edge: a two-hop or ten-hop cycle is
 * exactly as circular as A → A.
 */
import { describe, expect, it } from 'vitest';
import { wouldCreateCycle, type DependencyEdgeShape } from '../../../src/modules/dependencies/cycle-detector.js';

function edge(source: string, target: string): DependencyEdgeShape {
  return {
    source: { artifactType: 'specification', artifactId: source },
    target: { artifactType: 'specification', artifactId: target },
  };
}

describe('T253 · cycles are detected on the path (FR-ENH-011, SC-ENH-009)', () => {
  it('a direct cycle: A→B exists, B→A is refused', () => {
    expect(wouldCreateCycle([edge('a', 'b')], edge('b', 'a'))).toBe(true);
  });

  it('a two-hop cycle: A→B→C exists, C→A closes the loop', () => {
    expect(wouldCreateCycle([edge('a', 'b'), edge('b', 'c')], edge('c', 'a'))).toBe(true);
  });

  it('a multi-hop cycle: five edges deep, the closing edge is still seen', () => {
    const chain = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'e'), edge('e', 'f')];
    expect(wouldCreateCycle(chain, edge('f', 'a'))).toBe(true);
  });

  it('a diamond is NOT a cycle: A→B, A→C, B→D, C→D is legal', () => {
    const diamond = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd')];
    expect(wouldCreateCycle(diamond, edge('c', 'd'))).toBe(false);
  });

  it('an unrelated edge in a cyclic-free graph is legal', () => {
    expect(wouldCreateCycle([edge('a', 'b'), edge('b', 'c')], edge('x', 'y'))).toBe(false);
  });

  it('artifact identity is type + id — the same id under different types is not a cycle', () => {
    const existing = [
      {
        source: { artifactType: 'specification', artifactId: 'x' },
        target: { artifactType: 'requirement', artifactId: 'shared' },
      },
    ];
    const candidate = {
      source: { artifactType: 'specification', artifactId: 'shared' },
      target: { artifactType: 'specification', artifactId: 'x' },
    };
    // 'shared' the requirement and 'shared' the specification are different nodes.
    expect(wouldCreateCycle(existing, candidate)).toBe(false);
  });

  it('is pure — the edge list is not mutated', () => {
    const edges = [edge('a', 'b')];
    const snapshot = JSON.parse(JSON.stringify(edges)) as unknown;
    wouldCreateCycle(edges, edge('b', 'a'));
    expect(edges).toEqual(snapshot);
  });
});
