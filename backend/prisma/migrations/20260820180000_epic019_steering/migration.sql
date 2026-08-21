-- EPIC-019 T227 — the organization tier and the steering tables.
--
-- R-017-1: `organizationId` is added to `workspaces` ONLY. No other table
-- gains a tenancy column — every artifact reaches its organization by one
-- join through its workspace.
--
-- The default organization row exists so every workspace written before this
-- epic (and every test seed) remains valid: the column is REQUIRED, and the
-- default satisfies it without a data migration.

-- CreateEnum
CREATE TYPE "SteeringScopeType" AS ENUM ('organization', 'workspace', 'project', 'product');

-- CreateEnum
CREATE TYPE "SteeringSubject" AS ENUM ('organization', 'workspace', 'product', 'architecture', 'coding_standards', 'security', 'ui_standards', 'business_rules', 'technology_stack', 'ai_governance');

-- CreateEnum
CREATE TYPE "SteeringDocumentStatus" AS ENUM ('active', 'retired');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- The default organization, so the required column below is satisfiable for
-- every existing and pre-organization workspace row.
INSERT INTO "organizations" ("id", "name", "updatedAt")
VALUES ('org_default', 'Default Organization', CURRENT_TIMESTAMP);

-- AlterTable — workspaces ONLY (R-017-1).
ALTER TABLE "workspaces" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'org_default';

-- AddForeignKey — RESTRICT: deleting an organization with workspaces is refused.
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "steering_scopes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scopeType" "SteeringScopeType" NOT NULL,
    "scopeRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steering_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "steering_scopes_scopeType_scopeRef_key" ON "steering_scopes"("scopeType", "scopeRef");
CREATE INDEX "steering_scopes_workspaceId_idx" ON "steering_scopes"("workspaceId");

-- AddForeignKey
ALTER TABLE "steering_scopes" ADD CONSTRAINT "steering_scopes_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "steering_documents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subject" "SteeringSubject" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SteeringDocumentStatus" NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- FR-ENH-003: content is the point; an empty document steers nothing.
    CONSTRAINT "steering_documents_content_nonempty" CHECK (length(btrim("content")) > 0),
    CONSTRAINT "steering_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "steering_documents_subject_scopeId_version_key" ON "steering_documents"("subject", "scopeId", "version");
CREATE INDEX "steering_documents_workspaceId_idx" ON "steering_documents"("workspaceId");
CREATE INDEX "steering_documents_scopeId_status_idx" ON "steering_documents"("scopeId", "status");

-- AddForeignKey
ALTER TABLE "steering_documents" ADD CONSTRAINT "steering_documents_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "steering_documents" ADD CONSTRAINT "steering_documents_scopeId_fkey"
    FOREIGN KEY ("scopeId") REFERENCES "steering_scopes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "steering_applications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "appliedDocuments" JSONB NOT NULL,
    "overrides" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steering_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "steering_applications_artifactType_artifactId_key" ON "steering_applications"("artifactType", "artifactId");
CREATE INDEX "steering_applications_workspaceId_idx" ON "steering_applications"("workspaceId");

-- AddForeignKey
ALTER TABLE "steering_applications" ADD CONSTRAINT "steering_applications_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Provenance is write-once (stamped at generation time, never recomputed):
-- the same shared reject_mutation() every append-only table uses.
CREATE TRIGGER "steering_applications_immutable"
    BEFORE UPDATE OR DELETE ON "steering_applications"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
