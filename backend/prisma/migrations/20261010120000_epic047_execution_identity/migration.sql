-- EPIC-047 T2563 — DEF-047-001: an execution identity for an Expert run.
--
-- EPIC-037 registers nothing without an authenticated principal, its snapshot,
-- a connector registration, a sponsor and a delegation. These two tables are
-- what EPIC-047 has to remember to supply them for a run the platform itself
-- dispatches. Neither duplicates EPIC-028's registry: the principal, snapshot
-- and delegation rows stay there; these record which of them an Expert uses.
--
--   * expert_principals — one agent principal per workspace, Expert key and
--     sponsoring user. EPIC-028 freezes a principal's sponsor, so a principal
--     cannot serve two sponsors, and its registry has no lookup by descriptor.
--     The primary key makes the first writer win; a concurrent dispatch reads
--     the winner back.
--   * expert_execution_identities — the refs each execution registered with.
--     EPIC-037 re-checks identity at completion, and a run may be completed by
--     another process (a parent's stop cascade), so the refs are stored rather
--     than recomputed.
--
-- Both are append-only: a principal mapping is never re-pointed and an
-- execution's identity never changes after it registered.

-- CreateTable
CREATE TABLE "expert_principals" (
    "workspaceId"   TEXT NOT NULL,
    "expertKey"     TEXT NOT NULL,
    "sponsorUserId" TEXT NOT NULL,
    "principalId"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_principals_pkey" PRIMARY KEY ("workspaceId", "expertKey", "sponsorUserId"),
    CONSTRAINT "expert_principals_key_check" CHECK (length(trim("expertKey")) > 0)
);

-- CreateTable
CREATE TABLE "expert_execution_identities" (
    "executionId"               TEXT NOT NULL,
    "workspaceId"               TEXT NOT NULL,
    "projectId"                 TEXT NOT NULL,
    "principalId"               TEXT NOT NULL,
    "agentSnapshotId"           TEXT NOT NULL,
    "connectorRegistrationId"   TEXT NOT NULL,
    "sponsorUserId"             TEXT NOT NULL,
    "delegationId"              TEXT NOT NULL,
    "delegationIdentityVersion" INTEGER NOT NULL,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_execution_identities_pkey" PRIMARY KEY ("executionId"),
    CONSTRAINT "expert_execution_identities_version_check" CHECK ("delegationIdentityVersion" >= 1)
);

-- CreateIndex
CREATE INDEX "expert_principals_workspaceId_idx" ON "expert_principals"("workspaceId");
CREATE INDEX "expert_execution_identities_workspaceId_idx" ON "expert_execution_identities"("workspaceId");

-- AddForeignKey
ALTER TABLE "expert_principals" ADD CONSTRAINT "expert_principals_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_principals" ADD CONSTRAINT "expert_principals_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_principals" ADD CONSTRAINT "expert_principals_sponsorUserId_fkey"
    FOREIGN KEY ("sponsorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_execution_identities" ADD CONSTRAINT "expert_execution_identities_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_execution_identities" ADD CONSTRAINT "expert_execution_identities_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_execution_identities" ADD CONSTRAINT "expert_execution_identities_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only: neither table is updated or deleted from.
CREATE OR REPLACE FUNCTION "expert_identity_append_only"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'EPIC-047 DEF-047-001: % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "expert_principals_append_only"
    BEFORE UPDATE OR DELETE ON "expert_principals"
    FOR EACH ROW EXECUTE FUNCTION "expert_identity_append_only"();
CREATE TRIGGER "expert_execution_identities_append_only"
    BEFORE UPDATE OR DELETE ON "expert_execution_identities"
    FOR EACH ROW EXECUTE FUNCTION "expert_identity_append_only"();
