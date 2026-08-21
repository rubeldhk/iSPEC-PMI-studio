/**
 * T275 — the `reviewSpecification` contract shape (review-role-contract.md).
 * Written to FAIL before T276 exists (Constitution V).
 *
 * The role is echoed by the PLATFORM, never trusted from the adapter: the
 * output shape carries findings only — no role field an adapter could forge
 * attribution through.
 */
import { describe, expect, it } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  REVIEW_CAPABILITY,
  type ReviewInput,
  type ReviewOutput,
  type SpecificationEngine,
} from '../../src/index';

const INPUT: ReviewInput = {
  specification: '# Payments\n\nThe system shall settle in one transaction.',
  role: {
    name: 'security-reviewer',
    responsibility: 'Reviews specifications for security concerns.',
    permittedArtifactTypes: ['specification'],
  },
  steering: [
    { subject: 'security', scopeType: 'organization', content: 'argon2id only.', version: 1 },
  ],
};

describe('T275 · the ReviewInput shape', () => {
  it('is plain data — survives a JSON round-trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(INPUT))).toEqual(INPUT);
  });

  it('the role rides IN as configuration (E-R6): name, responsibility, permitted types', () => {
    expect(Object.keys(INPUT.role).sort()).toEqual(
      ['name', 'permittedArtifactTypes', 'responsibility'].sort(),
    );
  });

  it('steering is optional — a review without standards is still a review', () => {
    const bare: ReviewInput = { specification: 'x', role: INPUT.role };
    expect(bare.steering).toBeUndefined();
  });
});

describe('T275 · the ReviewOutput shape — attribution is not forgeable', () => {
  it('carries findings ONLY; no role field the adapter could claim', () => {
    const output: ReviewOutput = {
      findings: [{ location: 'section:overview', severity: 'warning', message: 'Thin.' }],
    };
    expect(Object.keys(output)).toEqual(['findings']);
  });

  it('empty findings is a legal value — the pass case (E-R4)', () => {
    const pass: ReviewOutput = { findings: [] };
    expect(pass.findings).toEqual([]);
  });
});

describe('T275 · the capability (E-R5)', () => {
  it('is named, and is NOT a Phase 1 required capability — registration without it stays valid', () => {
    expect(REVIEW_CAPABILITY).toBe('review_specification');
    expect(PHASE_1_CAPABILITIES).not.toContain(REVIEW_CAPABILITY);
  });

  it('reviewSpecification is OPTIONAL on the engine interface', () => {
    // An engine with no review support satisfies the contract type unchanged.
    const engine: Pick<SpecificationEngine, 'reviewSpecification'> = {};
    expect(engine.reviewSpecification).toBeUndefined();
  });
});
