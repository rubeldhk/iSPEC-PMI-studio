/**
 * T299 — structure conformance checking (FR-ENH-020, R-017-6).
 *
 * A PURE validation rule over a versioned structure definition. A missing
 * REQUIRED section produces a finding that names it, in the FR-023 shape
 * the platform already uses; optional sections may be absent, and extra
 * sections are never findings — the rule is a floor, not a cage.
 *
 * Framework-free (PC-1); no engine involved (this checks what an engine
 * produced, on the platform side).
 */

export interface StructureDefinitionShape {
  version: number;
  appliesTo: string;
  sections: { name: string; required: boolean }[];
}

export interface StructureFinding {
  location: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export function checkStructureConformance(
  definition: StructureDefinitionShape,
  presentHeadings: readonly string[],
): StructureFinding[] {
  const present = new Set(presentHeadings.map((h) => h.trim()));
  const findings: StructureFinding[] = [];
  for (const section of definition.sections) {
    if (!section.required) continue;
    if (present.has(section.name)) continue;
    findings.push({
      location: `section:${section.name}`,
      severity: 'error',
      message:
        `Required section "${section.name}" is missing ` +
        `(structure v${definition.version}, ${definition.appliesTo}).`,
    });
  }
  return findings;
}
