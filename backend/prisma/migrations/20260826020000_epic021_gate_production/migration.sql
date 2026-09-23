-- T1107 (EPIC-021 C2C reopening) — the authoritative, immutable gate decision.
--
-- `gate_outcomes` stays exactly as it is: a MUTABLE working record, because
-- `fillDecision` writes the human decision after the roles have run and that is
-- a legitimate two-phase workflow object. What it cannot be is the authoritative
-- final answer -- an UPDATE-able row cannot evidence a decision.
--
-- So the final decision is a separate, append-only table. A correction is a new
-- row linked to the one it supersedes; nothing is ever overwritten.
--
-- Additive: no existing table is altered and no data is rewritten.

CREATE TABLE "gate_final_outcomes" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "specificationId"   TEXT NOT NULL,
    -- The exact transition this decision authorises. A decision for one
    -- transition must never authorise another.
    "fromStatus"        TEXT NOT NULL,
    "toStatus"          TEXT NOT NULL,
    -- X11: the evaluated target. An outcome not bound to the version it
    -- examined could authorise a transition on a specification that has since
    -- changed underneath it.
    "targetVersionId"   TEXT,
    -- The applicable-gate SET this decision was made against. Gates are
    -- append-only, so adding one changes the set and invalidates decisions made
    -- against the old one.
    "gateSetVersion"    TEXT NOT NULL,
    "gateId"            TEXT NOT NULL,
    "disposition"       TEXT NOT NULL,
    "reason"            TEXT NOT NULL,
    -- Frozen identities, never display metadata.
    "evaluatorId"       TEXT NOT NULL,
    "evaluatorSnapshotId" TEXT,
    "decidedById"       TEXT,
    "decidedBySnapshotId" TEXT,
    "decidedAt"         TIMESTAMP(3),
    "evidenceRefs"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "correlationId"     TEXT NOT NULL,
    "causationId"       TEXT NOT NULL,
    -- A correction links to what it supersedes rather than replacing it.
    "supersedesId"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_final_outcomes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gate_final_outcomes_disposition_vocabulary" CHECK (
        "disposition" IN ('passed', 'failed')
    ),
    -- FR-ENH-014: a human decision is required. A `passed` final outcome with
    -- no decider would be an automated verdict advancing a gated transition,
    -- which is the thing the requirement exists to prevent.
    CONSTRAINT "gate_final_outcomes_passed_needs_decider" CHECK (
        "disposition" <> 'passed' OR ("decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL)
    )
);

CREATE INDEX "gate_final_outcomes_lookup_idx"
    ON "gate_final_outcomes"("workspaceId", "specificationId", "fromStatus", "toStatus");

CREATE INDEX "gate_final_outcomes_gate_idx"
    ON "gate_final_outcomes"("workspaceId", "gateId");

ALTER TABLE "gate_final_outcomes"
    ADD CONSTRAINT "gate_final_outcomes_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The function alone protects nothing. This is what makes the decision
-- append-only, for every role including the application's own.
CREATE TRIGGER "gate_final_outcomes_immutable"
    BEFORE UPDATE OR DELETE ON "gate_final_outcomes"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
