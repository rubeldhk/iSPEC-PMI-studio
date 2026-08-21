/**
 * T298 — the twenty-one-section structure, seeded from the source document's
 * "Standard Specification Template" VERBATIM (FR-ENH-020).
 *
 * D-16: this is the standard shape for specifications PMI Studio GENERATES
 * OR MANAGES — never this repository's own documents, which follow
 * PMI-DOC-000. Nothing here makes an existing repository specification
 * non-conformant.
 */

export const TWENTY_ONE_SECTIONS = [
  'Executive Summary',
  'Business Objectives',
  'Stakeholders',
  'Functional Requirements',
  'Non-functional Requirements',
  'Business Rules',
  'Acceptance Criteria (Gherkin/EARS)',
  'UI',
  'API Contracts',
  'Database Model',
  'Events',
  'State Machines',
  'Sequence Diagrams',
  'Security',
  'Performance',
  'AI Behaviors',
  'Validation Rules',
  'Error Handling',
  'Test Scenarios',
  'Deployment',
  'Traceability Matrix',
] as const;

export interface StructureSection {
  name: string;
  required: boolean;
}

export interface StructureDefinitionSeed {
  version: number;
  appliesTo: 'product_outputs';
  sections: StructureSection[];
}

/** Version 1: every section required — relaxation is a NEW version, not an edit. */
export const PRODUCT_STRUCTURE_V1: StructureDefinitionSeed = {
  version: 1,
  appliesTo: 'product_outputs',
  sections: TWENTY_ONE_SECTIONS.map((name) => ({ name, required: true })),
};

/** Minimal delegate — drops onto `PrismaClient.structureDefinition` at composition. */
export interface StructureDefinitionDelegate {
  upsert(args: {
    where: { appliesTo_version: { appliesTo: string; version: number } };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
}

export async function seedStructures(db: { structureDefinition: StructureDefinitionDelegate }): Promise<void> {
  await db.structureDefinition.upsert({
    where: {
      appliesTo_version: {
        appliesTo: PRODUCT_STRUCTURE_V1.appliesTo,
        version: PRODUCT_STRUCTURE_V1.version,
      },
    },
    create: {
      version: PRODUCT_STRUCTURE_V1.version,
      appliesTo: PRODUCT_STRUCTURE_V1.appliesTo,
      sections: PRODUCT_STRUCTURE_V1.sections,
    },
    update: { sections: PRODUCT_STRUCTURE_V1.sections },
  });
}
