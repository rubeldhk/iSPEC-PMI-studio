-- T078 (EPIC-011) — the traceability graph (FR-029 to FR-031).
--
-- Design source: specs/_shared/schema.sql (Traceability). Polymorphic:
-- source/target are (type, id) pairs with no FK. The permitted-edge rule is
-- enforced in code (link-writer) AND here as a CHECK — the same two-layer
-- pattern as the lifecycle and the append-only tables.

-- CreateEnum
CREATE TYPE "TraceArtifactType" AS ENUM ('requirement', 'specification', 'task');

-- CreateEnum
CREATE TYPE "TraceRelationship" AS ENUM ('generated_from', 'derived_from');

-- CreateTable
CREATE TABLE "traceability_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" "TraceArtifactType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" "TraceArtifactType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationship" "TraceRelationship" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traceability_links_pkey" PRIMARY KEY ("id")
);

-- FR-029: only these edges exist in Phase 1.
ALTER TABLE "traceability_links"
    ADD CONSTRAINT "trace_permitted_edges" CHECK (
        ("sourceType" = 'specification' AND "targetType" = 'requirement') OR
        ("sourceType" = 'task'          AND "targetType" = 'specification')
    );

-- CreateIndex — both traversal directions are first-class (FR-030, SC-009).
CREATE UNIQUE INDEX "traceability_links_sourceType_sourceId_targetType_targetId_relationship_key"
    ON "traceability_links"("sourceType", "sourceId", "targetType", "targetId", "relationship");
CREATE INDEX "traceability_links_workspaceId_idx" ON "traceability_links"("workspaceId");
CREATE INDEX "traceability_links_targetType_targetId_idx" ON "traceability_links"("targetType", "targetId");
CREATE INDEX "traceability_links_sourceType_sourceId_idx" ON "traceability_links"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "traceability_links" ADD CONSTRAINT "traceability_links_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
