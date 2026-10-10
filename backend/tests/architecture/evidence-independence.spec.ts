/**
 * T856r — the evidence contract carries no Room, no loop, no risk band and **no
 * verdict**. `FR-EVS-051`, `FR-EVS-052`, the `U-09` boundary.
 *
 * Modelled on `loop-independence.spec.ts`, and drawing the same line: the
 * Contract *definitions* in `packages/evidence-contract/contracts/` may name a
 * work class such as `defect-repair`, because that is data a tenant configures.
 * What is forbidden is the package's **types** naming the concept. So this reads
 * `src/`, where types live, and deliberately not `contracts/`.
 *
 * The verdict assertion is the one that matters most. `BR-0143` (the compliance
 * verdict) and `BR-0036` (spec/code convergence) are `U-09` and unowned;
 * `ADR-0022` stays Open on them. It is the boundary this Epic is most likely to
 * drift across, being the one everybody wants next — and the check is the
 * difference between a boundary and an intention.
 *
 * Comments are stripped first: the prose has to say "Room", "defect" and
 * "verdict" to explain what is excluded, and a rule that flagged that would be
 * unsatisfiable by construction.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = [
  resolve(here, '../../../packages/evidence-contract/src'),
  resolve(here, '../../src/modules/evidence'),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = SOURCES.flatMap((root) =>
  walk(root).map((p) => ({ rel: relative(resolve(here, '../../..'), p), body: readFileSync(p, 'utf8') })),
);
const contractFiles = files.filter((f) => f.rel.includes('evidence-contract'));

function code(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    // String literals are messages, not identifiers — a refusal may say "verdict".
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");
}

describe('T856r · there is source to check', () => {
  it('found the package and the module', () => {
    expect(contractFiles.length).toBeGreaterThanOrEqual(5);
    expect(files.length).toBeGreaterThan(contractFiles.length);
  });
});

describe('FR-EVS-052 · no Room, loop or policy module is imported', () => {
  it('never imports a Room module', () => {
    const offenders = files.filter((f) =>
      /from\s+['"][^'"]*(requirement-room|change-room|defect-room|room-contract)/.test(
        f.body.replace(/\/\*[\s\S]*?\*\//g, ''),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('never imports the loop or the decision engine — they consume this, not the reverse', () => {
    const offenders = files.filter((f) =>
      /from\s+['"][^'"]*(loop-contract|modules\/loop|modules\/decisions?|decision-contract)/.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('the package never imports backend code — the dependency runs one way', () => {
    const offenders = contractFiles.filter((f) => /from\s+['"][^'"]*backend/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-EVS-052 · no Room vocabulary, loop stage or risk band in an identifier', () => {
  const FORBIDDEN = ['baseline', 'triage', 'defect', 'changeRequest', 'reproduction', 'riskBand', 'riskClass', 'loopStage'];

  it.each(FORBIDDEN)('names no identifier containing "%s"', (word) => {
    const pattern = new RegExp(`\\b\\w*${word}\\w*\\b`, 'i');
    const offenders = files.filter((f) => pattern.test(code(f.body)));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-EVS-051 · no compliance verdict — U-09 is unowned and ADR-0022 stays Open', () => {
  it('declares no verdict, compliance or convergence type', () => {
    const offenders = files.filter((f) =>
      /\b\w*(verdict|compliance|convergence|compliant)\w*\b/i.test(code(f.body)),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('would notice a verdict type if one were added — the check checks itself', () => {
    const planted = 'export type ComplianceVerdict = "compliant" | "non-compliant";';
    expect(/\b\w*(verdict|compliance)\w*\b/i.test(code(planted))).toBe(true);
  });
});
