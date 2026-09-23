-- T1093 (EPIC-030 Phase C2A) — specification status-transition adjudication.
--
-- FR-GEL-072. ADDITIVE ONLY: one new table. No column is dropped, renamed or
-- retyped; no data is moved; no existing table is altered.
--
-- The reject_mutation() FUNCTION already exists (EPIC-004's init migration) and
-- is bound by seventeen triggers elsewhere. A function protects nothing on its
-- own — the CREATE TRIGGER at the foot of this file is what makes this table
-- append-only, and until it runs the table is ordinary and mutable.

CREATE TABLE "adjudication_records" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "proposalId"          TEXT NOT NULL,
    "executionId"         TEXT NOT NULL,
    "specificationId"     TEXT NOT NULL,
    "idempotencyKey"      TEXT NOT NULL,
    "expectedStatus"      TEXT NOT NULL,
    "requestedStatus"     TEXT NOT NULL,
    "verdict"             TEXT NOT NULL,
    "reason"              TEXT NOT NULL,
    "proposerId"          TEXT NOT NULL,
    "proposerType"        TEXT NOT NULL,
    "proposerSnapshotId"  TEXT NOT NULL,
    "approverId"          TEXT,
    "approverSnapshotId"  TEXT,
    "appliedTransitionId" TEXT,
    "correlationId"       TEXT NOT NULL,
    "causationId"         TEXT NOT NULL,
    -- `decidedAt` is the verdict's decision time, which may be supplied by the
    -- proposal. Per Constitution XII a source timestamp is evidence, never
    -- authority, so row-creation bookkeeping gets its own server-assigned
    -- column rather than borrowing that one.
    "decidedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjudication_records_pkey" PRIMARY KEY ("id")
);

-- FR-GEL-071: a retry returns the ORIGINAL verdict. Without this constraint,
-- idempotency would rest on a read-then-write race in application code.
CREATE UNIQUE INDEX "adjudication_records_workspace_proposal_key"
    ON "adjudication_records"("workspaceId", "proposalId", "idempotencyKey");

CREATE INDEX "adjudication_records_workspace_specification_idx"
    ON "adjudication_records"("workspaceId", "specificationId");

CREATE INDEX "adjudication_records_execution_idx"
    ON "adjudication_records"("executionId");

ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-GEL-072: an adjudication record that can be edited is not evidence.
-- Reusing EPIC-004's function rather than defining a second mechanism for one
-- meaning; the trigger below is new and is what grants the protection.
CREATE TRIGGER "adjudication_records_immutable"
    BEFORE UPDATE OR DELETE ON "adjudication_records"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
