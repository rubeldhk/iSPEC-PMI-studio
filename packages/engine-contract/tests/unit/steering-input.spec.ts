/**
 * T243 — the `SteeringInput[]` contract shape (steering-contract.md).
 * Written to FAIL before T244 exists (Constitution V).
 *
 * Plain data only, ordered broadest to narrowest — the two properties that
 * let an adapter that simply concatenates produce correct precedence without
 * understanding the hierarchy (S3), and that keep the sandbox split possible
 * (no entities, no dereferenceable identifiers).
 */
import { describe, expect, it } from 'vitest';
import {
  STEERING_SCOPE_ORDER,
  isSteeringOrdered,
  type GenerateSpecificationInput,
  type SteeringInput,
} from '../../src/index';

const ORG: SteeringInput = {
  subject: 'coding_standards',
  scopeType: 'organization',
  content: 'Framework-free services.',
  version: 1,
};
const PROJECT: SteeringInput = {
  subject: 'technology_stack',
  scopeType: 'project',
  content: 'PostgreSQL and Valkey.',
  version: 3,
};

describe('T243 · the SteeringInput shape', () => {
  it('is plain data — it survives a JSON round-trip unchanged', () => {
    const inputs: SteeringInput[] = [ORG, PROJECT];
    expect(JSON.parse(JSON.stringify(inputs))).toEqual(inputs);
  });

  it('carries exactly subject, scopeType, content, version — no identifiers to dereference', () => {
    expect(Object.keys(ORG).sort()).toEqual(['content', 'scopeType', 'subject', 'version']);
  });

  it('rides GenerateSpecificationInput as an OPTIONAL field (S4 — steering is additive)', () => {
    const without: GenerateSpecificationInput = {
      projectName: 'Apollo',
      requirements: [
        { reference: 'FR-1', description: 'd', type: 'functional', priority: 'p1' },
      ],
    };
    const withSteering: GenerateSpecificationInput = { ...without, steering: [ORG, PROJECT] };
    expect(withSteering.steering?.length).toBe(2);
    expect(without.steering).toBeUndefined();
  });
});

describe('T243 · broadest-to-narrowest ordering (S3)', () => {
  it('the scope order is the four levels, broadest first', () => {
    expect(STEERING_SCOPE_ORDER).toEqual(['organization', 'workspace', 'project', 'product']);
  });

  it('accepts a correctly ordered array (same level adjacent is fine)', () => {
    expect(isSteeringOrdered([ORG, { ...ORG, subject: 'security' }, PROJECT])).toBe(true);
    expect(isSteeringOrdered([])).toBe(true);
  });

  it('rejects an inverted array', () => {
    expect(isSteeringOrdered([PROJECT, ORG])).toBe(false);
  });
});
