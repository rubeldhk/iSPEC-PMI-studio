/**
 * `T2307` (EPIC-048) — the versioned submission schema agents and connectors use
 * (`FR-LRN-061`), and the one parser the backend shares with them.
 *
 * `FR-LRN-010`: a submission missing source, evidence, confidence or scope is
 * refused naming **every** missing element at once — a caller fixing one
 * problem per round trip is a caller who gives up.
 */
import { describe, expect, it } from 'vitest';
import { parseSubmission, type LearningSubmissionV1 } from '../src/submission.js';

const DIGEST = 'a'.repeat(64);

function complete(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    executionId: 'exe_1',
    kind: 'new',
    statement: 'Integration tests need the local database started first.',
    category: 'test-setup',
    subject: 'integration test prerequisites',
    evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST } }],
    confidence: { level: 'medium', basis: 'Observed three failing runs without it.' },
    claimedScope: { kind: 'project', projectIds: ['p1'] },
    idempotencyKey: 'idem_1',
    correlationId: 'corr_1',
    ...over,
  };
}

describe('T2307 · parseSubmission accepts a complete submission', () => {
  it('returns the typed value', () => {
    const result = parseSubmission(complete());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value: LearningSubmissionV1 = result.value;
      expect(value.evidence).toHaveLength(1);
      expect(value.claimedScope).toEqual({ kind: 'project', projectIds: ['p1'] });
    }
  });

  it('keeps an optional proposedBand separate from anything effective', () => {
    const result = parseSubmission(complete({ proposedBand: 'low' }));
    expect(result.ok && result.value.proposedBand).toBe('low');
    expect(parseSubmission(complete({ proposedBand: 'trivial' })).ok).toBe(false);
  });
});

describe('T2307 · every missing element is named at once (FR-LRN-010)', () => {
  it('names source, evidence, confidence and scope together', () => {
    const { executionId: _e, evidence: _ev, confidence: _c, claimedScope: _s, ...rest } = complete();
    const result = parseSubmission(rest, { requireExecution: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect([...result.missing].sort()).toEqual(['confidence', 'evidence', 'scope', 'source']);
  });

  it('does not ask a person for an execution', () => {
    const { executionId: _e, ...rest } = complete();
    expect(parseSubmission(rest, { requireExecution: false }).ok).toBe(true);
  });

  it('names statement, category and subject (FR-LRN-003)', () => {
    const result = parseSubmission(complete({ statement: '', category: undefined, subject: '   ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.problems.map((p) => p.field);
      expect(fields).toEqual(expect.arrayContaining(['statement', 'category', 'subject']));
    }
  });

  it('a confidence with no basis is missing confidence', () => {
    const result = parseSubmission(complete({ confidence: { level: 'high' } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('confidence');
  });
});

describe('T2307 · evidence (FR-LRN-012)', () => {
  it('requires at least one citation', () => {
    const result = parseSubmission(complete({ evidence: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain('evidence');
  });

  it('requires a sha256 digest on every citation', () => {
    const result = parseSubmission(
      complete({
        evidence: [
          { evidenceId: 'ev_1', digest: { sha256: DIGEST } },
          { evidenceId: 'ev_2' },
          { evidenceId: 'ev_3', digest: { sha256: 'not-hex' } },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.problems.map((p) => p.field);
      expect(fields).toEqual(expect.arrayContaining(['evidence[1].digest.sha256', 'evidence[2].digest.sha256']));
    }
  });

  it('carries no payload — a citation is an id and a digest only', () => {
    const result = parseSubmission(complete({ evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST }, payload: 'copied' }] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.value.evidence[0]!).sort()).toEqual(['digest', 'evidenceId']);
  });
});

describe('T2307 · kinds and targets', () => {
  it.each(['supersede', 'deprecate', 'widen-scope'])('requires targetVersionId for %s', (kind) => {
    const result = parseSubmission(complete({ kind }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.field)).toContain('targetVersionId');
    expect(parseSubmission(complete({ kind, targetVersionId: 'kv_1' })).ok).toBe(true);
  });

  it('refuses a targetVersionId on new', () => {
    expect(parseSubmission(complete({ targetVersionId: 'kv_1' })).ok).toBe(false);
  });

  it('refuses an unknown kind', () => {
    expect(parseSubmission(complete({ kind: 'merge' })).ok).toBe(false);
  });
});

describe('T2307 · scope (FR-LRN-014)', () => {
  it('project names exactly one project', () => {
    expect(parseSubmission(complete({ claimedScope: { kind: 'project', projectIds: ['p1', 'p2'] } })).ok).toBe(false);
  });

  it('projects names at least two distinct projects', () => {
    expect(parseSubmission(complete({ claimedScope: { kind: 'projects', projectIds: ['p1'] } })).ok).toBe(false);
    expect(parseSubmission(complete({ claimedScope: { kind: 'projects', projectIds: ['p1', 'p1'] } })).ok).toBe(false);
    expect(parseSubmission(complete({ claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] } })).ok).toBe(true);
  });

  it('workspace names none', () => {
    expect(parseSubmission(complete({ claimedScope: { kind: 'workspace', projectIds: [] } })).ok).toBe(true);
    expect(parseSubmission(complete({ claimedScope: { kind: 'workspace' } })).ok).toBe(true);
    expect(parseSubmission(complete({ claimedScope: { kind: 'workspace', projectIds: ['p1'] } })).ok).toBe(false);
  });
});

describe('T2307 · versioning and controls (FR-LRN-061)', () => {
  it('requires schemaVersion 1', () => {
    expect(parseSubmission(complete({ schemaVersion: 2 })).ok).toBe(false);
    expect(parseSubmission(complete({ schemaVersion: undefined })).ok).toBe(false);
  });

  it('requires idempotencyKey and correlationId', () => {
    const result = parseSubmission(complete({ idempotencyKey: '', correlationId: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.field)).toEqual(expect.arrayContaining(['idempotencyKey', 'correlationId']));
  });

  it('refuses a confidence level outside the vocabulary and never raises one', () => {
    expect(parseSubmission(complete({ confidence: { level: 'certain', basis: 'x' } })).ok).toBe(false);
    const low = parseSubmission(complete({ confidence: { level: 'low', basis: 'a hunch' } }));
    expect(low.ok && low.value.confidence.level).toBe('low');
  });
});

describe('T2307 · it never throws', () => {
  it.each([null, undefined, 42, 'text', [], { evidence: 'nope' }, { claimedScope: 7 }, { confidence: [] }])(
    'for %j',
    (input) => {
      expect(() => parseSubmission(input)).not.toThrow();
      expect(parseSubmission(input).ok).toBe(false);
    },
  );
});
