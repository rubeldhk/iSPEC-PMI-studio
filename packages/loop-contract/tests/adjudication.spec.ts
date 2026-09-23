/**
 * T1082 (EPIC-030 Phase C2A) — the proposal-adjudication contract.
 *
 * `FR-GEL-063`, `FR-GEL-064`, `FR-GEL-068`.
 *
 * **Why this contract exists.** `EPIC-037` Band A stopped before writing a line
 * of code: it needed to consume this Epic's adjudication and there was nothing
 * to consume. This Epic evaluated Governed Engineering Loop stages
 * (`Event`…`Outcome`) and exposed no specification-lifecycle proposal intake at
 * all — zero occurrences of `proposal` or `adjudicat` in the module.
 *
 * ## The distinction this file exists to keep
 *
 * A **`LoopStage`** is where a governed workflow object sits. A
 * **specification lifecycle status** is what a specification *is*. They are
 * different vocabularies for different objects, and `FR-GEL-064` forbids
 * passing one into an API typed for the other or inventing a mapping between
 * them. Conflating them would make one of the two meaningless — which is the
 * shape `FR-GEL-002` already forbids for stage vocabularies.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '../src/stages.js';
import * as adjudication from '../src/adjudication.js';
import {
  ADJUDICATION_VERDICTS,
  isAdjudicationVerdict,
  type AdjudicationProposal,
  type AdjudicationVerdict,
} from '../src/adjudication.js';

describe('T1082 · the verdict set is closed and unambiguous', () => {
  it('offers exactly the six approved verdicts', () => {
    expect([...ADJUDICATION_VERDICTS].sort()).toEqual(
      [
        'applied',
        'approval_required',
        'inconsistent',
        'reconciliation_required',
        'refused',
        'validated',
      ].sort(),
    );
  });

  it('narrows an untrusted string, and refuses anything else', () => {
    for (const verdict of ADJUDICATION_VERDICTS) {
      expect(isAdjudicationVerdict(verdict), `${verdict} should be a verdict`).toBe(true);
    }
    for (const notAVerdict of ['ok', 'true', 'pending', 'passed', '', 'APPLIED']) {
      expect(isAdjudicationVerdict(notAVerdict), `${notAVerdict} is not a verdict`).toBe(false);
    }
  });

  it('carries no boolean that could stand in for a verdict', () => {
    // `FR-GEL-068`: an outcome expressed as `approved: true` cannot distinguish
    // "valid but not applied" from "applied", which is the distinction the
    // whole adjudication turns on.
    const verdict: AdjudicationVerdict = {
      verdict: 'validated',
      proposalId: 'p1',
      reason: 'gates satisfied; policy routes application separately',
      decidedAt: '2026-08-25T00:00:00.000Z',
    };
    expect(Object.values(verdict).some((v) => typeof v === 'boolean')).toBe(false);
  });
});

describe('T1082 · a proposal carries the full governed intake', () => {
  const proposal: AdjudicationProposal = {
    proposalId: 'p1',
    executionId: 'e1',
    workspaceId: 'w1',
    specificationId: 's1',
    expectedCurrentStatus: 'draft',
    requestedStatus: 'review',
    targetVersion: 7,
    proposerId: 'u1',
    proposerType: 'human',
    proposerIdentitySnapshotId: 'snap-1',
    originatingConnector: 'fixture',
    evidenceRefs: ['ev-1'],
    reason: 'clarification complete',
    correlationId: 'c1',
    causationId: 'e1',
    idempotencyKey: 'k1',
    proposedAt: '2026-08-25T00:00:00.000Z',
  };

  it('names every field the authorisation requires', () => {
    for (const field of [
      'proposalId',
      'executionId',
      'specificationId',
      'expectedCurrentStatus',
      'requestedStatus',
      'targetVersion',
      'proposerId',
      'proposerIdentitySnapshotId',
      'originatingConnector',
      'evidenceRefs',
      'correlationId',
      'causationId',
      'idempotencyKey',
      'proposedAt',
    ]) {
      expect(proposal, `intake is missing ${field}`).toHaveProperty(field);
    }
  });

  it('carries the EXPECTED current status, which is what makes concurrency detectable', () => {
    // Without it, a stale proposal is indistinguishable from a fresh one and
    // `inconsistent` could never be returned (`FR-GEL-070`).
    expect(proposal.expectedCurrentStatus).toBeTypeOf('string');
  });
});

describe('T1082 · lifecycle status and loop stage stay distinct (FR-GEL-064)', () => {
  it('shares no member between the two vocabularies', () => {
    // If a value belonged to both, an implicit mapping would be one cast away.
    const stages = new Set<string>(LOOP_STAGES);
    for (const status of ['draft', 'review', 'approved', 'baselined', 'implemented', 'archived']) {
      expect(stages.has(status), `"${status}" is both a status and a loop stage`).toBe(false);
    }
  });

  it('offers no conversion helper in either direction', () => {
    // A `stageForStatus()` would be the implicit mapping `FR-GEL-064` forbids.
    // Asserted against the module's own exported surface rather than by review.
    const surface = Object.keys(adjudication).join(' ').toLowerCase();
    expect(surface, 'the contract exposes a status/stage conversion').not.toMatch(
      /stagefor|statusfor|tostage|tostatus/,
    );
    // Anti-vacuity: the surface must be non-empty, or this proves nothing.
    expect(Object.keys(adjudication).length).toBeGreaterThan(0);
  });
});
