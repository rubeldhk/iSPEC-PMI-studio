-- EPIC-045 T1621 — artifact sync: the Epic's markdown set, bound to the execution
-- that produced it (specs/045-artifact-sync-markdown-viewer/data-model.md §1–§4).
-- Additive only: three tables, one column, one index. No existing row changes.

-- §1 · artifact_versions — content, ONCE per digest (R-045-1).
-- The unique (projectId, path, digest) index is the arbiter under concurrency
-- (FR-ART-006): two simultaneous syncs of the same content race, one loses, and
-- the loser reads the winner's row back. That is why the index exists here and
-- not merely in application code — DEF-044-003's rule.
CREATE TABLE "artifact_versions" (
    "id"               TEXT NOT NULL,
    "workspaceId"      TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "path"             TEXT NOT NULL,
    "kind"             TEXT NOT NULL,
    "digest"           TEXT NOT NULL,
    "sizeBytes"        INTEGER NOT NULL,
    "content"          TEXT NOT NULL,
    "firstExecutionId" TEXT NOT NULL,
    "firstSyncedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "artifact_versions_kind_vocabulary" CHECK ("kind" IN (
        'spec', 'plan', 'tasks', 'research', 'data-model', 'analysis', 'quickstart', 'contract', 'checklist'
    )),
    CONSTRAINT "artifact_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_versions_firstExecutionId_fkey" FOREIGN KEY ("firstExecutionId") REFERENCES "executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "artifact_versions_projectId_path_digest_key" ON "artifact_versions"("projectId", "path", "digest");
CREATE INDEX "artifact_versions_workspaceId_idx" ON "artifact_versions"("workspaceId");
CREATE INDEX "artifact_versions_projectId_path_idx" ON "artifact_versions"("projectId", "path");

-- §2 · artifact_syncs — one row per sync, kept even when every file was refused.
-- The unique (workspaceId, idempotencyKey) index is what makes a replay return
-- the stored answer and write nothing (R-045-8). `epicId` is nullable: an
-- execution whose target names no Epic still syncs, and is listed as unbound
-- rather than attached to the wrong Epic (FR-ART-007).
CREATE TABLE "artifact_syncs" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "executionId"    TEXT NOT NULL,
    "epicId"         TEXT,
    "credentialId"   TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdCount"   INTEGER NOT NULL DEFAULT 0,
    "reusedCount"    INTEGER NOT NULL DEFAULT 0,
    "refusedCount"   INTEGER NOT NULL DEFAULT 0,
    "syncedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifact_syncs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "artifact_syncs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_syncs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_syncs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_syncs_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "artifact_syncs_workspaceId_idempotencyKey_key" ON "artifact_syncs"("workspaceId", "idempotencyKey");
CREATE INDEX "artifact_syncs_epicId_syncedAt_idx" ON "artifact_syncs"("epicId", "syncedAt" DESC);
CREATE INDEX "artifact_syncs_executionId_idx" ON "artifact_syncs"("executionId");
CREATE INDEX "artifact_syncs_workspaceId_projectId_idx" ON "artifact_syncs"("workspaceId", "projectId");

-- §3 · artifact_sync_files — the manifest: what one sync said about one path.
-- A refused row carries a code and no version; an accepted row carries a version
-- and no code. `refusalDetail` is safe text: never the content, never a matched
-- credential (FR-ART-053).
CREATE TABLE "artifact_sync_files" (
    "id"            TEXT NOT NULL,
    "workspaceId"   TEXT NOT NULL,
    "syncId"        TEXT NOT NULL,
    "path"          TEXT NOT NULL,
    "digest"        TEXT NOT NULL,
    "outcome"       TEXT NOT NULL,
    "versionId"     TEXT,
    "refusalCode"   TEXT,
    "refusalDetail" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifact_sync_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "artifact_sync_files_outcome_vocabulary" CHECK ("outcome" IN ('created', 'reused', 'refused')),
    CONSTRAINT "artifact_sync_files_refusalCode_vocabulary" CHECK ("refusalCode" IS NULL OR "refusalCode" IN (
        'digest_mismatch', 'path_not_in_artifact_set', 'path_escapes_epic', 'not_utf8', 'too_large', 'credential_shape', 'too_many_files'
    )),
    -- The two halves of the same fact, so a row cannot claim both or neither.
    CONSTRAINT "artifact_sync_files_outcome_shape" CHECK (
        ("outcome" = 'refused' AND "versionId" IS NULL AND "refusalCode" IS NOT NULL)
        OR ("outcome" <> 'refused' AND "refusalCode" IS NULL)
    ),
    CONSTRAINT "artifact_sync_files_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "artifact_sync_files_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "artifact_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "artifact_sync_files_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "artifact_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "artifact_sync_files_syncId_path_key" ON "artifact_sync_files"("syncId", "path");
CREATE INDEX "artifact_sync_files_workspaceId_idx" ON "artifact_sync_files"("workspaceId");
CREATE INDEX "artifact_sync_files_versionId_idx" ON "artifact_sync_files"("versionId");

-- §4 · specifications.sourcePath — the Epic's specification BY SYNC (R-045-4).
-- One `spec.md` per Epic is one specification however many commands sync it;
-- later syncs append versions through appendIfChanged. NULL for every
-- specification created another way, and PostgreSQL treats NULLs as distinct,
-- so the index constrains only the synced ones.
ALTER TABLE "specifications" ADD COLUMN "sourcePath" TEXT;
CREATE UNIQUE INDEX "specifications_epicId_sourcePath_key" ON "specifications"("epicId", "sourcePath");
