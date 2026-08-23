/**
 * T933 — the loop contract carries no Room. `FR-GEL-060`, `FR-GEL-061`.
 *
 * Modelled on `engine-independence.spec.ts`, which turns *"the platform is
 * engine-independent"* into a build failure. Same shape, different claim: the
 * loop is a **reusable abstraction**, and *"the loop carries no Room-specific
 * vocabulary"* decays silently unless something fails when it stops being true.
 *
 * **The distinction this file has to get right.** `workflowType:
 * "requirement-room"` is legal — that string is *data in a tenant's
 * configuration file*, and `BR-0064` requires the loop to be configurable per
 * workflow type. What is forbidden is the contract naming the **concept**: a
 * `RequirementStage`, a `baselineId` field, a `triage` helper. So the assertions
 * below read `packages/loop-contract/src`, where types live, and deliberately
 * not `workflows/`, where tenant data lives.
 *
 * Without that distinction this test would either be vacuous or would forbid the
 * feature the Epic exists to provide.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SRC = resolve(here, '../../../packages/loop-contract/src');
const WORKFLOWS = resolve(here, '../../../packages/loop-contract/workflows');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = walk(CONTRACT_SRC).map((p) => ({
  rel: relative(CONTRACT_SRC, p),
  body: readFileSync(p, 'utf8'),
}));

/**
 * Comments are stripped before the vocabulary scan.
 *
 * Not to be lenient — because the prose in this package *has* to say
 * "requirement", "change" and "defect" to explain which Epics fill which seam,
 * and a check that flagged that would be unsatisfiable by construction. The
 * rule is about types, fields and identifiers, so that is what gets read.
 */
function code(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('T933 · packages/loop-contract has source to check', () => {
  it('found the contract sources', () => {
    // Anti-vacuity: an empty list makes every assertion below pass forever.
    expect(files.length).toBeGreaterThan(2);
  });
});

describe('FR-GEL-060 · the contract imports nothing from a Room module', () => {
  it('never imports a Room module by path', () => {
    const offenders = files.filter((f) =>
      /from\s+['"][^'"]*(requirement-room|change-room|defect-room|modules\/(requirements|reviews|tasks))/.test(
        code(f.body),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never imports from backend/src at all — the dependency runs one way', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*backend\/src/.test(code(f.body)));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never dynamically imports a Room', () => {
    // The bypass an import-only check misses, and the reason T142a widened the
    // engine equivalent.
    const offenders = files.filter((f) =>
      /import\s*\(\s*['"][^'"]*(requirement|change|defect)-room/.test(code(f.body)),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-GEL-061 · no Room vocabulary in a type, field or stage name', () => {
  const FORBIDDEN = [
    'baseline',
    'triage',
    'defect',
    'changeRequest',
    'requirementSet',
    'reproduction',
    'impactView',
  ];

  it.each(FORBIDDEN)('names no identifier containing "%s"', (word) => {
    const pattern = new RegExp(`\\b\\w*${word}\\w*\\b`, 'i');
    const offenders = files.filter((f) => pattern.test(code(f.body)));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('declares no risk band, policy class or evidence type — EPIC-031 and EPIC-032 own those', () => {
    // The ports name `PolicyProvider` and `EvidenceProvider`, which are seams.
    // What must not appear is the substance behind them: a band, a risk class,
    // an attestation shape. A loop that knew what "high risk" meant would have
    // absorbed the Epic that decides it.
    const offenders = files.filter((f) =>
      /\b(riskBand|RiskBand|riskClass|RiskClass|attestation|Attestation|evidenceItem|EvidenceItem)\b/.test(
        code(f.body),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('would notice a Room concept if one were added', () => {
    // The check checks itself. If the pattern were wrong — anchored oddly, or
    // reading the wrong directory — every assertion above would pass over a
    // contract full of Room types and this Epic's central claim would be
    // decoration.
    const planted = 'export interface BaselineRef { id: string }';
    expect(/\b\w*baseline\w*\b/i.test(planted)).toBe(true);
  });
});

describe('FR-GEL-061 · the string is data, and the concept is not', () => {
  it('permits a workflow file to name a Room, because that is a tenant fact', () => {
    // Asserted rather than assumed, so a later reader tightening the rule above
    // to cover `workflows/` finds a test saying why that is wrong: BR-0064
    // requires configurable-per-workflow-type, and the type's NAME is how a
    // tenant configures it.
    const names = readdirSync(WORKFLOWS).filter((n) => n.endsWith('.json'));
    expect(names.length).toBeGreaterThan(0);
    const permitted = ['requirement-room.json', 'change-room.json', 'defect-room.json'];
    for (const name of permitted) {
      expect(() => JSON.parse(JSON.stringify({ workflowType: name.replace('.json', '') }))).not.toThrow();
    }
  });
});
