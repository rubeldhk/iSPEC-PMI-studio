-- T1117 (EPIC-030 C2D) — explicit, durable, versioned auto-application policy.
--
-- `X15`. C2C flipped `autoApplyPermitted`'s default from false to true so the
-- end-to-end proof could reach `applied`. That was a security default changed to
-- make a test pass: with no way to configure a rule, every transition that got
-- past the gates applied automatically, and nothing recorded that anyone had
-- decided it should.
--
-- The default returns to **false**. Application now requires an explicit,
-- effective policy row -- so "nobody configured this" and "somebody authorised
-- this" stop being the same state.
--
-- Append-only and versioned: updating a policy writes a NEW version rather than
-- changing the row an earlier adjudication was decided under. An audit that can
-- be rewritten after the fact answers nothing.

CREATE TABLE "application_policies" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "targetArtifactType"  TEXT NOT NULL,
    "fromStatus"          TEXT NOT NULL,
    "toStatus"            TEXT NOT NULL,
    "requiredAuthorities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "autoApplyPermitted"  BOOLEAN NOT NULL,
    "policyVersion"       INTEGER NOT NULL,
    -- A policy is withdrawn by appending a disabled version, never by deleting.
    "state"               TEXT NOT NULL,
    "createdById"         TEXT NOT NULL,
    "createdBySnapshotId" TEXT,
    "approvedById"        TEXT,
    "approvedBySnapshotId" TEXT,
    "effectiveFrom"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId"       TEXT NOT NULL,
    "supersedesId"        TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "application_policies_state_vocabulary" CHECK (
        "state" IN ('effective', 'disabled')
    ),
    -- Auto-application is an authorised act, not a configuration convenience.
    -- A permissive policy nobody approved is the state `X15` was about.
    CONSTRAINT "application_policies_auto_apply_needs_approver" CHECK (
        "autoApplyPermitted" = false OR "approvedById" IS NOT NULL
    ),
    CONSTRAINT "application_policies_version_positive" CHECK ("policyVersion" >= 1)
);

-- Versions are unique and monotonic per transition. Deliberately NOT a partial
-- unique index over `state = 'effective'`: the table is append-only, so a
-- withdrawal cannot flip the previous row to disabled -- it appends a higher
-- version that says so. "Effective" is therefore a property of the LATEST
-- version, not a flag that one row holds forever.
CREATE UNIQUE INDEX "application_policies_version_unique"
    ON "application_policies"("workspaceId", "targetArtifactType", "fromStatus", "toStatus",
                              "policyVersion");

CREATE INDEX "application_policies_lookup_idx"
    ON "application_policies"("workspaceId", "targetArtifactType", "fromStatus", "toStatus");

ALTER TABLE "application_policies"
    ADD CONSTRAINT "application_policies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The row an adjudication was decided under must still read the same way later.
CREATE TRIGGER "application_policies_immutable"
    BEFORE UPDATE OR DELETE ON "application_policies"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
