/**
 * T735 — the decision engine carries no Room, no loop stage, no evidence type,
 * and exactly three bands. Every clause of `contracts/decision-contract.md` §8,
 * not the first one. `FR-DPE-051`, `FR-DPE-052`.
 *
 * Reads `packages/decision-contract/src` and `backend/src/modules/decision`,
 * with comments and string literals stripped: the prose has to say "baseline"
 * and "Room" to explain what is excluded, and an action type such as
 * `'requirement-room.baseline'` is **data** — the floor names it — not a type.
 * The rule is about identifiers, imports and the band set.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RISK_BANDS } from '@pmi/decision-contract';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const ROOTS = [resolve(REPO, 'packages/decision-contract/src'), resolve(REPO, 'backend/src/modules/decision')];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = ROOTS.flatMap(walk).map((p) => ({ rel: relative(REPO, p), body: readFileSync(p, 'utf8') }));
const code = (body: string) =>
  body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");

describe('T735 · there is source to check', () => {
  it('found the package and the module', () => {
    expect(files.filter((f) => f.rel.startsWith('packages')).length).toBeGreaterThanOrEqual(5);
    expect(files.filter((f) => f.rel.startsWith('backend')).length).toBeGreaterThanOrEqual(2);
  });
});

describe('FR-DPE-051 · no Room module, no Room vocabulary', () => {
  it('imports no Room module', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*(requirement-room|change-room|defect-room|room-contract)/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it.each(['requirement', 'baseline', 'triage', 'defect', 'changeRequest'])('names no identifier containing "%s"', (word) => {
    const pattern = new RegExp(`\\b\\w*${word}\\w*\\b`, 'i');
    expect(files.filter((f) => pattern.test(code(f.body))).map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-DPE-052 · no loop stage vocabulary — EPIC-030 owns it, and invokes this', () => {
  it('imports nothing from the loop', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*(loop-contract|modules\/loop)/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('names no stage type or transition field', () => {
    const offenders = files.filter((f) => /\b(LoopStage|LOOP_STAGES|toStage|fromStage)\b/.test(code(f.body)));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-DPE-052 · no evidence type beyond the EvidenceContractSource port — EPIC-032 owns them', () => {
  it('imports nothing from the evidence store or its contract', () => {
    const offenders = files.filter((f) => /from\s+['"][^'"]*(evidence-contract|modules\/evidence)/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('declares no attestation, evidence item or Evidence Contract type', () => {
    const offenders = files.filter((f) =>
      /\b(Attestation\w*|EvidenceItem\w*|EvidenceContract(?!Source)\w*|ContractItem)\b/.test(code(f.body)),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('FR-DPE-010 · exactly three bands, and no unknown', () => {
  it('RISK_BANDS has three members', () => {
    expect(RISK_BANDS.length).toBe(3);
  });

  it('no source declares a fourth band or an unknown one', () => {
    const offenders = files.filter((f) => /['"](unknown|critical|none)['"]\s*(,|\])/.test(f.body) && /RISK_BANDS|RiskBand/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('would notice Room vocabulary if it were added — the check checks itself', () => {
    expect(/\b\w*baseline\w*\b/i.test(code('export interface BaselineRef { id: string }'))).toBe(true);
  });
});
