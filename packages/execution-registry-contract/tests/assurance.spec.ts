/**
 * `T1314` (EPIC-041) — assurance is derived from the surface, by a function
 * that is total over the surface vocabulary.
 *
 * `FR-LPW-034`, `R-041-5`. The test enumerates `EXECUTION_SURFACES` and calls
 * `assuranceFor` for each, so adding a surface without a mapping fails here as
 * well as at compile time. Two values only (PMI-DOC-007 D-9).
 *
 * Written to FAIL before `T1315` exists.
 */
import { describe, expect, it } from 'vitest';
import {
  EXECUTION_ASSURANCES,
  EXECUTION_SURFACES,
  assuranceFor,
  type ExecutionAssurance,
} from '../src/index.js';

describe('T1314 · ExecutionAssurance', () => {
  it('has exactly two values', () => {
    expect([...EXECUTION_ASSURANCES]).toEqual(['managed', 'local']);
  });

  it('is total over EXECUTION_SURFACES', () => {
    for (const surface of EXECUTION_SURFACES) {
      const a: ExecutionAssurance = assuranceFor(surface);
      expect(EXECUTION_ASSURANCES, `${surface} maps to an unknown assurance`).toContain(a);
    }
  });

  it.each([
    ['managed-sandbox', 'managed'],
    ['ci-cd', 'managed'],
    ['local-cli', 'local'],
    ['mcp-client', 'local'],
    ['ide-extension', 'local'],
  ] as const)('%s → %s', (surface, expected) => {
    expect(assuranceFor(surface)).toBe(expected);
  });

  it('defaults the fixture to the weaker word', () => {
    // A fixture proves the contract; it should never make evidence look
    // stronger than a real local run would.
    expect(assuranceFor('fixture')).toBe('local');
  });
});
