-- T1134 (EPIC-028, C3B) — the non-human principal registry.
--
-- Finding `Y2`: nothing could say who an agent IS. The only actor table was
-- `users`, so an agent could cross a tenant boundary only by being registered
-- as a person -- which the C3B authorisation forbids by name.
--
-- Three tables, and the split matters:
--
--   * `principals`                    -- current identity. State CHANGES, so mutable.
--   * `principal_state_events`        -- why it changed. Append-only.
--   * `principal_identity_snapshots`  -- frozen identity. Append-only.
--
-- Making `principals` immutable would mean a suspension could never be
-- recorded. Making snapshots mutable would mean a revocation could rewrite who
-- acted last week. Both are wrong in opposite directions, so they are separate
-- tables with opposite rules.

-- ---------------------------------------------------------------------------
-- 1. Connector registrations. A surface, not an actor.
-- ---------------------------------------------------------------------------
CREATE TABLE "connector_registrations" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT NOT NULL,
    "kind"               TEXT NOT NULL,
    "registeredByUserId" TEXT NOT NULL,
    "state"              TEXT NOT NULL DEFAULT 'active',
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_registrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "connector_registrations_kind_vocabulary" CHECK (
        "kind" IN ('fixture','managed-sandbox','mcp-client','ide-extension','local-cli','ci-cd')
    ),
    CONSTRAINT "connector_registrations_state_vocabulary" CHECK (
        "state" IN ('active','suspended','revoked')
    )
);

CREATE INDEX "connector_registrations_workspaceId_idx"
    ON "connector_registrations"("workspaceId");

ALTER TABLE "connector_registrations"
    ADD CONSTRAINT "connector_registrations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The registering party is always a person.
ALTER TABLE "connector_registrations"
    ADD CONSTRAINT "connector_registrations_registeredByUserId_fkey"
    FOREIGN KEY ("registeredByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Principals. Agents and services -- never humans, who remain `users`.
-- ---------------------------------------------------------------------------
CREATE TABLE "principals" (
    "id"                      TEXT NOT NULL,
    "workspaceId"             TEXT NOT NULL,
    "kind"                    TEXT NOT NULL,
    "descriptorRef"           TEXT NOT NULL,
    "sponsorUserId"           TEXT NOT NULL,
    "registeredByUserId"      TEXT NOT NULL,
    "state"                   TEXT NOT NULL DEFAULT 'active',
    "identityVersion"         INTEGER NOT NULL DEFAULT 1,
    "connectorRegistrationId" TEXT,
    "correlationId"           TEXT NOT NULL,
    "causationId"             TEXT NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principals_pkey" PRIMARY KEY ("id"),
    -- 'human' is deliberately absent: a human principal is a `users` row.
    -- Allowing it here would create a second answer to "who is this person".
    CONSTRAINT "principals_kind_vocabulary" CHECK ("kind" IN ('agent','service')),
    CONSTRAINT "principals_state_vocabulary" CHECK (
        "state" IN ('active','suspended','revoked')
    ),
    CONSTRAINT "principals_identity_version_positive" CHECK ("identityVersion" >= 1)
);

CREATE INDEX "principals_workspaceId_idx" ON "principals"("workspaceId");
CREATE INDEX "principals_sponsorUserId_idx" ON "principals"("sponsorUserId");

ALTER TABLE "principals"
    ADD CONSTRAINT "principals_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The sponsor is a real person. An FK, not a convention: a sponsor who does not
-- exist is the case that makes "a human is accountable" meaningless.
ALTER TABLE "principals"
    ADD CONSTRAINT "principals_sponsorUserId_fkey"
    FOREIGN KEY ("sponsorUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principals"
    ADD CONSTRAINT "principals_registeredByUserId_fkey"
    FOREIGN KEY ("registeredByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principals"
    ADD CONSTRAINT "principals_connectorRegistrationId_fkey"
    FOREIGN KEY ("connectorRegistrationId") REFERENCES "connector_registrations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. State-change evidence. Append-only.
-- ---------------------------------------------------------------------------
CREATE TABLE "principal_state_events" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "principalId"     TEXT NOT NULL,
    "fromState"       TEXT,
    "toState"         TEXT NOT NULL,
    "identityVersion" INTEGER NOT NULL,
    "actorUserId"     TEXT NOT NULL,
    "reason"          TEXT NOT NULL,
    "correlationId"   TEXT NOT NULL,
    "causationId"     TEXT NOT NULL,
    "occurredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principal_state_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "principal_state_events_to_vocabulary" CHECK (
        "toState" IN ('active','suspended','revoked')
    ),
    CONSTRAINT "principal_state_events_from_vocabulary" CHECK (
        "fromState" IS NULL OR "fromState" IN ('active','suspended','revoked')
    )
);

CREATE INDEX "principal_state_events_workspace_principal_idx"
    ON "principal_state_events"("workspaceId", "principalId");

ALTER TABLE "principal_state_events"
    ADD CONSTRAINT "principal_state_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principal_state_events"
    ADD CONSTRAINT "principal_state_events_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "principal_state_events_immutable"
    BEFORE UPDATE OR DELETE ON "principal_state_events"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 4. Frozen identity snapshots. Append-only.
--
--    This is what separation of duties compares. If a revocation could edit
--    one, deactivating a principal would rewrite who acted last week.
-- ---------------------------------------------------------------------------
CREATE TABLE "principal_identity_snapshots" (
    "id"                      TEXT NOT NULL,
    "workspaceId"             TEXT NOT NULL,
    "principalId"             TEXT NOT NULL,
    "kind"                    TEXT NOT NULL,
    "sponsorUserId"           TEXT,
    "identityVersion"         INTEGER NOT NULL,
    "connectorRegistrationId" TEXT,
    "capturedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principal_identity_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "principal_identity_snapshots_kind_vocabulary" CHECK (
        "kind" IN ('human','agent','service')
    ),
    -- A human principal has no sponsor; a non-human one must.
    CONSTRAINT "principal_identity_snapshots_sponsor_when_non_human" CHECK (
        ("kind" = 'human') = ("sponsorUserId" IS NULL)
    )
);

CREATE INDEX "principal_identity_snapshots_workspace_principal_idx"
    ON "principal_identity_snapshots"("workspaceId", "principalId");

ALTER TABLE "principal_identity_snapshots"
    ADD CONSTRAINT "principal_identity_snapshots_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "principal_identity_snapshots_immutable"
    BEFORE UPDATE OR DELETE ON "principal_identity_snapshots"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 5. Scoped delegation (EPIC-024, `T1139`).
--
--    A sponsor owning an artifact must NOT hand every agent they sponsor the
--    run of everything they own. Delegation is explicit, scoped and expiring.
--
--    The permitted set is a CHECK rather than a convention: an execution
--    delegation that could carry `transition.approve` would let a sponsor
--    delegate away the separation of duties EPIC-030 enforces.
-- ---------------------------------------------------------------------------
CREATE TABLE "principal_delegations" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "principalId"     TEXT NOT NULL,
    "sponsorUserId"   TEXT NOT NULL,
    "artifactType"    TEXT NOT NULL,
    "artifactId"      TEXT NOT NULL,
    "actions"         TEXT[] NOT NULL,
    "identityVersion" INTEGER NOT NULL,
    "effectiveFrom"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"       TIMESTAMP(3),
    "revokedAt"       TIMESTAMP(3),
    "revokedById"     TEXT,
    "correlationId"   TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principal_delegations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "principal_delegations_actions_permitted" CHECK (
        "actions" <@ ARRAY[
            'execution.register',
            'execution.report',
            'execution.attach-evidence',
            'transition.propose'
        ]::TEXT[]
    ),
    CONSTRAINT "principal_delegations_actions_present" CHECK (
        array_length("actions", 1) >= 1
    ),
    CONSTRAINT "principal_delegations_revoked_has_actor" CHECK (
        ("revokedAt" IS NULL) = ("revokedById" IS NULL)
    )
);

CREATE INDEX "principal_delegations_lookup_idx"
    ON "principal_delegations"("workspaceId", "principalId", "artifactType", "artifactId");

ALTER TABLE "principal_delegations"
    ADD CONSTRAINT "principal_delegations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principal_delegations"
    ADD CONSTRAINT "principal_delegations_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "principal_delegations"
    ADD CONSTRAINT "principal_delegations_sponsorUserId_fkey"
    FOREIGN KEY ("sponsorUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
