/**
 * `T2111` (EPIC-039) — versioning is a rule, not a convention (`FR-HUB-011`,
 * `FR-HUB-014`). A minor that removes or retypes anything is refused, naming
 * every difference, because a caller written against the previous minor would
 * break against it.
 *
 * Written to FAIL before `T2112`.
 */
import { describe, expect, it } from 'vitest';
import { compareContractVersions, contractDocumentErrors, type CapabilityContractDocument } from '../src/contract.js';

function base(): CapabilityContractDocument {
  return {
    name: 'ReadBuildStatus',
    major: 1,
    minor: 0,
    scope: 'project',
    changesState: false,
    description: 'test',
    requiredScope: { access: 'read', resources: ['ci.checks'] },
    errorCategories: ['adapter-fault', 'revision-not-found'],
    inputSchema: { type: 'object', additionalProperties: false, required: ['revision'], properties: { revision: { type: 'string' } } },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['state', 'final'],
      properties: { state: { type: 'string', enum: ['pending', 'success'] }, final: { type: 'boolean' } },
    },
  };
}

describe('T2111 · compareContractVersions (FR-HUB-011)', () => {
  it('accepts an additive minor: a new optional input, a new output, a new error category', () => {
    const next = base();
    next.minor = 1;
    next.inputSchema.properties!['hint'] = { type: 'string' };
    next.outputSchema.properties!['url'] = { type: 'string' };
    next.errorCategories = [...next.errorCategories, 'results-not-found'];
    expect(compareContractVersions(base(), next)).toEqual({ compatible: true, differences: [] });
  });

  it('refuses a minor that removes an output, naming it', () => {
    const next = base();
    next.minor = 1;
    delete next.outputSchema.properties!['final'];
    const r = compareContractVersions(base(), next);
    expect(r.compatible).toBe(false);
    expect(r.differences).toContain('output.final removed');
  });

  it('refuses a minor that retypes an input and drops an error category, naming each', () => {
    const next = base();
    next.minor = 1;
    next.inputSchema.properties!['revision'] = { type: 'integer' };
    next.errorCategories = ['adapter-fault'];
    const r = compareContractVersions(base(), next);
    expect(r.differences).toEqual(['input.revision retyped string → integer', 'error category revision-not-found removed']);
  });

  it('refuses a minor that adds a REQUIRED input — existing callers do not send it', () => {
    const next = base();
    next.minor = 1;
    next.inputSchema.properties!['branch'] = { type: 'string' };
    next.inputSchema.required = ['revision', 'branch'];
    expect(compareContractVersions(base(), next).differences).toEqual(['input.branch added as required']);
  });

  it('refuses a minor that narrows an output enum consumers switch on', () => {
    const next = base();
    next.minor = 1;
    next.outputSchema.properties!['state'] = { type: 'string', enum: ['pending'] };
    expect(compareContractVersions(base(), next).differences).toEqual(['output.state enum value success removed']);
  });

  it('refuses a "minor" that flips changesState, or that is not a later minor of the same major', () => {
    const flip = base();
    flip.minor = 1;
    flip.changesState = true;
    expect(compareContractVersions(base(), flip).differences).toContain('changesState changed false → true');
    const same = base();
    expect(compareContractVersions(base(), same).differences).toContain('1.0 is not a later minor of 1.0');
    const major = base();
    major.major = 2;
    expect(compareContractVersions(base(), major).differences).toContain('2.0 is a different major — a new major is not compared as a minor');
  });
});

describe('T2111 · a contract document must declare what it is (FR-HUB-014)', () => {
  it('accepts a well-formed document', () => {
    expect(contractDocumentErrors(base())).toEqual([]);
  });

  it('refuses a document that does not declare changesState', () => {
    const doc = base() as unknown as Record<string, unknown>;
    delete doc['changesState'];
    expect(contractDocumentErrors(doc)).toContain('changesState must be declared true or false');
  });

  it('refuses an unknown capability name, a bad scope resource, and an unsupported schema keyword', () => {
    const doc = base() as unknown as Record<string, unknown>;
    doc['name'] = 'ReadSecrets';
    doc['requiredScope'] = { access: 'read', resources: ['github.checks'] };
    (doc['inputSchema'] as Record<string, unknown>)['oneOf'] = [];
    const errors = contractDocumentErrors(doc);
    expect(errors).toContain('name ReadSecrets is not in the vocabulary');
    expect(errors).toContain('requiredScope.resources: github.checks is not a provider-neutral scope resource');
    expect(errors).toContain('inputSchema: oneOf at (root)');
  });

  it('refuses a scope that disagrees with the vocabulary (Embed is deployment, everything else project)', () => {
    const doc = base();
    doc.scope = 'deployment';
    expect(contractDocumentErrors(doc)).toContain('scope deployment disagrees with the vocabulary (project)');
  });
});
