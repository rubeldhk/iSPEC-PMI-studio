/**
 * T286 — gate arbitration as a PURE function (FR-ENH-014, SC-ENH-004):
 * a null human_decision BLOCKS advancement regardless of findings.
 * Written to FAIL before T287/T288 exist (Constitution V).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { arbitrate } from '../../../src/modules/reviews/gate-arbitration.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

const FINDING = {
  roleId: 'security-reviewer',
  location: 'section:auth',
  severity: 'error' as const,
  message: 'Plaintext password.',
};

describe('T286 · arbitration is pure and human-gated (FR-ENH-014, SC-ENH-004)', () => {
  it('null decision + ZERO findings → still blocked. An automated verdict alone never advances', () => {
    const verdict = arbitrate({ gateFailed: false, findings: [], humanDecision: null });
    expect(verdict.advance).toBe(false);
    expect(verdict.reason).toMatch(/human|decision/i);
  });

  it('null decision + findings → blocked', () => {
    expect(
      arbitrate({ gateFailed: false, findings: [FINDING], humanDecision: null }).advance,
    ).toBe(false);
  });

  it('approved → advances, even over findings (the override path records them — T289)', () => {
    const verdict = arbitrate({ gateFailed: false, findings: [FINDING], humanDecision: 'approved' });
    expect(verdict.advance).toBe(true);
  });

  it('rejected → blocked', () => {
    expect(
      arbitrate({ gateFailed: false, findings: [], humanDecision: 'rejected' }).advance,
    ).toBe(false);
  });

  it('a FAILED gate never advances — not even approved (E-R3: failure is not a pass)', () => {
    const verdict = arbitrate({ gateFailed: true, findings: [], humanDecision: 'approved' });
    expect(verdict.advance).toBe(false);
    expect(verdict.reason).toMatch(/failed/i);
  });

  it('is pure — same input, same verdict, no mutation', () => {
    const input = { gateFailed: false, findings: [FINDING], humanDecision: null };
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    expect(arbitrate(input)).toEqual(arbitrate(input));
    expect(input).toEqual(snapshot);
  });
});

describe('T286 · the GateOutcome model is append-only (T287)', () => {
  it('exists with the decision fields and the roles-run record', () => {
    const match = /model GateOutcome \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model GateOutcome missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/specificationId\s+String/);
    expect(block).toMatch(/gateId\s+String/);
    expect(block).toMatch(/rolesRun\s+Json/);
    expect(block).toMatch(/humanDecision\s+String\?/);
    expect(block).toMatch(/decidedById\s+String\?/);
    expect(block).toMatch(/decidedAt\s+DateTime\?/);
    expect(block).toMatch(/overriddenFindings\s+Json\?/);
    expect(block).toMatch(/@@map\("gate_outcomes"\)/);
  });

  it('the migration attaches a trigger refusing UPDATE and DELETE — with the one-time decision fill excepted', () => {
    const dir = readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .find((d) =>
        /CREATE TABLE "gate_outcomes"/.test(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')),
      );
    expect(dir, 'no migration creates gate_outcomes').toBeTruthy();
    const sql = readFileSync(join(MIGRATIONS, dir!, 'migration.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TRIGGER "gate_outcomes/);
    // The decision is write-once: an UPDATE is legal ONLY when the row was
    // undecided and only the decision columns change.
    expect(sql).toMatch(/humanDecision" IS (NOT )?NULL/);
    expect(sql).toMatch(/DELETE/);
  });
});
