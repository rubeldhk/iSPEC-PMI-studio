/**
 * T632 · Checks `G-27-09`, `G-27-12`, `G-27-14` — the analysis-only boundary.
 *
 * **`G-27-09` and `G-27-14` BLOCK CI.** Every other `G-27-*` check reports.
 * That split was confirmed on 2026-08-14 and it is deliberate: these two guard
 * `FR-AMD-016` (analysis only) and `FR-AMD-017` (do not disturb work in
 * flight), the two constraints the project owner named as the scope-creep
 * concern. A reporting-only check on either would leave the boundary defended
 * by good intentions.
 *
 * `G-27-09` inspects **this epic's own commits**, not the working tree. A
 * working-tree check passes trivially once everything is committed, which would
 * make it a check that cannot fail — the failure mode this repository has now
 * hit six times.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');

/** Paths this epic may not touch. `FR-AMD-016`: analysis only. */
const PRODUCT_PATHS = [
  'backend/',
  'worker/',
  'packages/',
  'engine-adapters/',
  'agent-adapters/',
  'execution-providers/',
  'frontend/',
];

/** Where this epic legitimately writes. Naming it makes a surprise visible. */
const ALLOWED_PATHS = [
  'specs/027-ai-native-amendment/',
  'specs/003-specification-engine/',
  'specs/013-engine-api-selection/',
  'specs/README.md',
  'specs/srs-alignment.md',
  'specs/_shared/',
  'tests/governance/',
  'scripts/',
  'adr/',
  'SRS/',
  // Spec Kit's own scaffolding, written by the tooling when a task list is
  // generated. Constitution I exempts `.specify/**` explicitly.
  '.specify/',
  'package.json',
  'pnpm-lock.yaml',
  'vitest.workspace.ts',
  '.gitignore',
  // DEF-027-005 — CI configuration, added 2026-08-19.
  //
  // The same category as `package.json`, `vitest.workspace.ts` and `.gitignore`
  // above: repository infrastructure, not product source. `PRODUCT_PATHS` is the
  // boundary `SC-AMD-009` and `FR-AMD-016` actually draw, and `.github/` is not
  // in it — so this completes a list of non-product paths rather than widening
  // the product one.
  //
  // Needed because fixing `G-27-09` itself required setting `fetch-depth: 0`,
  // and that commit — correctly labelled `fix(EPIC-027)` — was then judged by
  // the very check it repaired. Relabelling the commit to dodge the rule was
  // the alternative, and renaming a commit to satisfy a gate is worse than
  // naming the path.
  '.github/workflows/',
];

/**
 * The one recorded exception — `DEF-027-002`.
 *
 * `f356ba3`, this epic's first commit, created
 * `engine-adapters/fixture/src/fixture.adapter.ts`. The file itself is
 * legitimate: it belongs to EPIC-003 `T465`, which asked for exactly that path.
 * It was committed under an EPIC-027 message, which made an analysis-only epic
 * the author of product code.
 *
 * Listed here rather than excluded by a date range, because a date range hides
 * the thing it excludes. An allowlist with one entry and a stated reason stays
 * visible forever; any OTHER product file fails and blocks CI.
 */
const RECORDED_EXCEPTIONS: readonly { commit: string; file: string }[] = [
  { commit: 'f356ba3', file: 'engine-adapters/fixture/src/fixture.adapter.ts' },
];

interface PreservedChange {
  element: string;
  reason: string;
  affected_requirement: string;
  migration_impact: string;
  compatibility_impact: string;
  alternative_considered: string;
}
interface EpicStatusChange {
  epic: string;
  from: string;
  to: string;
  reason: string;
  clause: string;
}

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      preserved_element_changes: PreservedChange[];
      epic_status_changes: EpicStatusChange[];
    })
  : { preserved_element_changes: [], epic_status_changes: [] };

const preserved = projection.preserved_element_changes ?? [];
const statusChanges = projection.epic_status_changes ?? [];

function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

/**
 * Commits whose SUBJECT names this epic.
 *
 * `--grep` searches the whole message, which matched every commit that merely
 * *mentioned* EPIC-027 in its body — including EPIC-026's and EPIC-028's. The
 * subject line is what attributes a commit to an epic in this repository.
 */
function epicCommits(): string[] {
  return git(['log', '--format=%H|%s', '--all'])
    .split(/\r?\n/)
    .filter((line) => line.includes('(EPIC-027)'))
    .map((line) => line.split('|')[0] ?? '')
    .filter(Boolean);
}

function filesIn(sha: string): string[] {
  return git(['show', '--name-only', '--format=', sha])
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);
}

const excused = (sha: string, file: string): boolean =>
  RECORDED_EXCEPTIONS.some((e) => sha.startsWith(e.commit) && file === e.file);

const commits = epicCommits();

describe('G-27-09 · zero product source changed by this epic (SC-AMD-009) — BLOCKS CI', () => {
  it('this epic has commits to inspect', () => {
    // Without this the checks below iterate nothing and pass, which is the
    // shape of every defect this week.
    expect(
      commits.length,
      'no EPIC-027 commits found; G-27-09 would pass by having nothing to examine',
    ).toBeGreaterThan(0);
  });

  it('no EPIC-027 commit touches product source, except the one recorded breach', () => {
    const violations: string[] = [];
    for (const sha of commits) {
      for (const file of filesIn(sha)) {
        if (!PRODUCT_PATHS.some((p) => file.startsWith(p))) continue;
        if (excused(sha, file)) continue;
        violations.push(`${sha.slice(0, 8)} -> ${file}`);
      }
    }
    expect(
      violations.slice(0, 20),
      'FR-AMD-016 bounds this epic to analysis. A reconciliation that quietly changed ' +
        'product code is not a reporting matter — this check blocks CI.',
    ).toEqual([]);
  });

  it('the recorded exception is still exactly one file, and still that file', () => {
    // If this ever fails, someone widened the allowlist. It is easier to add an
    // entry than to argue for one, so the count is asserted separately.
    expect(RECORDED_EXCEPTIONS).toHaveLength(1);
    expect(RECORDED_EXCEPTIONS[0]?.file).toBe('engine-adapters/fixture/src/fixture.adapter.ts');
  });

  it('the epic writes only where it is allowed to', () => {
    const unexpected: string[] = [];
    for (const sha of commits) {
      for (const file of filesIn(sha)) {
        if (ALLOWED_PATHS.some((p) => file.startsWith(p))) continue;
        if (excused(sha, file)) continue;
        unexpected.push(`${sha.slice(0, 8)} -> ${file}`);
      }
    }
    expect(unexpected.slice(0, 20)).toEqual([]);
  });
});

describe('G-27-12 · preserved-element changes carry all five §28 fields (FR-AMD-015)', () => {
  it('the register records at least one preserved-element change', () => {
    expect(
      preserved.length,
      'EPIC-028 changed preserved elements; this register must record them',
    ).toBeGreaterThan(0);
  });

  it.each([
    'reason',
    'affected_requirement',
    'migration_impact',
    'compatibility_impact',
    'alternative_considered',
  ] as const)('every row carries a non-empty "%s"', (field) => {
    // The migration cost and the rejected alternative are exactly the two a
    // motivated author omits, and the two that decide whether the change was
    // worth it. A row with an empty field is a change nobody weighed.
    const empty = preserved
      .filter((p) => !p[field] || String(p[field]).trim().length < 10)
      .map((p) => `${p.element} · ${field}`);
    expect(empty.slice(0, 10)).toEqual([]);
  });

  it('no alternative is recorded as "none"', () => {
    const hollow = preserved
      .filter((p) => /^(none|n\/a|not applicable)\b/i.test(String(p.alternative_considered)))
      .map((p) => p.element);
    expect(
      hollow,
      'every preserved-element change has an alternative; naming it is the point of §28',
    ).toEqual([]);
  });
});

describe('G-27-14 · no epic posture changed without a recorded reason (SC-AMD-010) — BLOCKS CI', () => {
  it('every epic_status_changes row carries all five fields', () => {
    const incomplete = statusChanges
      .filter((c) => !c.epic || !c.from || !c.to || !c.reason || !c.clause)
      .map((c) => c.epic ?? '(unnamed)');
    expect(incomplete).toEqual([]);
  });

  it("no OTHER epic's Delivery posture line was modified without a matching row", () => {
    // Scoped to other epics' spec.md deliberately. The naive version matched
    // any line containing the phrase, which caught this epic's own posture
    // line, a task description quoting the check, and prose in the register —
    // three false positives that would have trained a reader to ignore it.
    //
    // Changing an epic from held to proceeding is the single most consequential
    // thing a reconciliation could do quietly: 393 tasks across 19 epics sit
    // behind that boundary.
    const changed = new Set(statusChanges.map((c) => c.epic));
    const violations: string[] = [];

    for (const sha of commits) {
      const diff = git(['show', '--unified=0', '--format=', sha]);
      let currentFile = '';
      for (const line of diff.split(/\r?\n/)) {
        const header = /^\+\+\+ b\/(.+)$/.exec(line);
        if (header) {
          currentFile = header[1] ?? '';
          continue;
        }
        if (!/^[+-]/.test(line) || /^[+-]{3}/.test(line)) continue;
        if (!/^specs\/\d{3}-/.test(currentFile)) continue;
        if (!currentFile.endsWith('/spec.md')) continue;
        if (currentFile.startsWith('specs/027-')) continue; // this epic's own posture
        if (!/\*\*Delivery posture\*\*/.test(line)) continue;

        const epic = /specs\/(\d{3})-/.exec(currentFile)?.[1];
        if (epic && [...changed].some((e) => e.includes(epic))) continue;
        violations.push(`${sha.slice(0, 8)}: ${currentFile}`);
      }
    }

    expect(
      violations.slice(0, 10),
      "another epic's Delivery posture changed with no epic_status_changes row explaining it",
    ).toEqual([]);
  });

  it('records that nothing changed, which is the finding rather than the absence of one', () => {
    // FR-AMD-017 asks that work in flight continue. An empty table is the
    // evidence that it did: 599 clauses classified, twenty capability areas
    // assigned, and no epic's posture touched.
    expect(statusChanges).toEqual([]);
  });
});
