/**
 * T296 — structure conformance as a PURE function (FR-ENH-020, R-017-6).
 * Written to FAIL before T297/T298/T299 exist (Constitution V).
 *
 * A validation RULE over a versioned structure definition, not a stored
 * skeleton — a missing required section produces a finding that NAMES it,
 * in the FR-023 finding shape. D-16: product outputs only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkStructureConformance,
} from '../../../src/modules/specifications/structure-conformance.service.js';
import {
  PRODUCT_STRUCTURE_V1,
  TWENTY_ONE_SECTIONS,
} from '../../../prisma/seed-structures.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

describe('T296 · the seeded structure (T298)', () => {
  it('is the twenty-one sections of the source document, in order', () => {
    expect(TWENTY_ONE_SECTIONS.length).toBe(21);
    expect(TWENTY_ONE_SECTIONS[0]).toBe('Executive Summary');
    expect(TWENTY_ONE_SECTIONS).toContain('Acceptance Criteria (Gherkin/EARS)');
    expect(TWENTY_ONE_SECTIONS[20]).toBe('Traceability Matrix');
  });

  it('applies to PRODUCT OUTPUTS only — never this repository’s documents (D-16)', () => {
    expect(PRODUCT_STRUCTURE_V1.appliesTo).toBe('product_outputs');
    expect(PRODUCT_STRUCTURE_V1.version).toBe(1);
    expect(PRODUCT_STRUCTURE_V1.sections.length).toBe(21);
  });
});

describe('T296 · conformance is a pure function producing FR-023 findings', () => {
  const definition = PRODUCT_STRUCTURE_V1;

  it('a specification carrying every required section is conformant — zero findings', () => {
    const findings = checkStructureConformance(definition, [...TWENTY_ONE_SECTIONS]);
    expect(findings).toEqual([]);
  });

  it('a missing required section produces a finding NAMING it, at a locatable position', () => {
    const headings = TWENTY_ONE_SECTIONS.filter((s) => s !== 'Security');
    const findings = checkStructureConformance(definition, headings);
    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toMatch(/Security/);
    expect(findings[0]?.location).toBe('section:Security');
    expect(findings[0]?.severity).toBe('error');
  });

  it('every missing section is reported — the first is not the only one', () => {
    const headings = TWENTY_ONE_SECTIONS.filter((s) => s !== 'Security' && s !== 'Deployment');
    const findings = checkStructureConformance(definition, headings);
    expect(findings.map((f) => f.location).sort()).toEqual(['section:Deployment', 'section:Security']);
  });

  it('an optional section may be absent without a finding', () => {
    const withOptional = {
      ...definition,
      sections: definition.sections.map((s) =>
        s.name === 'Sequence Diagrams' ? { ...s, required: false } : s,
      ),
    };
    const headings = TWENTY_ONE_SECTIONS.filter((s) => s !== 'Sequence Diagrams');
    expect(checkStructureConformance(withOptional, headings)).toEqual([]);
  });

  it('extra sections beyond the structure are NOT findings — the rule is a floor, not a cage', () => {
    const findings = checkStructureConformance(definition, [...TWENTY_ONE_SECTIONS, 'Appendix Z']);
    expect(findings).toEqual([]);
  });

  it('is pure — the definition and headings are not mutated', () => {
    const headings = [...TWENTY_ONE_SECTIONS];
    const snapshot = JSON.parse(JSON.stringify({ definition, headings })) as unknown;
    checkStructureConformance(definition, headings);
    expect({ definition, headings }).toEqual(snapshot);
  });
});

describe('T296 · the StructureDefinition model (T297)', () => {
  it('exists — versioned, ordered sections, applies_to product outputs', () => {
    const match = /model StructureDefinition \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model StructureDefinition missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/version\s+Int/);
    expect(block).toMatch(/sections\s+Json/);
    expect(block).toMatch(/appliesTo\s+String/);
    expect(block).toMatch(/@@map\("structure_definitions"\)/);
  });
});
