/**
 * `T1983` (EPIC-047) — the two required mutation proofs are recorded, and the
 * guards they proved are still where they were proved.
 *
 * `SC-EXP-003`, `SC-EXP-004`, Epic Exit Criteria. A proof is evidence about a
 * line of code; if the line moves or vanishes, the proof no longer says
 * anything. So this checks both halves: the record names what was mutated and
 * what was observed failing, and the source still contains the exact guard.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const proofs = readFileSync(resolve(root, 'specs', '047-engineering-experts', 'mutation-proofs.md'), 'utf8');
const dispatch = readFileSync(resolve(root, 'backend', 'src', 'modules', 'experts', 'dispatch.service.ts'), 'utf8');

describe('T1983 · EPIC-047 mutation proofs', () => {
  it('SC-EXP-003 is recorded with its mutation, its observation and its revert', () => {
    const section = proofs.split('## 2.')[0]!;
    expect(section).toMatch(/SC-EXP-003/);
    expect(section).toMatch(/if \(byContract && false\)/);
    expect(section).toMatch(/### Observed[\s\S]*failed/);
    expect(section).toMatch(/### Reverted/);
  });

  it('SC-EXP-004 is recorded with its mutation, its observation and its revert', () => {
    const section = proofs.split('## 2.')[1] ?? '';
    expect(section).toMatch(/SC-EXP-004/);
    expect(section).toMatch(/authority = authorityOf\(contract\)/);
    expect(section).toMatch(/### Observed[\s\S]*failed/);
    expect(section).toMatch(/### Reverted/);
  });

  it('the guards the proofs bind to are still in the source', () => {
    expect(dispatch).toContain('if (byContract) throw new Refusal(byContract);');
    expect(dispatch).toContain('authority = admitted.authority;');
  });
});
