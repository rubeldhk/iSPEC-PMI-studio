-- T077 (EPIC-008) — specifications and their append-only version history.
--
-- Design source: specs/_shared/schema.sql (Specifications, FR-010 to FR-015,
-- FR-022, FR-032). Column naming is camelCase per the T012a convention:
-- schema.prisma is authoritative at implementation; the design DDL is
-- design-level.
--
-- The CHECK constraints below are not belt-and-braces. Each backs a refusal the
-- service already makes, so that a direct query — a migration script, an admin
-- console, a future bug — cannot store the state the requirement forbids. That
-- is the same gap analysis finding C1 named in EPIC-004.

-- CreateEnum
CREATE TYPE "SpecLifecycleState" AS ENUM ('draft', 'review', 'approved', 'baselined', 'implemented', 'archived');

-- CreateTable
CREATE TABLE "specifications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lifecycleState" "SpecLifecycleState" NOT NULL DEFAULT 'draft',
    "currentVersionId" TEXT,
    "engineName" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "isOutOfDate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specification_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "contentRaw" TEXT NOT NULL,
    "contentParsed" JSONB NOT NULL,
    "lifecycleStateAtCreation" "SpecLifecycleState" NOT NULL,
    "authoredById" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specification_versions_pkey" PRIMARY KEY ("id")
);

-- FR-022 / T082: engine provenance is never null AND never blank. A blank
-- string satisfies NOT NULL while claiming nothing, which is the shape an
-- "unknown engine" placeholder would take.
ALTER TABLE "specifications"
    ADD CONSTRAINT "specifications_engine_identified" CHECK (
        char_length(trim("engineName")) > 0 AND char_length(trim("engineVersion")) > 0
    );

ALTER TABLE "specifications"
    ADD CONSTRAINT "specifications_title_nonempty" CHECK (char_length(trim("title")) > 0);

-- FR-026 / T079: empty engine output is a FAILURE, never a stored
-- specification. The parser refuses it; this refuses it again at the table.
ALTER TABLE "specification_versions"
    ADD CONSTRAINT "specification_versions_content_nonempty" CHECK (char_length(trim("contentRaw")) > 0);

-- Versions are numbered from 1 and never renumbered.
ALTER TABLE "specification_versions"
    ADD CONSTRAINT "specification_versions_number_positive" CHECK ("versionNumber" >= 1);

-- CreateIndex
CREATE UNIQUE INDEX "specifications_currentVersionId_key" ON "specifications"("currentVersionId");
CREATE INDEX "specifications_workspaceId_idx" ON "specifications"("workspaceId");
CREATE INDEX "specifications_projectId_lifecycleState_idx" ON "specifications"("projectId", "lifecycleState");
CREATE UNIQUE INDEX "specification_versions_specificationId_versionNumber_key" ON "specification_versions"("specificationId", "versionNumber");
CREATE INDEX "specification_versions_workspaceId_idx" ON "specification_versions"("workspaceId");
CREATE INDEX "specification_versions_specificationId_versionNumber_idx" ON "specification_versions"("specificationId", "versionNumber" DESC);

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "specification_versions" ADD CONSTRAINT "specification_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "specification_versions" ADD CONSTRAINT "specification_versions_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The cycle is deliberate and mirrors specs/_shared/schema.sql: a specification
-- points at its current version, and a version belongs to a specification. The
-- FK is added last, once both tables exist. DEFERRABLE so the pair can be
-- inserted inside the one transaction that also writes the traceability links
-- and the job's terminal state (SC-002).
ALTER TABLE "specifications"
    ADD CONSTRAINT "specifications_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "specification_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- NOT created here: the `specification_versions_immutable` trigger. It is
-- EPIC-009 T460's, paired with its own integration test (T459) against a real
-- PostgreSQL. Adding it here would leave the guarantee untested — the exact
-- shape of the C1 finding, in reverse.
