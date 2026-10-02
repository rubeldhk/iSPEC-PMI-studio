/**
 * `T1233` (EPIC-038) — five ports, and the split between refusing and
 * degrading is the argument.
 *
 * A test that only counted them would miss the point. **Which** absence is
 * survivable is the whole design:
 *
 * - Live state and execution history are **additions**. Missing them makes a
 *   package smaller, and the package says so (`FR-CTX-022`, `FR-CTX-015`).
 * - An embedding model, an access adjudicator and the document corpus are
 *   **preconditions**. Missing any of them makes the package *wrong* rather
 *   than smaller — and a wrong package is one nobody can tell is wrong.
 *
 * That distinction is why `EmbeddingPort` refuses instead of returning a zero
 * vector, and why `AccessPolicy` refuses instead of admitting everything. Both
 * degradations would produce a plausible-looking package: one ranked by
 * nonsense, one containing material the actor may not read.
 */
import { describe, expect, it } from 'vitest';
import {
  CONTEXT_PORTS,
  absentBehaviourOf,
  type ContextPort,
} from '../../src/modules/context/context.tokens.js';

const byName = (name: string): ContextPort | undefined =>
  CONTEXT_PORTS.find((port) => port.name === name);

describe('T1233 · five ports, each declaring what its absence does', () => {
  it('declares exactly five', () => {
    expect(CONTEXT_PORTS).toHaveLength(5);
  });

  it('three refuse and two degrade', () => {
    expect(CONTEXT_PORTS.filter((p) => p.absent === 'refuse')).toHaveLength(3);
    expect(CONTEXT_PORTS.filter((p) => p.absent === 'degrade')).toHaveLength(2);
  });

  it('and the two that degrade are the two that are additions', () => {
    // Named, not counted. A design that degraded `AccessPolicy` and refused
    // `LiveStateReader` would pass a count and invert the guarantee.
    expect(CONTEXT_PORTS.filter((p) => p.absent === 'degrade').map((p) => p.name).sort()).toEqual(
      ['ExecutionProjections', 'LiveStateReader'],
    );
  });

  it('and the three that refuse are the three preconditions', () => {
    expect(CONTEXT_PORTS.filter((p) => p.absent === 'refuse').map((p) => p.name).sort()).toEqual(
      ['AccessPolicy', 'ArtifactSource', 'EmbeddingPort'].sort(),
    );
  });

  it('every port says why its absence behaves as it does', () => {
    // A declaration with no reason is a decision nobody can review. The `because`
    // is what a later reader weighs when they are tempted to flip one.
    for (const port of CONTEXT_PORTS) {
      expect(port.because.length, `${port.name} gives no reason`).toBeGreaterThan(40);
    }
  });

  it('and names who fills it, including when the answer is nobody', () => {
    for (const port of CONTEXT_PORTS) {
      expect(port.filledBy.length, `${port.name} names no owner`).toBeGreaterThan(0);
    }
    // `FR-CTX-013` — the embedding provider has no owner anywhere in the
    // programme. Recorded as unowned rather than left blank, because a blank
    // reads as "not looked into" and this was.
    expect(byName('EmbeddingPort')?.filledBy).toMatch(/unowned/i);
  });
});

describe('T1233 · the lookup answers honestly for names nobody declared', () => {
  it('returns null rather than guessing', () => {
    // A default of `degrade` here would mean a typo'd port name silently
    // becoming survivable, which is the permissive default `FR-GEL-062` calls
    // invisible.
    expect(absentBehaviourOf('NotAPort')).toBeNull();
  });

  it('and answers for one that exists, so the check is not vacuous', () => {
    expect(absentBehaviourOf('EmbeddingPort')).toBe('refuse');
    expect(absentBehaviourOf('LiveStateReader')).toBe('degrade');
  });
});
