-- T053 (EPIC-006) — Project takes ownership of the EPIC-001 stub.
--
-- Released 2026-08-20 by PMI-DOC-004 v1.0 (BR-0010). The stub carried exactly
-- workspaceId / name / ownerUserId / createdAt; these are the behavioural
-- columns the stub deliberately withheld (FR-001 archive-as-status, FR-019
-- engine selection).

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "projects"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    ADD COLUMN "engineName" TEXT,
    ADD COLUMN "archivedAt" TIMESTAMP(3),
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FR-001: a name is 1–200 characters (specs/_shared/schema.sql).
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_name_length" CHECK (char_length("name") BETWEEN 1 AND 200);

-- Archive consistency: archived rows carry the timestamp, active rows do not.
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_archived_consistency" CHECK (
        ("status" = 'archived' AND "archivedAt" IS NOT NULL) OR
        ("status" = 'active'  AND "archivedAt" IS NULL)
    );

-- CreateIndex — listing views filter on status (specs/_shared/schema.sql).
CREATE INDEX "projects_workspaceId_status_idx" ON "projects"("workspaceId", "status");
