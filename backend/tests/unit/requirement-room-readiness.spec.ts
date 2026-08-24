/**
 * T339g — what is blocking a baseline, derived. `FR-RQR-073`, `UX-0032`,
 * data-model §8.
 *
 * *"What is blocking progress — missing evidence, pending approval, policy
 * block — MUST be visible without opening another screen."*
 *
 * **Derived, and that is the whole design.** `BaselineReadiness` is a pure
 * function of the candidates, the clarifications, the Evidence Contract and the
 * decision. Nothing is stored, so there is **no invalidation path** — no row
 * that says "ready" while the thing it was computed from has moved on.
 * `EPIC-031` reached the same conclusion for its Inbox, and `T338q`'s
 * `blocksBaseline` is the same reasoning one level down.
 *
 * **"Cannot tell" is never "ready".** An Evidence Contract that has not been
 * evaluated blocks, exactly as an unsatisfied one does. The two are different
 * *reasons* and the reader is told which — but neither is progress. A
 * projection that treated an unevaluated contract as clear would render a
 * ready baseline whose evidence nobody had looked at, which is `BR-0144`
 * inverted by omission.
 *
 * **Every blocker names its subject.** `UX-0032` asks for this to be readable
 * *without opening another screen*; a list of kinds with no subjects sends the
 * reader to another screen to find out which requirement, which question, which
 * evidence item.
 */
import { describe, expect, it } from 'vitest';
import {
  projectReadiness,
  BLOCKER_KINDS,
  type ReadinessInput,
} from '../../src/modules/requirement-room/readiness.projection.js';
import type {
  CandidateRow,
  ClarificationRow,
} from '../../src/modules/requirement-room/requirement-room.store.js';

function candidate(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: 'cand_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    normalizedText: 'A session that expires mid-review returns the reviewer to their place.',
    epistemic: 'fact',
    aiAnalysis: null,
    promotedTo: null,
    acceptanceCriteria: ['Reviewer returns to the same item after re-authentication.'],
    intendedForImplementation: true,
    createdAt: new Date('2026-08-23T00:00:00Z'),
    ...over,
  };
}

function clarification(over: Partial<ClarificationRow> = {}): ClarificationRow {
  return {
    id: 'clar_1',
    workspaceId: 'ws_1',
    roomObjectId: 'ro_1',
    candidateId: 'cand_1',
    question: 'Which role may approve a baseline?',
    askedBy: 'user_1',
    answer: null,
    answeredBy: null,
    answeredAt: null,
    blocksBaseline: true,
    createdAt: new Date('2026-08-23T00:00:00Z'),
    ...over,
  };
}

/** Everything clear. Each test spoils exactly one thing. */
function ready(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    candidates: [candidate()],
    clarifications: [clarification({ answer: 'The product owner.', answeredBy: 'user_2' })],
    evidence: { satisfied: true, unmet: [] },
    decision: { decisionId: 'rd_1' },
    ...over,
  };
}

describe('T339g · a set with nothing outstanding is ready', () => {
  it('reports ready with no blockers', () => {
    const readiness = projectReadiness(ready());

    // Anti-vacuity for every test below: if nothing could ever be ready, each
    // "blocks" assertion would hold over a projection that always blocked.
    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it('is ready only when the blocker list is empty', () => {
    const readiness = projectReadiness(ready({ decision: null }));

    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.ready).toBe(false);
  });
});

describe('T339g · the four things that block', () => {
  it('an open clarification blocks, naming the question', () => {
    const readiness = projectReadiness(ready({ clarifications: [clarification()] }));

    const blocker = readiness.blockers.find((b) => b.kind === 'open-clarification');
    expect(blocker?.detail).toMatch(/Which role may approve/);
  });

  it('a candidate lacking acceptance criteria blocks, naming the requirement', () => {
    const readiness = projectReadiness(
      ready({ candidates: [candidate({ acceptanceCriteria: null })] }),
    );

    const blocker = readiness.blockers.find((b) => b.kind === 'missing-acceptance-criteria');
    expect(blocker?.subject).toBe('cand_1');
    expect(blocker?.detail).toMatch(/expires mid-review/);
  });

  it('an unmet Evidence Contract blocks, naming what is unmet', () => {
    const readiness = projectReadiness(
      ready({ evidence: { satisfied: false, unmet: ['sign-off', 'test-run'] } }),
    );

    const blocker = readiness.blockers.find((b) => b.kind === 'unmet-evidence');
    expect(blocker?.detail).toMatch(/sign-off/);
    expect(blocker?.detail).toMatch(/test-run/);
  });

  it('a decision that has not been taken blocks', () => {
    const readiness = projectReadiness(ready({ decision: null }));

    expect(readiness.blockers.map((b) => b.kind)).toContain('pending-decision');
  });

  it('reports all four at once rather than the first', () => {
    const readiness = projectReadiness({
      candidates: [candidate({ acceptanceCriteria: [] })],
      clarifications: [clarification()],
      evidence: { satisfied: false, unmet: ['sign-off'] },
      decision: null,
    });

    // Reporting one at a time sends the reader round the loop four times, which
    // is precisely the "open another screen" UX-0032 is about.
    expect(new Set(readiness.blockers.map((b) => b.kind))).toEqual(new Set(BLOCKER_KINDS));
  });
});

describe('T339g · what does NOT block', () => {
  it('an answered clarification, without any flag being rewritten', () => {
    const answered = clarification({ answer: 'The product owner.', answeredBy: 'user_2' });

    // `blocksBaseline` still says this is a blocking KIND of question. The
    // answer is what changed. Two flags would eventually disagree.
    expect(answered.blocksBaseline).toBe(true);
    expect(projectReadiness(ready({ clarifications: [answered] })).ready).toBe(true);
  });

  it('a question attached to no candidate', () => {
    const general = clarification({ candidateId: null, blocksBaseline: false });

    expect(projectReadiness(ready({ clarifications: [general] })).ready).toBe(true);
  });

  it('a candidate declared not intended for implementation', () => {
    const readiness = projectReadiness(
      ready({
        candidates: [candidate({ acceptanceCriteria: null, intendedForImplementation: false })],
      }),
    );

    expect(readiness.ready).toBe(true);
  });
});

describe('T339g · cannot tell is never ready', () => {
  it('blocks when the Evidence Contract has not been evaluated', () => {
    const readiness = projectReadiness(ready({ evidence: null }));

    const blocker = readiness.blockers.find((b) => b.kind === 'unmet-evidence');
    expect(readiness.ready).toBe(false);
    // The reader is told WHICH of the two it is: unevaluated and unsatisfied
    // are different problems with different fixes.
    expect(blocker?.detail).toMatch(/not been evaluated|EPIC-032/);
  });

  it('distinguishes unevaluated from unsatisfied in the detail', () => {
    const unevaluated = projectReadiness(ready({ evidence: null })).blockers.find(
      (b) => b.kind === 'unmet-evidence',
    );
    const unsatisfied = projectReadiness(
      ready({ evidence: { satisfied: false, unmet: ['sign-off'] } }),
    ).blockers.find((b) => b.kind === 'unmet-evidence');

    expect(unevaluated?.detail).not.toBe(unsatisfied?.detail);
  });
});

describe('T339g · derived, with no invalidation path', () => {
  it('is a pure function — the same input gives the same answer', () => {
    const input = ready({ candidates: [candidate({ acceptanceCriteria: null })] });

    expect(projectReadiness(input)).toEqual(projectReadiness(input));
  });

  it('reads nothing it was not given', () => {
    // Two arguments would mean a store, a clock or a cache in here. `length`
    // is 1: candidates, clarifications, evidence and decision, all passed in.
    expect(projectReadiness.length).toBe(1);
  });

  it('offers no refresh, invalidate or recompute anywhere in the module', async () => {
    const module = await import('../../src/modules/requirement-room/readiness.projection.js');
    const names = Object.keys(module).filter((n) => /refresh|invalidate|recompute|cache/i.test(n));

    // A stored readiness would need one of these, and the row would go stale
    // the first time a clarification was answered by a path that forgot to
    // call it.
    expect(names).toEqual([]);
  });

  it('orders blockers stably, so the list does not reshuffle between reads', () => {
    const input: ReadinessInput = {
      candidates: [candidate({ id: 'cand_2', acceptanceCriteria: null }), candidate({ acceptanceCriteria: null })],
      clarifications: [clarification({ id: 'clar_2' }), clarification()],
      evidence: { satisfied: false, unmet: ['sign-off'] },
      decision: null,
    };

    const first = projectReadiness(input).blockers.map((b) => `${b.kind}:${b.subject}`);
    const second = projectReadiness(input).blockers.map((b) => `${b.kind}:${b.subject}`);

    expect(second).toEqual(first);
    expect(first).toEqual([...first].sort());
  });
});
