-- `T1286`, `T1288` (EPIC-038) — the two degrading ports, recorded.
--
-- `FR-CTX-020`–`FR-CTX-023`, `FR-CTX-015`, `R-038-8`. Live state and execution
-- history may be absent from a package — that is what "degrade" means — but
-- the absence must be on the record, with a reason. Otherwise "nobody could
-- look" and "looked and found nothing" are the same row.

-- Nullable, with no default: NULL means the writer recorded nothing, which is
-- true of every row written before this migration. A default would claim a
-- status nobody observed — `'unavailable'` for history that may well have been
-- there, or `'not-requested'` for a request nobody saw.
ALTER TABLE "context_packages"
    ADD COLUMN "liveState"              TEXT,
    ADD COLUMN "liveStateReason"        TEXT,
    ADD COLUMN "executionHistory"       TEXT,
    ADD COLUMN "executionHistoryReason" TEXT;

ALTER TABLE "context_packages"
    ADD CONSTRAINT "context_packages_live_state_is_known" CHECK (
        "liveState" IN ('not-requested','read','unavailable')
    ),
    -- FR-CTX-022 — unavailable says why.
    ADD CONSTRAINT "context_packages_live_state_unavailable_says_why" CHECK (
        "liveState" <> 'unavailable' OR length(trim(coalesce("liveStateReason",''))) > 0
    ),
    ADD CONSTRAINT "context_packages_execution_history_is_known" CHECK (
        "executionHistory" IN ('available','unavailable')
    ),
    -- FR-CTX-015 — history that dropped out says why.
    ADD CONSTRAINT "context_packages_execution_history_unavailable_says_why" CHECK (
        "executionHistory" <> 'unavailable'
        OR length(trim(coalesce("executionHistoryReason",''))) > 0
    );

-- One element of live state, as the package was given it. A reference and a
-- state word, never a payload: the systems that hold the state remain where
-- it is read, under their own access rules.
CREATE TABLE "context_live_state" (
    "id"          TEXT NOT NULL,
    -- FR-002 — its own tenant, as items and exclusions carry theirs.
    "workspaceId" TEXT NOT NULL,
    "packageId"   TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "ref"         TEXT NOT NULL,
    "state"       TEXT NOT NULL,
    -- FR-CTX-021 — the instant it was read. No default: a database clock
    -- stamping it would claim a reading time nobody observed.
    "readAt"      TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_live_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_live_state_package_fkey" FOREIGN KEY ("packageId")
        REFERENCES "context_packages"("id") ON DELETE CASCADE,
    CONSTRAINT "context_live_state_kind_is_known" CHECK (
        "kind" IN ('repository','branch','pull-request','workflow','build','test','deployment','incident')
    ),
    CONSTRAINT "context_live_state_names_ref" CHECK (length(trim("ref")) > 0)
);

CREATE INDEX "context_live_state_workspaceId_idx" ON "context_live_state"("workspaceId");
CREATE INDEX "context_live_state_packageId_idx" ON "context_live_state"("packageId");
