/**
 * `T2403` (EPIC-048, `SC-LRN-001`, `SC-LRN-003`, `FR-LRN-027`) — the mutation
 * proofs are recorded, each with its evidence (`EPIC-035`'s precedent).
 *
 * For each of MP-1a, MP-1b, MP-2 and MP-3, `mutation-proofs.md` must carry:
 * - the mutation, as a diff;
 * - the tests that failed under it, with counts;
 * - the revert, confirmed identical by `cmp`;
 * - a status: `complete`, or `partial` naming the task that completes it — the
 *   halves that need `EPIC-031`'s engine or the decision trigger are `T2404`–`T2407`,
 *   blocked until the merges.
 *
 * A proof written from memory rather than observed is the failure this file
 * guards against; the shape is what can be checked here, and the counts are what
 * a reviewer re-runs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(here, '../../../specs/048-governed-learning/mutation-proofs.md');

function section(doc: string, id: string): string {
  const start = doc.indexOf(`## ${id} `);
  if (start < 0) return '';
  const next = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, next < 0 ? undefined : next);
}

describe('T2403 · mutation-proofs.md records the four proofs', () => {
  it('exists', () => {
    expect(existsSync(FILE)).toBe(true);
  });

  const doc = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';

  it.each(['MP-1a', 'MP-1b', 'MP-2', 'MP-3'])('%s carries a diff, failing tests with counts, a cmp-confirmed revert and a status', (id) => {
    const s = section(doc, id);
    expect(s, `no "## ${id} " section`).not.toBe('');
    expect(s).toMatch(/```diff\n[\s\S]*?\n[-+][^\n]+[\s\S]*?```/);
    expect(s).toMatch(/^- Failed: .+ — \d+ of \d+ failed/m);
    expect(s).toMatch(/cmp .+: identical/);
    expect(s).toMatch(/^\*\*Status\*\*: (complete|partial — completes with T24\d\d)/m);
  });
});
