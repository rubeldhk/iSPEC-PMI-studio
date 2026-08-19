-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('generate_specification', 'generate_tasks', 'validate_specification');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out');

-- CreateEnum
CREATE TYPE "JobFailureReason" AS ENUM ('engine_unavailable', 'engine_error', 'malformed_output', 'empty_output', 'timeout', 'cancelled', 'input_too_large', 'empty_selection');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'lifecycle_transition', 'engine_invocation', 'access_refused');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('success', 'refused', 'failed');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "engineName" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "inputRefs" JSONB NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'queued',
    "failureReason" "JobFailureReason",
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_registrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engine_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_workspaceId_idx" ON "users"("workspaceId");

-- CreateIndex
CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_name_key" ON "projects"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "generation_jobs_projectId_jobKey_idx" ON "generation_jobs"("projectId", "jobKey");

-- CreateIndex
CREATE INDEX "generation_jobs_projectId_createdAt_idx" ON "generation_jobs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "generation_jobs_workspaceId_idx" ON "generation_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "audit_entries_workspaceId_occurredAt_idx" ON "audit_entries"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_entries_targetType_targetId_idx" ON "audit_entries"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "engine_registrations_name_key" ON "engine_registrations"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- T454 · Append-only enforcement (FR-033, SC-012)
--
-- The audit trail is a security control, and a control the application
-- merely declines to violate is not a control. This makes it structural:
-- UPDATE and DELETE are rejected BY POSTGRESQL, so a compromised service,
-- a stray migration, or a hand-typed psql session all fail the same way.
--
-- reject_mutation() is SHARED. EPIC-007 (requirement_versions) and
-- EPIC-009 (specification_versions) attach their own triggers to this
-- function and MUST NOT redefine it — see specs/_shared/schema.sql.
-- =====================================================================

CREATE OR REPLACE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entries_immutable
    BEFORE UPDATE OR DELETE ON "audit_entries"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
