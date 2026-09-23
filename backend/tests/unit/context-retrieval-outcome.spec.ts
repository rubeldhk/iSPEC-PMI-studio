/**
 * `T1228` (EPIC-038) — the type that makes a short read impossible to ignore.
 *
 * `R-038-3`, and behind it `R-038-2`'s finding from pgvector's own
 * documentation: **filtering is applied after the index scan**, bounded by
 * `hnsw.ef_search` (default 40). A workspace predicate is restrictive by
 * construction in a multi-tenant corpus, so a query asking for forty candidates
 * can legitimately receive eight — with nothing saying so.
 *
 * ## Why this is a type and not a log line
 *
 * A retrieval layer that quietly returns eight of forty produces a package that
 * **names no exclusions**, because the material never reached the assembler.
 * The package looks complete. `FR-CTX-035` forbids silently dropping material,
 * and this is that prohibition defeated from below.
 *
 * So `requested` and `returned` are both required, and they travel **with** the
 * candidates. A caller cannot obtain the list without also obtaining the
 * evidence of how many were asked for — which is the difference between a
 * shortfall being *reportable* and a shortfall being *reported*.
 *
 * `EPIC-035`'s `FR-DFR-064` is the same rule one Epic over: an unknown set and
 * an empty set must not behave alike.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  shortfallOf,
  type RetrievalOutcome,
} from '../../src/modules/context/retrieval/outcome.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const CODE = readFileSync(
  resolve(here, '../../src/modules/context/retrieval/outcome.types.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('T1228 · counts travel with the candidates', () => {
  it('both counts are required', () => {
    expect(CODE).toMatch(/readonly requested: number;/);
    expect(CODE).toMatch(/readonly returned: number;/);
    expect(CODE).not.toMatch(/readonly (requested|returned)\?:/);
  });

  it('and the candidate list lives on the same shape', () => {
    // The point of the type. A separate `getCounts()` is a call somebody
    // forgets, and forgetting it looks exactly like there being nothing to
    // report.
    expect(CODE).toMatch(/readonly candidates:/);
  });

  it('a full read reports no shortfall', () => {
    const outcome: RetrievalOutcome = { requested: 40, returned: 40, candidates: [] };
    expect(shortfallOf(outcome)).toBeNull();
  });

  it('a short read reports one, with both numbers', () => {
    const outcome: RetrievalOutcome = { requested: 40, returned: 8, candidates: [] };
    const shortfall = shortfallOf(outcome);
    expect(shortfall).not.toBeNull();
    expect(shortfall?.requested).toBe(40);
    expect(shortfall?.returned).toBe(8);
  });

  it('and says why it might have happened, without claiming to know', () => {
    // The honest wording: pgvector's filtering happens after the scan, so a
    // short read is *expected behaviour under a restrictive filter* rather than
    // an error. Naming the mechanism lets a reader judge; asserting a cause
    // would be a guess.
    const shortfall = shortfallOf({ requested: 40, returned: 8, candidates: [] });
    expect(shortfall?.because).toMatch(/filter|scan|ef_search/i);
  });

  it('returning MORE than requested is refused, not silently accepted', () => {
    // Not a fussy check: if it happens, the count is wrong, and every shortfall
    // computed from it afterwards is wrong in the direction that hides gaps.
    expect(() => shortfallOf({ requested: 8, returned: 40, candidates: [] })).toThrow(
      /more than requested/i,
    );
  });
});
