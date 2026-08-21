-- EPIC-020 T252/T264 — the dependency graph and living-specification currency.

-- CreateEnum
CREATE TYPE "CurrencyStatus" AS ENUM ('current', 'stale');

-- AlterTable — FR-ENH-006: one field, wider trigger than FR-032's flag.
ALTER TABLE "specifications" ADD COLUMN "currencyStatus" "CurrencyStatus" NOT NULL DEFAULT 'current';
ALTER TABLE "specifications" ADD COLUMN "staleReason" TEXT;
ALTER TABLE "specifications" ADD COLUMN "reconciledAt" TIMESTAMP(3);
ALTER TABLE "specifications" ADD COLUMN "reconciledById" TEXT;

-- CreateTable — R-017-3: a SEPARATE table from traceability_links.
CREATE TABLE "dependency_edges" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- FR-ENH-011's cheapest case, refused by the database itself; the
    -- multi-hop cases are the service's cycle detector (T254).
    CONSTRAINT "dependency_edges_no_self_edge" CHECK (NOT ("sourceType" = "targetType" AND "sourceId" = "targetId")),
    CONSTRAINT "dependency_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — both traversal directions (impact walks backwards).
CREATE UNIQUE INDEX "dependency_edges_sourceType_sourceId_targetType_targetId_key" ON "dependency_edges"("sourceType", "sourceId", "targetType", "targetId");
CREATE INDEX "dependency_edges_sourceType_sourceId_idx" ON "dependency_edges"("sourceType", "sourceId");
CREATE INDEX "dependency_edges_targetType_targetId_idx" ON "dependency_edges"("targetType", "targetId");
CREATE INDEX "dependency_edges_workspaceId_idx" ON "dependency_edges"("workspaceId");

-- AddForeignKey
ALTER TABLE "dependency_edges" ADD CONSTRAINT "dependency_edges_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
