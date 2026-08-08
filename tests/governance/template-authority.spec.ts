/**
 * T328 · Check G-06d — PMI-DOC-000 governs the repository templates, not the enhancement
 * document's twenty-one-section structure (FR-RGP-011, decision D-16).
 *
 * The two structures are for different things. The twenty-one-section structure governs
 * PMI Studio's *product outputs* and belongs to EPIC-017. PMI-DOC-000 §4 governs the
 * documents *this repository* writes. Confusing them would push a product-output shape
 * onto internal specs, and this check exists because that confusion is easy to make and
 * expensive to unwind across 25 epic directories.
 */
import { describe, it, expect } from 'vitest';
import { readConfig, read } from './helpers';

const config = readConfig();

const claimsProductStructure = [
  /21[- ]section/i,
  /twenty[- ]one[- ]section/i,
  /enhancement (document|model) (structure )?governs/i,
];

describe('G-06d · template authority is PMI-DOC-000 (FR-RGP-011, D-16)', () => {
  it.each(config.templates)('%s does not adopt the product 21-section structure', (template) => {
    const content = read(template);
    const offences = claimsProductStructure.filter((pattern) => pattern.test(content)).map(String);
    expect(offences, `${template} appears to follow the product output structure instead of PMI-DOC-000`).toEqual([]);
  });

  it('the conformance record names PMI-DOC-000 as the governing authority', () => {
    const record = read('governance/template-conformance.md');
    expect(record).toMatch(/PMI-DOC-000[^\n]*governs|governing (standard|authority)[^\n]*PMI-DOC-000/i);
  });

  it('the conformance record distinguishes the product structure and assigns it elsewhere', () => {
    const record = read('governance/template-conformance.md');
    expect(record).toMatch(/EPIC-017/);
    expect(record).toMatch(/product output/i);
  });

  it('measures the templates against thirteen sections, not twenty-one', () => {
    expect(config.pmiDoc000Sections.length).toBe(13);
  });
});
