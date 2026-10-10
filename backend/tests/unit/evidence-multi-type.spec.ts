/**
 * T861c — an item accepting more than one type. `FR-EVS-025`.
 *
 * An item that accepts a review finding **or** an approval is met by either.
 * Evidence of a type it does not accept leaves it unmet **and says why** — the
 * screenshot someone attached is named, with what the item would have taken.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor, type EvidenceContract } from '@pmi/evidence-contract';
import { deriveStatus, type AssessedEvidence } from '../../src/modules/evidence/contract.status.js';

const REVIEW = predicateTypeFor('review-finding');
const APPROVAL = predicateTypeFor('approval');
const SCREENSHOT = predicateTypeFor('screenshot');

const contract: EvidenceContract = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [{ itemId: 'reviewed', description: 'Reviewed', acceptingPredicateTypes: [REVIEW, APPROVAL] }],
};
const subject = { artifactId: 'a1', version: 1 };
const evidence = (id: string, predicateType: string): AssessedEvidence => ({
  id,
  predicateType,
  attestedArtifactId: 'a1',
  attestedVersion: 1,
  resolution: 'resolved',
  integrity: 'valid',
});

describe('T861c · FR-EVS-025 — met by any accepting type', () => {
  it.each([
    ['a review finding', REVIEW],
    ['an approval', APPROVAL],
  ])('is met by %s', (_label, type) => {
    expect(deriveStatus(contract, [evidence('e1', type)], subject).items[0]!.state).toBe('met');
  });
});

describe('T861c · FR-EVS-025 — evidence of another type leaves it unmet, and says why', () => {
  it('names the evidence, its type and what the item accepts', () => {
    const item = deriveStatus(contract, [evidence('shot-1', SCREENSHOT)], subject).items[0]!;
    expect(item.state).toBe('unmet');
    expect(item.reason).toContain('shot-1');
    expect(item.reason).toContain(SCREENSHOT);
    expect(item.reason).toContain(REVIEW);
    expect(item.reason).toContain(APPROVAL);
  });

  it('is met once an accepted type arrives beside the wrong one', () => {
    const status = deriveStatus(contract, [evidence('shot-1', SCREENSHOT), evidence('ok', APPROVAL)], subject);
    expect(status.items[0]).toMatchObject({ state: 'met', evidenceId: 'ok' });
  });
});
