/**
 * T281 — every finding carries a location AND a role_id (FR-ENH-013,
 * SC-ENH-005). A finding missing either is MALFORMED OUTPUT, never stored —
 * zero unattributed findings. Written to FAIL before T282/T285 exist.
 * Asserts case C-18 at unit level.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateReviewOutput } from '../../../src/modules/reviews/gate-execution.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

describe('T281 · findings are attributed or refused (E-R2, C-18)', () => {
  it('a well-formed finding passes, stamped with the role the PLATFORM asked', () => {
    const out = validateReviewOutput(
      [{ location: 'section:auth', severity: 'error', message: 'Plaintext password.' }],
      'security-reviewer',
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.findings).toEqual([
        {
          roleId: 'security-reviewer',
          location: 'section:auth',
          severity: 'error',
          message: 'Plaintext password.',
        },
      ]);
    }
  });

  it('a finding without a location → the WHOLE result is malformed_output, nothing stored', () => {
    const out = validateReviewOutput(
      [
        { location: 'section:auth', severity: 'error', message: 'Good one.' },
        { location: '   ', severity: 'warning', message: 'Where?' },
      ],
      'security-reviewer',
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('malformed_output');
  });

  it('a finding with an unknown severity is malformed too', () => {
    const out = validateReviewOutput(
      [{ location: 'x', severity: 'catastrophic' as never, message: 'm' }],
      'qa-agent',
    );
    expect(out.ok).toBe(false);
  });

  it('an empty message is malformed — a finding must say something', () => {
    const out = validateReviewOutput(
      [{ location: 'x', severity: 'info', message: '  ' }],
      'qa-agent',
    );
    expect(out.ok).toBe(false);
  });
});

describe('T281 · the ReviewFinding model (T282)', () => {
  it('exists, bound to a gate outcome, with required role and location', () => {
    const match = /model ReviewFinding \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model ReviewFinding missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/gateOutcomeId\s+String/);
    expect(block).toMatch(/roleId\s+String\n/);
    expect(block).toMatch(/location\s+String\n/);
    // Required — no `String?` on either attribution column.
    expect(block).not.toMatch(/roleId\s+String\?/);
    expect(block).not.toMatch(/location\s+String\?/);
    expect(block).toMatch(/@@map\("review_findings"\)/);
  });
});
