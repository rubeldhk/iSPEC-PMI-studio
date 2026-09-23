-- EPIC-042 T1474 — extension, setup skill and constitution sync
-- (specs/042-pmi-spec-kit-extension/data-model.md). Additive only.

-- §1 · owner-authored constraints, the source the constitution is rendered from (R-042-4)
CREATE TABLE "project_constraints" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "order"       INTEGER NOT NULL,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_constraints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_constraints_kind_vocabulary" CHECK ("kind" IN ('principle', 'constraint', 'non_goal')),
    CONSTRAINT "project_constraints_status_vocabulary" CHECK ("status" IN ('active', 'retired')),
    CONSTRAINT "project_constraints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_constraints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "project_constraints_workspaceId_projectId_kind_order_idx" ON "project_constraints"("workspaceId", "projectId", "kind", "order");
CREATE INDEX "project_constraints_projectId_status_idx" ON "project_constraints"("projectId", "status");

-- §2 · one policy per project: D-4 defaults, offline mode strict by default (BR-0202, R-042-6)
CREATE TABLE "decomposition_policies" (
    "id"                        TEXT NOT NULL,
    "workspaceId"               TEXT NOT NULL,
    "projectId"                 TEXT NOT NULL,
    "oneSpecPerEpic"            BOOLEAN NOT NULL DEFAULT true,
    "taskCeiling"               INTEGER NOT NULL DEFAULT 50,
    "splitRequiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "offlineMode"               TEXT NOT NULL DEFAULT 'strict',
    "version"                   INTEGER NOT NULL DEFAULT 1,
    "updatedById"               TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,
    CONSTRAINT "decomposition_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "decomposition_policies_offlineMode_vocabulary" CHECK ("offlineMode" IN ('strict', 'provisional')),
    CONSTRAINT "decomposition_policies_taskCeiling_range" CHECK ("taskCeiling" BETWEEN 1 AND 500),
    CONSTRAINT "decomposition_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "decomposition_policies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "decomposition_policies_projectId_key" ON "decomposition_policies"("projectId");
CREATE INDEX "decomposition_policies_workspaceId_projectId_idx" ON "decomposition_policies"("workspaceId", "projectId");

-- §3 · append-only renders: what was written, so a file on disk can be matched (R-042-5)
CREATE TABLE "constitution_renders" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "version"      INTEGER NOT NULL,
    "digest"       CHAR(64) NOT NULL,
    "content"      TEXT NOT NULL,
    "inputs"       JSONB NOT NULL,
    "renderedById" TEXT,
    "renderedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "constitution_renders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "constitution_renders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "constitution_renders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "constitution_renders_projectId_digest_key" ON "constitution_renders"("projectId", "digest");
CREATE INDEX "constitution_renders_projectId_version_idx" ON "constitution_renders"("projectId", "version" DESC);
CREATE INDEX "constitution_renders_workspaceId_projectId_idx" ON "constitution_renders"("workspaceId", "projectId");

-- §4 · what the workstation last reported about its constitution file (R-042-5)
ALTER TABLE "workstation_connections" ADD COLUMN "constitutionDigest" CHAR(64);
ALTER TABLE "workstation_connections" ADD COLUMN "constitutionState" TEXT;
ALTER TABLE "workstation_connections" ADD COLUMN "constitutionReportedAt" TIMESTAMP(3);
ALTER TABLE "workstation_connections"
    ADD CONSTRAINT "workstation_connections_constitutionState_vocabulary" CHECK ("constitutionState" IS NULL OR "constitutionState" IN ('current', 'stale', 'drift', 'missing'));

-- §5 · provisioning writes the first-run marker (R-042-8)
ALTER TABLE "provisioning_records" ADD COLUMN "firstRunMarkerWritten" BOOLEAN NOT NULL DEFAULT false;
