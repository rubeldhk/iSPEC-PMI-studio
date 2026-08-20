-- T143 (EPIC-016) — Architecture Decision Records (FR-034).
--
-- Design source: specs/_shared/schema.sql. The `adr_specification_links` join
-- table is deliberately ABSENT from this migration: it references
-- `specifications`, which EPIC-008 creates. It follows in its own migration
-- once that table exists — sequenced, not forgotten.

-- CreateEnum
CREATE TYPE "AdrStatus" AS ENUM ('proposed', 'accepted', 'superseded');

-- CreateTable
CREATE TABLE "architecture_decision_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AdrStatus" NOT NULL DEFAULT 'proposed',
    "context" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "consequences" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architecture_decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — reference unique PER PROJECT: two projects may each hold ADR-0001.
CREATE UNIQUE INDEX "architecture_decision_records_projectId_reference_key"
    ON "architecture_decision_records"("projectId", "reference");
CREATE INDEX "architecture_decision_records_workspaceId_idx" ON "architecture_decision_records"("workspaceId");
CREATE INDEX "architecture_decision_records_projectId_status_idx" ON "architecture_decision_records"("projectId", "status");

-- AddForeignKey
ALTER TABLE "architecture_decision_records" ADD CONSTRAINT "architecture_decision_records_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "architecture_decision_records" ADD CONSTRAINT "architecture_decision_records_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
