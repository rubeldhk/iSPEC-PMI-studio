-- EPIC-024 — artifact access control (FR-ACC-021..028).
--
-- T376: access grants and the refusal record.
--
-- Revocation is a timestamp, never a delete: access_grants rows are kept.
-- access_attempt_records is append-only — the audit_entries treatment.

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('read', 'edit');

-- CreateTable
CREATE TABLE "access_grants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_attempt_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_attempt_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_grants_workspaceId_idx" ON "access_grants"("workspaceId");
CREATE INDEX "access_grants_artifactType_artifactId_idx" ON "access_grants"("artifactType", "artifactId");
CREATE INDEX "access_grants_userId_idx" ON "access_grants"("userId");
CREATE INDEX "access_attempt_records_workspaceId_idx" ON "access_attempt_records"("workspaceId");
CREATE INDEX "access_attempt_records_artifactType_artifactId_idx" ON "access_attempt_records"("artifactType", "artifactId");

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_attempt_records" ADD CONSTRAINT "access_attempt_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-ACC-023 / SC-013 — a refusal record that can be edited is not a record.
-- Attached to (never redefining) EPIC-004's shared reject_mutation().
CREATE TRIGGER "access_attempt_records_immutable"
    BEFORE UPDATE OR DELETE ON "access_attempt_records"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- The audit trail survives revocation: a grant row is never deleted.
CREATE TRIGGER "access_grants_no_delete"
    BEFORE DELETE ON "access_grants"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
