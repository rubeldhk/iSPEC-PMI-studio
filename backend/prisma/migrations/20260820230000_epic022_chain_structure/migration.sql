-- EPIC-022 — the twelve-link product chain and the twenty-one-section
-- structure (FR-ENH-020..022, R-017-6/R-017-7).
--
-- Enum widening uses the recreate-and-swap pattern rather than ALTER TYPE
-- ADD VALUE: new enum members cannot be USED in the same transaction that
-- adds them, and this migration both widens the types and rebuilds the
-- permitted-edges CHECK that uses the new members.

-- The old CHECK references the columns being re-typed — drop it first.
ALTER TABLE "traceability_links" DROP CONSTRAINT "trace_permitted_edges";

-- Widen TraceArtifactType to the twelve chain stages.
CREATE TYPE "TraceArtifactType_new" AS ENUM ('vision', 'goal', 'capability', 'requirement', 'specification', 'architecture', 'plan', 'task', 'code', 'test', 'release', 'operation');
ALTER TABLE "traceability_links" ALTER COLUMN "sourceType" TYPE "TraceArtifactType_new" USING ("sourceType"::text::"TraceArtifactType_new");
ALTER TABLE "traceability_links" ALTER COLUMN "targetType" TYPE "TraceArtifactType_new" USING ("targetType"::text::"TraceArtifactType_new");
ALTER TYPE "TraceArtifactType" RENAME TO "TraceArtifactType_old";
ALTER TYPE "TraceArtifactType_new" RENAME TO "TraceArtifactType";
DROP TYPE "TraceArtifactType_old";

-- Widen TraceRelationship: the two Phase 1 types stay; the twelve chain
-- link types of the source document join them.
CREATE TYPE "TraceRelationship_new" AS ENUM ('generated_from', 'derived_from', 'vision', 'goals', 'capabilities', 'requirements', 'specifications', 'architecture', 'planning', 'tasks', 'code', 'tests', 'release', 'operations');
ALTER TABLE "traceability_links" ALTER COLUMN "relationship" TYPE "TraceRelationship_new" USING ("relationship"::text::"TraceRelationship_new");
ALTER TYPE "TraceRelationship" RENAME TO "TraceRelationship_old";
ALTER TYPE "TraceRelationship_new" RENAME TO "TraceRelationship";
DROP TYPE "TraceRelationship_old";

-- R-017-7: the permitted-edges CHECK widens to the chain-adjacent pairs.
-- Every chain edge points UP-CHAIN (later stage → earlier stage), which
-- keeps the chain acyclic at the database as well as in code.
ALTER TABLE "traceability_links"
    ADD CONSTRAINT "trace_permitted_edges" CHECK (
        ("sourceType" = 'specification' AND "targetType" = 'requirement') OR
        ("sourceType" = 'task'          AND "targetType" = 'specification') OR
        ("sourceType" = 'goal'          AND "targetType" = 'vision') OR
        ("sourceType" = 'capability'    AND "targetType" = 'goal') OR
        ("sourceType" = 'requirement'   AND "targetType" = 'capability') OR
        ("sourceType" = 'architecture'  AND "targetType" = 'specification') OR
        ("sourceType" = 'plan'          AND "targetType" = 'architecture') OR
        ("sourceType" = 'task'          AND "targetType" = 'plan') OR
        ("sourceType" = 'code'          AND "targetType" = 'task') OR
        ("sourceType" = 'test'          AND "targetType" = 'code') OR
        ("sourceType" = 'release'       AND "targetType" = 'test') OR
        ("sourceType" = 'operation'     AND "targetType" = 'release')
    );

-- CreateTable — the structure as versioned DATA, not a skeleton (R-017-6).
CREATE TABLE "structure_definitions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'product_outputs',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structure_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "structure_definitions_appliesTo_version_key" ON "structure_definitions"("appliesTo", "version");

-- T298 — the twenty-one sections, verbatim from the source document. D-16:
-- product outputs only; nothing here governs this repository's documents.
INSERT INTO "structure_definitions" ("id", "version", "appliesTo", "sections", "updatedAt")
VALUES ('structure_product_v1', 1, 'product_outputs', '[
  {"name": "Executive Summary", "required": true},
  {"name": "Business Objectives", "required": true},
  {"name": "Stakeholders", "required": true},
  {"name": "Functional Requirements", "required": true},
  {"name": "Non-functional Requirements", "required": true},
  {"name": "Business Rules", "required": true},
  {"name": "Acceptance Criteria (Gherkin/EARS)", "required": true},
  {"name": "UI", "required": true},
  {"name": "API Contracts", "required": true},
  {"name": "Database Model", "required": true},
  {"name": "Events", "required": true},
  {"name": "State Machines", "required": true},
  {"name": "Sequence Diagrams", "required": true},
  {"name": "Security", "required": true},
  {"name": "Performance", "required": true},
  {"name": "AI Behaviors", "required": true},
  {"name": "Validation Rules", "required": true},
  {"name": "Error Handling", "required": true},
  {"name": "Test Scenarios", "required": true},
  {"name": "Deployment", "required": true},
  {"name": "Traceability Matrix", "required": true}
]'::jsonb, CURRENT_TIMESTAMP);
