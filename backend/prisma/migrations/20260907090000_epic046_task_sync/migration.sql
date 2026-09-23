-- EPIC-046 T1687 — the task sync: `tasks.md` becomes rows, bound to the execution
-- that produced it (specs/046-task-kanban-governed-status/data-model.md §1–§6).
--
-- Additive but for ONE widening: `tasks.specificationId` becomes nullable. That
-- is the Q1 ruling of 2026-09-06 — a synced task's home is its Epic, and an Epic
-- whose `tasks.md` synced before any `spec.md` has no specification to hang from.
-- No existing row changes; every current reader keeps working on current rows.

-- §1 · TaskStatus gains `blocked` (FR-KAN-051).
-- The enum makes the column possible. What keeps a parse from ever producing it
-- is the reconciliation truth table (FR-KAN-041): the grammar has two checkbox
-- states and no third, so `blocked` and `in_progress` arise only from an applied
-- proposal. ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
-- older PostgreSQL; IF NOT EXISTS keeps the migration re-runnable.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'blocked';

-- §2 · tasks — widened (data-model §2).
ALTER TABLE "tasks" ALTER COLUMN "specificationId" DROP NOT NULL;
ALTER TABLE "tasks"
    ADD COLUMN "epicId"                TEXT,
    ADD COLUMN "taskKey"               TEXT,
    ADD COLUMN "sourceLine"            INTEGER,
    ADD COLUMN "sourceDigest"          TEXT,
    ADD COLUMN "parallel"              BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "sourcePaths"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "presentInLatestParse"  BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "statusSource"          TEXT NOT NULL DEFAULT 'engine',
    ADD COLUMN "lastParsedExecutionId" TEXT,
    ADD COLUMN "lastMovedAt"           TIMESTAMP(3),
    ADD COLUMN "lastMovedBy"           TEXT;

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_statusSource_vocabulary"
        CHECK ("statusSource" IN ('parse', 'event', 'proposal', 'engine')),
    ADD CONSTRAINT "tasks_epicId_fkey"
        FOREIGN KEY ("epicId") REFERENCES "epics"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "tasks_lastParsedExecutionId_fkey"
        FOREIGN KEY ("lastParsedExecutionId") REFERENCES "executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FR-KAN-031: identity is the identifier WITHIN its Epic, so a re-sync updates
-- the row rather than creating a second one and every proposal attached to it
-- survives. PARTIAL: engine-generated rows have neither column and are untouched.
CREATE UNIQUE INDEX "tasks_epicId_taskKey_key" ON "tasks"("epicId", "taskKey")
    WHERE "epicId" IS NOT NULL AND "taskKey" IS NOT NULL;
CREATE INDEX "tasks_epicId_status_idx" ON "tasks"("epicId", "status");
CREATE INDEX "tasks_workspaceId_epicId_idx" ON "tasks"("workspaceId", "epicId");

-- §3 · projects.taskMoveRequiresApproval (R-046-6).
-- Default false: a permitted member's own move applies at once. Constitution
-- XII.6 forbids AI self-approval; it does not require a second human per card.
ALTER TABLE "projects"
    ADD COLUMN "taskMoveRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- §4 · task_syncs — one row per sync, kept even when nothing changed (FR-KAN-034).
-- The unique (workspaceId, idempotencyKey) index is the arbiter of FR-KAN-038:
-- two simultaneous syncs of one Epic race, one loses, and the loser reads the
-- winner's row back. The key is DERIVED from the execution and the digest,
-- because the shipped finish hook sends none and is not edited (FR-KAN-061).
CREATE TABLE "task_syncs" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    "epicId"          TEXT,
    "executionId"     TEXT NOT NULL,
    "actorId"         TEXT,
    "idempotencyKey"  TEXT NOT NULL,
    "tasksDigest"     TEXT NOT NULL,
    "linesConsidered" INTEGER NOT NULL DEFAULT 0,
    "parsed"          INTEGER NOT NULL DEFAULT 0,
    "refused"         INTEGER NOT NULL DEFAULT 0,
    "duplicates"      INTEGER NOT NULL DEFAULT 0,
    "added"           INTEGER NOT NULL DEFAULT 0,
    "changed"         INTEGER NOT NULL DEFAULT 0,
    "unchanged"       INTEGER NOT NULL DEFAULT 0,
    "disappeared"     INTEGER NOT NULL DEFAULT 0,
    "outOfBandEdit"   BOOLEAN NOT NULL DEFAULT false,
    -- `syncedAt` is WHEN THE SYNC OBSERVED THE FILE; `createdAt` is when the
    -- row was written. They are usually the same instant and are not the same
    -- fact, and `T012a` requires the second on every table — a lesson EPIC-045
    -- learned the same way, on `artifact_sync_files`.
    "syncedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_syncs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_syncs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_syncs_projectId_fkey"   FOREIGN KEY ("projectId")   REFERENCES "projects"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_syncs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_syncs_epicId_fkey"      FOREIGN KEY ("epicId")      REFERENCES "epics"("id")      ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "task_syncs_workspaceId_idempotencyKey_key" ON "task_syncs"("workspaceId", "idempotencyKey");
CREATE INDEX "task_syncs_epicId_syncedAt_idx" ON "task_syncs"("epicId", "syncedAt" DESC);
CREATE INDEX "task_syncs_executionId_idx" ON "task_syncs"("executionId");
CREATE INDEX "task_syncs_workspaceId_projectId_idx" ON "task_syncs"("workspaceId", "projectId");

-- §5 · task_sync_lines — the manifest. One row per CONSIDERED line: a heading,
-- a table row or a `(unit test: T0nn)` cross-reference is neither stored nor
-- counted (FR-KAN-001). A line that opened as a task-list item and then failed
-- the grammar IS stored, with its code — reported, never dropped (FR-KAN-003).
-- The nine codes are a CHECK, not prose, so the vocabulary cannot drift.
CREATE TABLE "task_sync_lines" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "syncId"         TEXT NOT NULL,
    "lineNumber"     INTEGER NOT NULL,
    "rawText"        TEXT NOT NULL,
    "outcome"        TEXT NOT NULL,
    "refusalCode"    TEXT,
    "taskKey"        TEXT,
    "changeKind"     TEXT,
    "previousStatus" TEXT,
    "newStatus"      TEXT,
    "marker"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_sync_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_sync_lines_outcome_vocabulary" CHECK ("outcome" IN ('parsed', 'refused', 'duplicate')),
    CONSTRAINT "task_sync_lines_changeKind_vocabulary" CHECK (
        "changeKind" IS NULL OR "changeKind" IN ('added', 'description-changed', 'checkbox-changed', 'unchanged')
    ),
    CONSTRAINT "task_sync_lines_refusalCode_vocabulary" CHECK (
        "refusalCode" IS NULL OR "refusalCode" IN (
            'malformed_identifier', 'identifier_not_matched', 'missing_description', 'description_too_long',
            'duplicate_identifier', 'credential_in_description',
            'file_too_large', 'too_many_task_lines', 'not_utf8_text'
        )
    ),
    CONSTRAINT "task_sync_lines_marker_vocabulary" CHECK (
        "marker" IS NULL OR "marker" IN ('aheadOfFile', 'supersededByFile')
    ),
    CONSTRAINT "task_sync_lines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_sync_lines_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "task_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "task_sync_lines_syncId_lineNumber_key" ON "task_sync_lines"("syncId", "lineNumber");
CREATE INDEX "task_sync_lines_workspaceId_idx" ON "task_sync_lines"("workspaceId");
CREATE INDEX "task_sync_lines_syncId_outcome_idx" ON "task_sync_lines"("syncId", "outcome");

-- §6 · task_status_proposals — the immutable REQUEST (R-046-5).
-- There is deliberately NO verdict column: R-037-5's rule, restated. A mutable
-- verdict field becomes the audit authority the first time somebody reads it
-- instead of the event stream, and can then disagree with EPIC-030's own record.
-- The verdict is an appended event and a projection folded from events.
CREATE TABLE "task_status_proposals" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "taskId"                TEXT NOT NULL,
    "expectedCurrentStatus" TEXT NOT NULL,
    "requestedStatus"       TEXT NOT NULL,
    "reason"                TEXT NOT NULL,
    "proposerId"            TEXT NOT NULL,
    "proposerType"          TEXT NOT NULL,
    "executionId"           TEXT,
    "eventId"               TEXT,
    "idempotencyKey"        TEXT NOT NULL,
    -- `proposedAt` is when the person asked; `createdAt` is when the row was
    -- written. Distinct facts, and `T012a` wants the second on every table.
    "proposedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_status_proposals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_status_proposals_expectedCurrentStatus_vocabulary"
        CHECK ("expectedCurrentStatus" IN ('not_started', 'in_progress', 'done', 'blocked')),
    CONSTRAINT "task_status_proposals_requestedStatus_vocabulary"
        CHECK ("requestedStatus" IN ('not_started', 'in_progress', 'done', 'blocked')),
    CONSTRAINT "task_status_proposals_proposerType_vocabulary"
        CHECK ("proposerType" IN ('user', 'agent', 'service')),
    -- FR-KAN-011: a move without a reason is refused before a row exists. The
    -- constraint is here so a caller that bypasses the service cannot write one.
    CONSTRAINT "task_status_proposals_reason_present" CHECK (length(btrim("reason")) > 0),
    CONSTRAINT "task_status_proposals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_status_proposals_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "task_status_proposals_workspaceId_idempotencyKey_key" ON "task_status_proposals"("workspaceId", "idempotencyKey");
CREATE INDEX "task_status_proposals_taskId_proposedAt_idx" ON "task_status_proposals"("taskId", "proposedAt" DESC);
CREATE INDEX "task_status_proposals_workspaceId_idx" ON "task_status_proposals"("workspaceId");
