/**
 * `T1917` (EPIC-047) — a contract is complete or it is refused, naming every gap.
 *
 * `FR-EXP-010`, `FR-EXP-011`, `FR-EXP-020`. A refusal that names only the
 * first missing element sends the author round the loop once per gap; one that
 * names all of them is one fix. The memory policy is `none` or the contract is
 * refused naming Governed Learning — where cross-session memory is decided.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { validateContract } from '../../src/modules/experts/contract.validation.js';
import { contract, without } from '../helpers/expert-fixtures.js';

function refusal(input: unknown): ValidationFailedError {
  try {
    validateContract(input);
  } catch (error) {
    return error as ValidationFailedError;
  }
  throw new Error('expected a refusal');
}

describe('T1917 · contract validation', () => {
  it('accepts a complete contract and returns it', () => {
    expect(validateContract(contract())).toEqual(contract());
  });

  it('names every missing element, not just the first', () => {
    const e = refusal(without(contract(), 'rolePurpose', 'budget', 'evidenceContract'));
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect(e.details).toMatchObject({
      missing: expect.arrayContaining(['role and purpose', 'budget', 'Evidence Contract']),
    });
    expect((e.details as { missing: string[] }).missing).toHaveLength(3);
    expect(e.message).toMatch(/role and purpose.*budget.*Evidence Contract/);
  });

  it('a missing half of a two-field element names the element', () => {
    const e = refusal(without(contract(), 'allowedTools'));
    expect((e.details as { missing: string[] }).missing).toEqual(['allowed tools and capabilities']);
  });

  it('refuses a memory policy other than none, naming Governed Learning (FR-EXP-020)', () => {
    const e = refusal({ ...contract(), memoryPolicy: 'session' });
    expect(e.message).toMatch(/memory policy.*none.*Governed Learning/i);
  });

  it('refuses a preferred model repeated as a fallback', () => {
    const e = refusal(contract({ models: { preferred: 'm', fallbacks: ['m'] } }));
    expect(e.message).toMatch(/fallback/i);
  });

  it('refuses a capability outside the agent seam’s vocabulary', () => {
    const e = refusal({ ...contract(), capabilities: ['test', 'deploy-to-prod'] });
    expect(e.message).toMatch(/deploy-to-prod/);
  });

  it('refuses a risk class outside the three bands', () => {
    expect(refusal({ ...contract(), riskClass: 'extreme' }).message).toMatch(/risk class/i);
  });

  it('refuses a budget without a positive time limit — every session has one (FR-EXP-040)', () => {
    expect(refusal({ ...contract(), budget: { tokens: { value: 10 } } }).message).toMatch(/time/i);
    expect(refusal({ ...contract(), budget: { time: { value: 0 } } }).message).toMatch(/time/i);
  });

  it('refuses an unknown posture for an unenforceable limit (FR-EXP-043)', () => {
    const e = refusal({ ...contract(), budget: { time: { value: 1000, onUnenforceable: 'ignore' } } });
    expect(e.message).toMatch(/refuse.*proceed/);
  });

  it('refuses an Evidence Contract reference that is not {workClass, contractVersion ≥ 1}', () => {
    const e = refusal({ ...contract(), evidenceContract: { workClass: 'implementation', contractVersion: 0 } });
    expect(e.message).toMatch(/Evidence Contract/);
  });

  it('collects several problems into one refusal', () => {
    const e = refusal({ ...contract(), memoryPolicy: 'forever', riskClass: 'extreme' });
    expect((e.details as { problems: string[] }).problems).toHaveLength(2);
  });

  it('refuses something that is not an object at all', () => {
    expect(refusal(null)).toBeInstanceOf(ValidationFailedError);
    expect(refusal('a contract')).toBeInstanceOf(ValidationFailedError);
  });
});
