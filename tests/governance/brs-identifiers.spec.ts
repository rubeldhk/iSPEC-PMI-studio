/**
 * Checks `G-BRS-01` to `G-BRS-04` — the PMI-DOC-004 v2.0 identifier guarantees.
 *
 * PMI-DOC-000 §3 makes `BR-xxxx` identifiers corpus-wide: one identifier, one
 * meaning, for the life of the corpus. PMI-DOC-004 v2.0 `RULE-16` restates it as
 * a business rule. Neither is enforceable by reading, which is the whole reason
 * this file exists.
 *
 * The history is the argument for mechanizing it. PMI-DOC-004 v1.0 §1 claimed
 * "24 business requirements" over a §6 that listed 25 — recorded as `G-36` in
 * PMI-DOC-004A. The v2.0 draft circulated for review then reused **ten** approved
 * v1.0 identifiers with different meanings, at a moment when 50 citations across
 * `specs/`, `governance/`, `adr/` and `docs/` depended on the old ones. Both
 * defects survived human review of documents whose entire subject was rigour.
 *
 * Ruling `R-01` (`specs/brs-v2-reconciliation.md` §2) resolved the collision by
 * preserving v1.0 meanings. These checks are what stop the next revision undoing
 * that silently — a re-meaned identifier produces no diff in the documents that
 * cite it, so nothing else would notice.
 *
 * Note the checks read the **document**, not a hand-maintained list. A check that
 * carries its own copy of the answer only proves the copy agrees with itself.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT, read, repoExists } from './helpers';

const BRS_V2 = 'SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md';
const BRS_V1 = 'SRS/PMI-DOC-004_Business_Requirement_Specification_v1.0.md';
const DRAFT =
  'SRS/GapAnalysis/PMI_Studio_V2_Review_Package/PMI-DOC-004_Business_Requirement_Specification_v2.0_DRAFT.md';

/** Directories that hold the governed corpus. */
const CORPUS_DIRS = ['specs', 'governance', 'adr', 'docs', 'SRS'];

/**
 * A requirement *definition* — a §6 list item, not a mention. The distinction is
 * the point: a crosswalk row citing `BR-0040` must not register as defining it.
 */
const DEFINITION = /^- \*\*BR-(\d{4})\*\*/gm;

/** Same shape, looser: the circulated draft put the em-dash inside the bold. */
const DEFINITION_LOOSE = /^- \*\*BR-(\d{4})/gm;

function definitionsIn(relativePath: string, pattern: RegExp): string[] {
  const text = read(relativePath);
  return [...text.matchAll(pattern)].map((m) => `BR-${m[1]}`);
}

function markdownFilesUnder(dir: string): string[] {
  const absolute = join(REPO_ROOT, dir);
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const next = join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.md')) found.push(next);
    }
  };
  if (repoExists(dir) && statSync(absolute).isDirectory()) walk(absolute);
  return found;
}

const v2Definitions = definitionsIn(BRS_V2, DEFINITION);
const v2Set = new Set(v2Definitions);
const v1Set = new Set(definitionsIn(BRS_V1, DEFINITION));
const brsV2Text = read(BRS_V2);

/**
 * The reserved list from §14 — identifiers the circulated draft used that this
 * revision deliberately left empty. Parsed from the document so the two cannot
 * drift; a reserved identifier is a *reservation*, never a citation.
 */
const reserved = new Set(
  (/reserved so they are never reused for a different meaning:\s*\r?\n(.+)/.exec(brsV2Text)?.[1] ?? '')
    .match(/BR-\d{4}/g) ?? [],
);

describe('G-BRS-01 · the stated requirement count is the actual one (PMI-DOC-004A G-36)', () => {
  it('defines at least one requirement', () => {
    expect(v2Definitions.length).toBeGreaterThan(0);
  });

  it('states a count in §1 that equals the number of distinct identifiers in §6', () => {
    const stated = /states \*\*(\d+) business requirements\*\*/.exec(brsV2Text)?.[1];
    expect(stated, '§1 must state the requirement count').toBeDefined();
    expect(Number(stated)).toBe(v2Set.size);
  });
});

describe('G-BRS-02 · identifiers are unique, and v1.0 meanings survive (RULE-16, ruling R-01)', () => {
  it('defines no identifier twice', () => {
    const seen = new Set<string>();
    const duplicates = v2Definitions.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(duplicates, `defined more than once: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('carries forward every identifier PMI-DOC-004 v1.0 approved', () => {
    const missing = [...v1Set].filter((id) => !v2Set.has(id)).sort();
    expect(
      missing,
      `v1.0 identifiers dropped by v2.0 — each one orphans whatever cites it: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('annotates each carried identifier as (v1.0), so a reader can see it is not new', () => {
    const unannotated = [...v1Set]
      .filter((id) => !new RegExp(`^- \\*\\*${id}\\*\\* \\*\\(v1\\.0`, 'm').test(brsV2Text))
      .sort();
    expect(unannotated, `carried but unannotated: ${unannotated.join(', ')}`).toEqual([]);
  });
});

describe('G-BRS-03 · every citation in the corpus resolves to a requirement', () => {
  it('leaves no citation pointing at an identifier that does not exist', () => {
    const unresolved: string[] = [];
    for (const dir of CORPUS_DIRS) {
      for (const file of markdownFilesUnder(dir)) {
        const relativePath = relative(REPO_ROOT, file).replace(/\\/g, '/');
        // The two documents that legitimately hold superseded numbering: v1.0 is
        // the historical baseline, and the review-package draft is the input this
        // revision corrected. Neither is a citation of current requirements.
        if (relativePath === BRS_V1 || relativePath === DRAFT) continue;
        const text = readFileSync(file, 'utf8');
        for (const id of new Set(text.match(/BR-\d{4}/g) ?? [])) {
          if (v2Set.has(id) || reserved.has(id)) continue;
          unresolved.push(`${relativePath} → ${id}`);
        }
      }
    }
    expect(unresolved, `citations with no requirement behind them:\n${unresolved.join('\n')}`).toEqual([]);
  });
});

describe('G-BRS-04 · every identifier the circulated draft used is accounted for', () => {
  it('finds each draft identifier either in use or explicitly reserved', () => {
    if (!repoExists(DRAFT)) return; // the review package may be archived away later
    const draftIds = new Set(definitionsIn(DRAFT, DEFINITION_LOOSE));
    const unaccounted = [...draftIds].filter((id) => !v2Set.has(id) && !reserved.has(id)).sort();
    expect(
      unaccounted,
      `draft identifiers neither carried nor reserved — free to be reassigned a second meaning, ` +
        `which is exactly what RULE-16 forbids: ${unaccounted.join(', ')}`,
    ).toEqual([]);
  });

  it('reserves nothing it also defines', () => {
    const both = [...reserved].filter((id) => v2Set.has(id)).sort();
    expect(both, `both reserved and defined: ${both.join(', ')}`).toEqual([]);
  });
});
