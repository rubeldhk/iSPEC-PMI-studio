/**
 * `T2237` (EPIC-039, analysis P1, spec Exit Criteria) — PMI-DOC-004 §6.13
 * names `EPIC-039` as the owner of the five Integration Hub requirements it
 * delivers: `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125`, `BR-0126`.
 *
 * The SRS edit is the Project Owner's to authorise (Constitution II). It was
 * made on the Project Owner's instruction *"finish EPIC-039"* of 2026-10-11,
 * recorded in `specs/039-integration-hub/closure.md` and the commit that made
 * it. The same shape as `EPIC-047`'s `T1993` (`BR-0101`, `BR-0105`).
 *
 * The check reads the requirement's own line, so an owner written anywhere
 * else — a table, a note — does not satisfy it; and it asserts the line no
 * longer says *no owner*.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const BRS = readFileSync(join(REPO_ROOT, 'SRS', 'PMI-DOC-004_Business_Requirement_Specification_v2.0.md'), 'utf8');

function line(id: string, text: string = BRS): string {
  return text.split(/\r?\n/).find((l) => l.startsWith(`- **${id}**`)) ?? '';
}

function ownedByEpic039(id: string, text: string = BRS): boolean {
  const l = line(id, text);
  const owner = l.split(' → ')[1] ?? '';
  return /\*\*EPIC-039\*\*|`EPIC-039`/.test(owner) && !/no owner/.test(owner);
}

const OWNED = ['BR-0120', 'BR-0121', 'BR-0123', 'BR-0125', 'BR-0126'] as const;

describe('T2237 · PMI-DOC-004 §6.13 names EPIC-039 as owner', () => {
  it.each(OWNED)('%s — its own line names EPIC-039 and no longer says "no owner"', (id) => {
    expect(line(id), `${id} is not in PMI-DOC-004`).not.toBe('');
    expect(ownedByEpic039(id), line(id)).toBe(true);
  });

  it('BR-0122 and BR-0124 keep their owners — this Epic claims only what it delivers', () => {
    expect(line('BR-0122')).toMatch(/→ `EPIC-013`/);
    expect(line('BR-0124')).toMatch(/→ `EPIC-024`, `EPIC-028`/);
  });

  it('the check can fail: an unowned line, or an owner written elsewhere, is not ownership', () => {
    const unowned = BRS.replace(line('BR-0120'), '- **BR-0120** — **Capability contracts.** Core workflows MUST … → no owner');
    expect(ownedByEpic039('BR-0120', unowned)).toBe(false);
    const elsewhere = '- **BR-0120** — **Capability contracts.** EPIC-039 delivers this. → no owner';
    expect(ownedByEpic039('BR-0120', elsewhere)).toBe(false);
  });
});
