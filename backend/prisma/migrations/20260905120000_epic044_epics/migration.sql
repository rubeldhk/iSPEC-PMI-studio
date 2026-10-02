-- EPIC-044 T1555 — Epic as a product entity and the Spec Journey Board
-- (specs/044-epic-model-journey-board/data-model.md). Additive only.

-- §1 · epics: number allocated by the platform, never reused; a self-relation for split
-- children; idempotent decision processing by (decisionCommentId, splitSuffix). No stage column:
-- a stage is derived from executions, never stored (FR-EPB-001).
CREATE TABLE "epics" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "projectId"             TEXT NOT NULL,
    "number"                INTEGER NOT NULL,
    "slug"                  TEXT NOT NULL,
    "title"                 TEXT NOT NULL,
    "description"           TEXT NOT NULL DEFAULT '',
    "status"                TEXT NOT NULL DEFAULT 'active',
    "parentEpicId"          TEXT,
    "splitSuffix"           TEXT,
    "decisionCommentId"     TEXT,
    "lastDecisionCommentId" TEXT,
    "createdById"           TEXT NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    "closedAt"              TIMESTAMP(3),
    CONSTRAINT "epics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "epics_status_vocabulary" CHECK ("status" IN ('active', 'split', 'closed')),
    CONSTRAINT "epics_splitSuffix_shape" CHECK ("splitSuffix" IS NULL OR "splitSuffix" ~ '^[a-z]$'),
    CONSTRAINT "epics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "epics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "epics_parentEpicId_fkey" FOREIGN KEY ("parentEpicId") REFERENCES "epics"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "epics_projectId_number_key" ON "epics"("projectId", "number");
CREATE UNIQUE INDEX "epics_decisionCommentId_splitSuffix_key" ON "epics"("decisionCommentId", "splitSuffix");
CREATE INDEX "epics_workspaceId_idx" ON "epics"("workspaceId");
CREATE INDEX "epics_projectId_status_idx" ON "epics"("projectId", "status");
CREATE INDEX "epics_parentEpicId_idx" ON "epics"("parentEpicId");

-- §2 · a requirement belongs to at most one Epic (FR-EPB-023); a specification likewise (FR-EPB-025).
ALTER TABLE "requirements" ADD COLUMN "epicId" TEXT;
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "requirements_projectId_epicId_idx" ON "requirements"("projectId", "epicId");

ALTER TABLE "specifications" ADD COLUMN "epicId" TEXT;
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "specifications_projectId_epicId_idx" ON "specifications"("projectId", "epicId");
