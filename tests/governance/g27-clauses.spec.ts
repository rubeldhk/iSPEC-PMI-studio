/**
 * T607 · Checks `G-27-01`, `G-27-02`, `G-27-03` — the clause register.
 *
 * These three are what make `SC-AMD-001` through `SC-AMD-003` provable rather
 * than claimed. The spec is explicit about why the register is one row per
 * clause and not one row per capability:
 *
 * > *"a collapsed register cannot show what it collapsed, so a clause nobody
 * > read is indistinguishable from one that is not there."*
 *
 * The checks below are aimed at the same distinction. A clause with **no**
 * verdict and a clause with **two** are both failures, and neither is visible
 * to a reader skimming a 470-row table.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');

interface Clause {
  id: string;
  document: string;
  section: string;
  text: string;
  normativity: string;
  duplicates: string[];
}
interface Verdict {
  clause: string;
  verdict: string;
  owner: string | null;
  reasoning: string | null;
  action: string | null;
  new_identifier: string | null;
  necessity: string | null;
}

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as { clauses: Clause[]; verdicts: Verdict[] })
  : { clauses: [], verdicts: [] };

const clauses = projection.clauses ?? [];
const verdicts = projection.verdicts ?? [];

/** The five documents the amendment comprises. */
const DOCUMENTS = [
  'plan-amendment',
  'native-speckit',
  'lifecycle',
  'defect-management',
  'cosmos-learnings',
];

/** The five verdicts `FR-AMD-002` permits. Exactly one applies to each clause. */
const VERDICTS = [
  'already-covered',
  'needs-enhancement',
  'missing',
  'conflicting',
  'should-integrate',
];

const NO_COVERAGE = 'NO-EXISTING-COVERAGE';

describe('G-27-01 · every clause carries exactly one verdict (SC-AMD-001)', () => {
  it('the register is not empty — an empty register passes every check below it', () => {
    // The failure this guards is the one that looks like success: zero clauses
    // means zero orphans, zero unattributed verdicts, zero of everything.
    expect(clauses.length, 'register/clauses.md contains no rows').toBeGreaterThan(0);
  });

  it('no clause is without a verdict', () => {
    const verdicted = new Set(verdicts.map((v) => v.clause));
    const orphans = clauses.filter((c) => !verdicted.has(c.id)).map((c) => c.id);
    expect(
      orphans.slice(0, 20),
      `${orphans.length} clause(s) carry no verdict. A clause nobody read is indistinguishable ` +
        `from one that is not there, which is the whole reason this register is one row per clause.`,
    ).toEqual([]);
  });

  it('no clause carries two verdicts', () => {
    const seen = new Map<string, number>();
    for (const v of verdicts) seen.set(v.clause, (seen.get(v.clause) ?? 0) + 1);
    const doubled = [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n})`);
    expect(doubled, 'a clause with two verdicts has been classified twice, differently').toEqual([]);
  });

  it('every verdict points at a clause that exists', () => {
    const ids = new Set(clauses.map((c) => c.id));
    const dangling = verdicts.filter((v) => !ids.has(v.clause)).map((v) => v.clause);
    expect(dangling.slice(0, 20), 'verdict rows reference clause ids with no clause').toEqual([]);
  });

  it('every verdict value is one of the five FR-AMD-002 permits', () => {
    const invalid = verdicts
      .filter((v) => !VERDICTS.includes(v.verdict))
      .map((v) => `${v.clause}: "${v.verdict}"`);
    expect(invalid.slice(0, 20)).toEqual([]);
  });
});

describe('G-27-01 · the register spans all five documents', () => {
  it.each(DOCUMENTS)('%s contributes clauses', (document) => {
    // Five documents were folded into one epic (D-42). A register missing one
    // of them is the collapsed form the clarification session rejected.
    expect(
      clauses.filter((c) => c.document === document).length,
      `no clauses extracted from "${document}"`,
    ).toBeGreaterThan(0);
  });

  it('every clause names a document the amendment actually comprises', () => {
    const unknown = [...new Set(clauses.map((c) => c.document))].filter(
      (d) => !DOCUMENTS.includes(d),
    );
    expect(unknown).toEqual([]);
  });

  it('every clause records its normativity, so SHALL is distinguishable from narrative', () => {
    // The spec's own edge case: an aspirational clause becomes a design
    // principle, not a functional requirement it cannot support.
    const allowed = ['shall', 'must', 'should', 'may', 'narrative'];
    const bad = clauses
      .filter((c) => !allowed.includes(String(c.normativity)))
      .map((c) => `${c.id}: "${c.normativity}"`);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('every clause quotes text rather than leaving it blank', () => {
    const blank = clauses.filter((c) => !c.text || String(c.text).trim().length < 10).map((c) => c.id);
    expect(
      blank.slice(0, 20),
      'quote, never paraphrase — Finding A exists because a paraphrase of this corpus was wrong',
    ).toEqual([]);
  });

  it('clause ids are unique', () => {
    const seen = new Map<string, number>();
    for (const c of clauses) seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
    expect([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('every cross-linked duplicate points at a clause that exists', () => {
    const ids = new Set(clauses.map((c) => c.id));
    const dangling: string[] = [];
    for (const c of clauses) {
      for (const d of c.duplicates ?? []) if (!ids.has(d)) dangling.push(`${c.id} → ${d}`);
    }
    expect(dangling.slice(0, 20)).toEqual([]);
  });
});

describe('G-27-02 · every verdict names an owner or says none was found (SC-AMD-002)', () => {
  it('no verdict has a blank owner', () => {
    // Blank is indistinguishable from unexamined. The sentinel is a statement;
    // an empty cell is an omission, and the two must not look the same.
    const unattributed = verdicts
      .filter((v) => v.owner === null || String(v.owner).trim() === '')
      .map((v) => v.clause);
    expect(
      unattributed.slice(0, 20),
      `${unattributed.length} verdict(s) name no owner. Use the explicit ${NO_COVERAGE} sentinel ` +
        `when nothing covers the clause — a blank cell cannot be told apart from an unexamined one.`,
    ).toEqual([]);
  });

  it('every verdict records its reasoning', () => {
    const silent = verdicts
      .filter((v) => !v.reasoning || String(v.reasoning).trim().length < 10)
      .map((v) => v.clause);
    expect(silent.slice(0, 20)).toEqual([]);
  });

  it('every verdict records the resulting action', () => {
    const inert = verdicts
      .filter((v) => !v.action || String(v.action).trim().length < 4)
      .map((v) => v.clause);
    expect(inert.slice(0, 20)).toEqual([]);
  });

  it('a "missing" verdict names the epic that will own it, or the sentinel', () => {
    // Acceptance scenario 3: a missing clause names its owner rather than being
    // left unassigned, because unassigned work is work nobody is going to do.
    const unassigned = verdicts
      .filter((v) => v.verdict === 'missing' && !v.owner)
      .map((v) => v.clause);
    expect(unassigned.slice(0, 20)).toEqual([]);
  });
});

describe('G-27-03 · a new identifier justifies itself (SC-AMD-003)', () => {
  it('every new_identifier carries a necessity', () => {
    // FR-AMD-003 forbids creating an identifier where an existing one applies.
    // The necessity field is where that judgement is recorded and reviewable.
    const unjustified = verdicts
      .filter((v) => v.new_identifier && !v.necessity)
      .map((v) => `${v.clause} → ${v.new_identifier}`);
    expect(
      unjustified.slice(0, 20),
      'a new requirement identifier was created without stating why an existing one would not do',
    ).toEqual([]);
  });

  it('no verdict states a necessity without a new identifier', () => {
    // The mirror error: a justification with nothing to justify usually means
    // the identifier was dropped and the reasoning left behind.
    const orphaned = verdicts
      .filter((v) => v.necessity && !v.new_identifier)
      .map((v) => v.clause);
    expect(orphaned.slice(0, 20)).toEqual([]);
  });

  it('an "already-covered" verdict creates no new identifier at all', () => {
    // FR-AMD-003's central rule, and the PP-002 failure the spec names as this
    // epic's most likely: restating an existing requirement under a new id.
    const duplicated = verdicts
      .filter((v) => v.verdict === 'already-covered' && v.new_identifier)
      .map((v) => `${v.clause} → ${v.new_identifier}`);
    expect(duplicated.slice(0, 20)).toEqual([]);
  });
});
