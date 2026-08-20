-- T064 + T458 (EPIC-007) — the requirement register and its append-only history.
--
-- Design source: specs/_shared/schema.sql (Requirements, FR-004 to FR-009).
-- Column naming is camelCase per the T012a convention: schema.prisma is
-- authoritative at implementation; the design DDL is design-level.

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('business', 'functional', 'non_functional', 'constraint');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('p1', 'p2', 'p3');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('active', 'retired');

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL,
    "priority" "RequirementPriority" NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'active',
    "contentHash" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL,
    "priority" "RequirementPriority" NOT NULL,
    "authoredById" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

-- FR-007: an empty description is refused — the service names the field, and
-- the database backs the refusal so no bypass can store one.
ALTER TABLE "requirements"
    ADD CONSTRAINT "requirements_description_nonempty" CHECK (char_length(trim("description")) > 0);

-- FR-006: retired rows carry the timestamp, active rows do not.
ALTER TABLE "requirements"
    ADD CONSTRAINT "requirements_retired_consistency" CHECK (
        ("status" = 'retired' AND "retiredAt" IS NOT NULL) OR
        ("status" = 'active'  AND "retiredAt" IS NULL)
    );

-- CreateIndex
CREATE UNIQUE INDEX "requirements_projectId_reference_key" ON "requirements"("projectId", "reference");
CREATE INDEX "requirements_workspaceId_idx" ON "requirements"("workspaceId");
CREATE INDEX "requirements_projectId_type_idx" ON "requirements"("projectId", "type");
CREATE INDEX "requirements_projectId_priority_idx" ON "requirements"("projectId", "priority");
CREATE INDEX "requirements_projectId_status_idx" ON "requirements"("projectId", "status");
CREATE INDEX "requirement_versions_workspaceId_idx" ON "requirement_versions"("workspaceId");
CREATE INDEX "requirement_versions_requirementId_authoredAt_idx" ON "requirement_versions"("requirementId", "authoredAt" DESC);

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- T458 — FR-009 at the database, not only in code (analysis finding C1 class).
--
-- `reject_mutation()` is EPIC-004's shared function, created by T454 in the
-- init migration. Deliberately NOT redefined here: one function, one rule,
-- every append-only table attaches to it.
CREATE TRIGGER "requirement_versions_immutable"
    BEFORE UPDATE OR DELETE ON "requirement_versions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
