-- EPIC-043 T1409 — the integration contract (specs/043-pmi-integration-contract/data-model.md).
-- Additive only.

-- §1 · one workstation connection per credential, touched by pmi.health (R-043-8)
CREATE TABLE "workstation_connections" (
    "id"               TEXT NOT NULL,
    "workspaceId"      TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "credentialId"     TEXT NOT NULL,
    "firstSeenAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extensionVersion" TEXT,
    "toolkitVersion"   TEXT,
    "contractVersion"  TEXT NOT NULL,
    "serverVersion"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workstation_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workstation_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workstation_connections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workstation_connections_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "connector_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workstation_connections_credentialId_key" ON "workstation_connections"("credentialId");
CREATE INDEX "workstation_connections_workspaceId_projectId_idx" ON "workstation_connections"("workspaceId", "projectId");

-- §2 · the identity snapshot captured at mint, so the registry's identity can
-- be derived from the credential and never from a body (R-043-3)
ALTER TABLE "connector_credentials" ADD COLUMN "snapshotId" TEXT;

-- §3 · the per-project timeline read (R-043-7)
CREATE INDEX "executions_workspaceId_projectId_registeredAt_idx" ON "executions"("workspaceId", "projectId", "registeredAt" DESC);

-- §4 · the snapshot table's kind vocabulary lagged the principal table's: EPIC-041
-- admitted `connector` principals, and the first snapshot of one (captured at
-- mint, R-043-3) violated `principal_identity_snapshots_kind_vocabulary`.
ALTER TABLE "principal_identity_snapshots" DROP CONSTRAINT IF EXISTS "principal_identity_snapshots_kind_vocabulary";
ALTER TABLE "principal_identity_snapshots"
    ADD CONSTRAINT "principal_identity_snapshots_kind_vocabulary" CHECK ("kind" IN ('agent', 'service', 'connector'));
