-- EPIC-025 — external storage publishing (FR-PUB-029..040).
--
-- T388: storage connections, publish records, published file references.
--
-- publish_records is append-only: FR-PUB-034's record survives failures and
-- provider switches, so nothing may rewrite it. published_file_references
-- keeps rows through disconnection (no-delete) — they are marked, not
-- removed. storage_connections rows survive disconnection the same way.

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('healthy', 'needs_reauthorisation', 'unavailable');
CREATE TYPE "PublishState" AS ENUM ('running', 'succeeded', 'partial', 'failed');
CREATE TYPE "PublishFailureReason" AS ENUM ('provider_unavailable', 'authorisation_expired', 'quota_exceeded', 'size_limit_exceeded', 'destination_missing');

-- CreateTable
CREATE TABLE "storage_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'healthy',
    "authorisedById" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "publish_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "artifactsIncluded" JSONB NOT NULL,
    "artifactsExcluded" JSONB NOT NULL,
    "state" "PublishState" NOT NULL,
    "failureReason" "PublishFailureReason",
    "destinationLocations" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "published_file_references" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "destinationLocation" TEXT NOT NULL,
    "publishedVersion" TEXT NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "noLongerTracked" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_file_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_connections_workspaceId_idx" ON "storage_connections"("workspaceId");
CREATE INDEX "publish_records_workspaceId_idx" ON "publish_records"("workspaceId");
CREATE INDEX "publish_records_projectId_publishedAt_idx" ON "publish_records"("projectId", "publishedAt" DESC);
CREATE INDEX "published_file_references_workspaceId_idx" ON "published_file_references"("workspaceId");
CREATE INDEX "published_file_references_artifactType_artifactId_idx" ON "published_file_references"("artifactType", "artifactId");
CREATE INDEX "published_file_references_connectionId_idx" ON "published_file_references"("connectionId");

-- AddForeignKey
ALTER TABLE "storage_connections" ADD CONSTRAINT "storage_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "storage_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "published_file_references" ADD CONSTRAINT "published_file_references_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-PUB-038 / SC-010 — publish history survives everything: the record may
-- be finalised (state fill) but never deleted. References are marked stale
-- or untracked, never removed. Attached to EPIC-004's shared reject_mutation().
CREATE TRIGGER "publish_records_no_delete"
    BEFORE DELETE ON "publish_records"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER "published_file_references_no_delete"
    BEFORE DELETE ON "published_file_references"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
