/**
 * T862h — attestations are never pruned by any retention path (`R-032-7`).
 *
 * Evidence for a superseded version must stay readable (`FR-EVS-012`), so no
 * retention job may reach the evidence tables. Two halves:
 *
 * - the database refuses `DELETE` on all three — asserted against PostgreSQL by
 *   `evidence-append-only.spec.ts`;
 * - and nothing outside `backend/src/modules/evidence/` names those tables or
 *   their Prisma delegates, so no job elsewhere can be written to try. Asserted
 *   here, across the backend and the worker, where retention jobs live.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const ROOTS = ['backend/src', 'worker/src'].map((r) => resolve(REPO, r));
const OWNER = resolve(REPO, 'backend/src/modules/evidence');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const outside = ROOTS.flatMap(walk).filter((p) => !p.startsWith(OWNER));
const NAMES = /\b(evidence_items|work_evidence_bindings|evidence_completion_attempts|evidenceItem|workEvidenceBinding|evidenceCompletionAttempt)\b/;

describe('T862h · R-032-7 — no retention path reaches an attestation', () => {
  it('scans the backend and the worker — anti-vacuity', () => {
    expect(outside.length).toBeGreaterThan(100);
  });

  it('names the evidence tables nowhere outside the evidence module', () => {
    const offenders = outside.filter((p) => NAMES.test(readFileSync(p, 'utf8'))).map((p) => relative(REPO, p));
    expect(offenders).toEqual([]);
  });

  it('would notice a pruning job if one were written — the check checks itself', () => {
    expect(NAMES.test('await prisma.evidenceItem.deleteMany({ where: { createdAt: { lt: cutoff } } })')).toBe(true);
  });
});
