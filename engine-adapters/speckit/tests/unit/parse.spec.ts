/**
 * T087 — Spec Kit output parsing against recorded fixtures.
 *
 * The fixtures are recorded shapes, not invented ones: agent output varies with
 * the model and the Spec Kit release (RAID R-01), so the parser is permissive
 * about structure and strict about emptiness.
 */
import { describe, it, expect } from 'vitest';
import { findSpecificationPath, parseSpecification } from '../../src/parse.js';

const WELL_FORMED = `# Specification: Acme Billing

## Overview

Acme Billing issues invoices for metered usage.

## Requirements

- FR-001 The system issues an invoice per billing period.
- FR-002 The system records who approved each invoice.

## Success Criteria

- Invoices reconcile to usage within 0.5%.
`;

const NO_SUBHEADINGS = `# Specification: Minimal

A single paragraph of body text with no sub-headings at all.
`;

describe('well-formed output', () => {
  const outcome = parseSpecification(WELL_FORMED);

  it('parses', () => {
    expect(outcome.ok).toBe(true);
  });

  it('extracts the title from the top-level heading', () => {
    if (outcome.ok) expect(outcome.value.title).toBe('Specification: Acme Billing');
  });

  it('retains the raw output VERBATIM (R-007)', () => {
    // A parser fix must be able to re-derive structure without re-running the
    // engine, because re-running is a billed AI call.
    if (outcome.ok) expect(outcome.value.contentRaw).toBe(WELL_FORMED);
  });

  it('captures sections in document order', () => {
    if (outcome.ok) {
      expect(outcome.value.contentParsed['headingOrder']).toEqual([
        'Overview',
        'Requirements',
        'Success Criteria',
      ]);
    }
  });

  it('captures section bodies', () => {
    if (outcome.ok) {
      const sections = outcome.value.contentParsed['sections'] as Record<string, string>;
      expect(sections['Requirements']).toContain('FR-001');
      expect(sections['Overview']).toContain('metered usage');
    }
  });
});

describe('structural tolerance (R-01)', () => {
  it('accepts a document with a title and prose but no sub-headings', () => {
    const outcome = parseSpecification(NO_SUBHEADINGS);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const sections = outcome.value.contentParsed['sections'] as Record<string, string>;
      expect(sections['body']).toContain('single paragraph');
    }
  });

  it('accepts unfamiliar heading names', () => {
    const outcome = parseSpecification('# Title\n\n## Something Unexpected\n\nBody.\n');
    expect(outcome.ok).toBe(true);
  });

  it('accepts CRLF line endings', () => {
    const outcome = parseSpecification('# Title\r\n\r\n## Section\r\n\r\nBody.\r\n');
    expect(outcome.ok).toBe(true);
  });

  it('accepts leading whitespace before the title', () => {
    const outcome = parseSpecification('\n\n   # Title\n\n## S\n\nBody.\n');
    expect(outcome.ok).toBe(true);
  });
});

describe('empty output is a failure, never an empty specification (E6)', () => {
  it.each([['', 'entirely empty'], ['   \n\n  ', 'whitespace only']])(
    'reports empty_output for %s input',
    (raw) => {
      const outcome = parseSpecification(raw);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe('empty_output');
    },
  );
});

describe('malformed output (E6)', () => {
  it('reports malformed_output when there is no top-level heading', () => {
    const outcome = parseSpecification('Just some prose with no heading at all.\n');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('malformed_output');
  });

  it('reports malformed_output for a title with no content', () => {
    // A plausible-looking artifact with nothing in it would otherwise enter the
    // lifecycle and be approved.
    const outcome = parseSpecification('# Specification: Empty\n\n## Overview\n\n## Requirements\n');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('malformed_output');
  });

  it('reports malformed_output for agent chatter with no document', () => {
    const outcome = parseSpecification("I'll help you write that specification!\nLet me start...\n");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('malformed_output');
  });

  it('never returns a value alongside a failure (E3)', () => {
    const outcome = parseSpecification('');
    expect('value' in outcome).toBe(false);
  });
});

describe('locating the generated file', () => {
  it('finds specs/<feature>/spec.md', () => {
    expect(findSpecificationPath(['README.md', 'specs/001-acme/spec.md', 'src/x.ts'])).toBe(
      'specs/001-acme/spec.md',
    );
  });

  it('handles Windows-style separators', () => {
    expect(findSpecificationPath(['specs\\001-acme\\spec.md'])).toBe('specs\\001-acme\\spec.md');
  });

  it('picks deterministically when the agent wrote more than one', () => {
    const found = findSpecificationPath(['specs/002-b/spec.md', 'specs/001-a/spec.md']);
    expect(found).toBe('specs/001-a/spec.md');
  });

  it('returns null when nothing was written', () => {
    expect(findSpecificationPath(['README.md', 'specs/001-acme/plan.md'])).toBeNull();
  });

  it('does not mistake a plan or tasks file for a specification', () => {
    expect(findSpecificationPath(['specs/001-a/tasks.md', 'specs/001-a/plan.md'])).toBeNull();
  });
});
