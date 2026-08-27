-- T1026 (EPIC-037 Band A) — the governed execution registry.
--
-- Ten tables, and the division between them is the design:
--
--   AUTHORITATIVE, append-only (trigger attached):
--     execution_events, agent_identity_snapshots, execution_comments,
--     status_transition_proposals, execution_target_bindings, execution_artifacts
--
--   PROJECTIONS, rebuildable (deliberately NOT protected):
--     execution_state, status_transition_state
--
--   MUTABLE by design:
--     executions (its governanceState is projected), execution_outbox (retries)
--
-- Attaching immutability to a projection would be the same mistake in reverse:
-- a projection that cannot be rewritten cannot be REBUILT, and rebuildability
-- is the property that makes it non-authoritative in the first place.

-- ---------------------------------------------------------------------------
-- 1. executions — stable root identity.
-- ---------------------------------------------------------------------------
CREATE TABLE "executions" (
    "id"                TEXT NOT NULL,
    "correlationId"     TEXT NOT NULL,
    "causationId"       TEXT,
    "idempotencyKey"    TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "projectId"         TEXT,
    "command"           TEXT NOT NULL,
    "argsSanitized"     JSONB NOT NULL,
    "initiatorType"     TEXT NOT NULL,
    "initiatorId"       TEXT NOT NULL,
    "surface"           TEXT NOT NULL,
    "environment"       TEXT,
    -- Projected from the event stream, never written directly by a connector.
    "governanceState"   TEXT NOT NULL DEFAULT 'provisional',
    "parentExecutionId" TEXT,
    "contractVersion"   TEXT NOT NULL,
    "registeredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "executions_surface_vocabulary" CHECK (
        "surface" IN ('managed-sandbox','mcp-client','ide-extension','local-cli','ci-cd','fixture')
    ),
    CONSTRAINT "executions_governance_state_vocabulary" CHECK (
        "governanceState" IN ('provisional','pending_sync','governed')
    ),
    CONSTRAINT "executions_initiator_type_vocabulary" CHECK (
        "initiatorType" IN ('human','agent','service')
    )
);

-- `R-037-8`. Idempotency is a database constraint rather than a read-then-write
-- in application code, which is a race with extra steps.
CREATE UNIQUE INDEX "executions_workspace_idempotency_key"
    ON "executions"("workspaceId", "idempotencyKey");

CREATE INDEX "executions_workspace_correlation_idx" ON "executions"("workspaceId", "correlationId");
CREATE INDEX "executions_parent_idx" ON "executions"("parentExecutionId");

ALTER TABLE "executions"
    ADD CONSTRAINT "executions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A re-run points at its parent. `ON DELETE RESTRICT` because a parent whose
-- child survives it would leave a re-run chain with a hole in it.
ALTER TABLE "executions"
    ADD CONSTRAINT "executions_parentExecutionId_fkey"
    FOREIGN KEY ("parentExecutionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. execution_events — THE authority.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_events" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "executionId"    TEXT NOT NULL,
    -- Server-assigned and gapless PER EXECUTION (`FR-EXR-017`). Deliberately
    -- not a database sequence: those are global and gap on rollback, which
    -- would make "gapless per execution" unprovable.
    "sequence"       INTEGER NOT NULL,
    -- Connector-assigned; null when connected. Retained after reconciliation
    -- so the offline causal order stays readable.
    "localSequence"  INTEGER,
    "class"          TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "payload"        JSONB NOT NULL,
    -- Source clock. EVIDENCE, never the sequencing key (`R-037-3`).
    "occurredAt"     TIMESTAMP(3) NOT NULL,
    "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emittedBy"      TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "integrityHash"  TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "execution_events_class_vocabulary" CHECK (
        "class" IN ('lifecycle','content','registration','governance')
    ),
    CONSTRAINT "execution_events_sequence_positive" CHECK ("sequence" >= 1)
);

-- The gapless guarantee, enforced. Two writers cannot both take sequence N.
CREATE UNIQUE INDEX "execution_events_execution_sequence_key"
    ON "execution_events"("executionId", "sequence");

-- Replay returns the original rather than appending a second event.
CREATE UNIQUE INDEX "execution_events_workspace_idempotency_key"
    ON "execution_events"("workspaceId", "idempotencyKey");

CREATE INDEX "execution_events_workspace_execution_idx"
    ON "execution_events"("workspaceId", "executionId");

ALTER TABLE "execution_events"
    ADD CONSTRAINT "execution_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "execution_events"
    ADD CONSTRAINT "execution_events_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "execution_events_immutable"
    BEFORE UPDATE OR DELETE ON "execution_events"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 3. execution_state — PROJECTION. Rebuildable, and therefore mutable.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_state" (
    "executionId"               TEXT NOT NULL,
    "workspaceId"               TEXT NOT NULL,
    "lifecycleState"            TEXT NOT NULL,
    "governanceState"           TEXT NOT NULL,
    -- Makes staleness VISIBLE. A projection that cannot say how far it has read
    -- is indistinguishable from one that is up to date.
    "projectedThroughSequence"  INTEGER NOT NULL DEFAULT 0,
    "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_state_pkey" PRIMARY KEY ("executionId")
);

CREATE INDEX "execution_state_workspaceId_idx" ON "execution_state"("workspaceId");

ALTER TABLE "execution_state"
    ADD CONSTRAINT "execution_state_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. agent_identity_snapshots — frozen identity (`AC-EXR-14`).
-- ---------------------------------------------------------------------------
CREATE TABLE "agent_identity_snapshots" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "executionId"         TEXT NOT NULL,
    -- Live reference into EPIC-028. The frozen columns beside it are what
    -- history reads, so renaming a descriptor later cannot rewrite the past.
    "descriptorRef"       TEXT NOT NULL,
    "principalSnapshotId" TEXT NOT NULL,
    "provider"            TEXT NOT NULL,
    "model"               TEXT NOT NULL,
    "adapter"             TEXT NOT NULL,
    "agentVersion"        TEXT,
    "capabilities"        TEXT[] NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_identity_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_identity_snapshots_execution_idx"
    ON "agent_identity_snapshots"("workspaceId", "executionId");

ALTER TABLE "agent_identity_snapshots"
    ADD CONSTRAINT "agent_identity_snapshots_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "agent_identity_snapshots_immutable"
    BEFORE UPDATE OR DELETE ON "agent_identity_snapshots"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 5. execution_target_bindings — phase-aware traceability.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_target_bindings" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "executionId"    TEXT NOT NULL,
    "phase"          TEXT NOT NULL,
    "targetType"     TEXT NOT NULL,
    "targetId"       TEXT NOT NULL,
    "targetVersion"  INTEGER,
    "baselineId"     TEXT,
    "repositoryId"   TEXT,
    "branch"         TEXT,
    "worktree"       TEXT,
    "commitSha"      TEXT,
    "artifactDigest" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_target_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "execution_target_bindings_phase_vocabulary" CHECK (
        "phase" IN ('input','output')
    )
);

-- One input binding and at most one output binding per execution. A second
-- input row would make "what did this run against" ambiguous.
CREATE UNIQUE INDEX "execution_target_bindings_execution_phase_key"
    ON "execution_target_bindings"("executionId", "phase");

CREATE INDEX "execution_target_bindings_workspaceId_idx" ON "execution_target_bindings"("workspaceId");

ALTER TABLE "execution_target_bindings"
    ADD CONSTRAINT "execution_target_bindings_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "execution_target_bindings_immutable"
    BEFORE UPDATE OR DELETE ON "execution_target_bindings"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 6. execution_artifacts.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_artifacts" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "role"        TEXT NOT NULL,
    "reference"   TEXT NOT NULL,
    "digest"      TEXT,
    "evidenceId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_artifacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "execution_artifacts_role_vocabulary" CHECK ("role" IN ('affected','generated'))
);

CREATE INDEX "execution_artifacts_execution_idx"
    ON "execution_artifacts"("workspaceId", "executionId");

ALTER TABLE "execution_artifacts"
    ADD CONSTRAINT "execution_artifacts_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "execution_artifacts_immutable"
    BEFORE UPDATE OR DELETE ON "execution_artifacts"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 7. execution_comments — append-only thread (`R-037-9`).
--
--    A correction is a NEW comment pointing at its predecessor. A redaction is
--    an event plus a state flag; the body is never overwritten in place.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_comments" (
    "id"                     TEXT NOT NULL,
    "workspaceId"            TEXT NOT NULL,
    "executionId"            TEXT NOT NULL,
    "authorId"               TEXT NOT NULL,
    "authorType"             TEXT NOT NULL,
    "agentIdentitySnapshotId" TEXT,
    "commentType"            TEXT NOT NULL,
    "body"                   TEXT NOT NULL,
    "parentCommentId"        TEXT,
    "visibilityScope"        TEXT NOT NULL DEFAULT 'workspace',
    "mentions"               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "attachments"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "evidenceRefs"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "actionRequired"         BOOLEAN NOT NULL DEFAULT false,
    "decisionRequired"       BOOLEAN NOT NULL DEFAULT false,
    "supersedesCommentId"    TEXT,
    "integrityHash"          TEXT NOT NULL,
    -- A redaction is recorded ON A NEW ROW, so these describe this row's own
    -- state at insert rather than something later edited into it.
    "redactionState"         TEXT NOT NULL DEFAULT 'visible',
    "redactedBy"             TEXT,
    "redactedAt"             TIMESTAMP(3),
    "redactionReason"        TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "execution_comments_type_vocabulary" CHECK (
        "commentType" IN ('completion','clarification','review','decision','system')
    ),
    CONSTRAINT "execution_comments_author_type_vocabulary" CHECK (
        "authorType" IN ('human','agent','service')
    ),
    CONSTRAINT "execution_comments_redaction_state_vocabulary" CHECK (
        "redactionState" IN ('visible','redacted')
    ),
    CONSTRAINT "execution_comments_redaction_has_actor" CHECK (
        ("redactionState" = 'redacted') = ("redactedBy" IS NOT NULL)
    )
);

CREATE INDEX "execution_comments_execution_idx"
    ON "execution_comments"("workspaceId", "executionId");

ALTER TABLE "execution_comments"
    ADD CONSTRAINT "execution_comments_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "execution_comments_immutable"
    BEFORE UPDATE OR DELETE ON "execution_comments"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 8. status_transition_proposals — the REQUEST. No verdict (`R-037-5`).
--
--    There is deliberately no adjudication column anywhere in this model. A
--    mutable verdict field would become the audit authority by accident, and
--    the verdict belongs to EPIC-030's stream.
-- ---------------------------------------------------------------------------
CREATE TABLE "status_transition_proposals" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "executionId"           TEXT NOT NULL,
    "targetRef"             TEXT NOT NULL,
    "targetVersion"         INTEGER NOT NULL,
    "expectedCurrentStatus" TEXT NOT NULL,
    "proposedState"         TEXT NOT NULL,
    "rationale"             TEXT NOT NULL,
    "proposedBy"            TEXT NOT NULL,
    "proposerSnapshotId"    TEXT NOT NULL,
    "correlationId"         TEXT NOT NULL,
    "idempotencyKey"        TEXT NOT NULL,
    "proposedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transition_proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "status_transition_proposals_workspace_idempotency_key"
    ON "status_transition_proposals"("workspaceId", "idempotencyKey");

CREATE INDEX "status_transition_proposals_execution_idx"
    ON "status_transition_proposals"("workspaceId", "executionId");

ALTER TABLE "status_transition_proposals"
    ADD CONSTRAINT "status_transition_proposals_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "status_transition_proposals_immutable"
    BEFORE UPDATE OR DELETE ON "status_transition_proposals"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- 9. status_transition_state — PROJECTION. Rebuildable, so mutable.
-- ---------------------------------------------------------------------------
CREATE TABLE "status_transition_state" (
    "proposalId"               TEXT NOT NULL,
    "workspaceId"              TEXT NOT NULL,
    "state"                    TEXT NOT NULL,
    "projectedThroughSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transition_state_pkey" PRIMARY KEY ("proposalId"),
    CONSTRAINT "status_transition_state_vocabulary" CHECK (
        "state" IN ('pending','validating','approval_required','applied','refused',
                    'inconsistent','reconciliation_required')
    )
);

CREATE INDEX "status_transition_state_workspaceId_idx" ON "status_transition_state"("workspaceId");

ALTER TABLE "status_transition_state"
    ADD CONSTRAINT "status_transition_state_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "status_transition_proposals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 10. execution_outbox — connector-side, mirrored for reconciliation reporting.
--     Mutable by design: attempts and lastError change as a retry proceeds.
-- ---------------------------------------------------------------------------
CREATE TABLE "execution_outbox" (
    "id"            TEXT NOT NULL,
    "workspaceId"   TEXT NOT NULL,
    "executionId"   TEXT NOT NULL,
    "payload"       JSONB NOT NULL,
    "localSequence" INTEGER NOT NULL,
    "occurredAt"    TIMESTAMP(3) NOT NULL,
    "attempts"      INTEGER NOT NULL DEFAULT 0,
    "lastError"     TEXT,
    "syncedAt"      TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "execution_outbox_execution_idx" ON "execution_outbox"("workspaceId", "executionId");

ALTER TABLE "execution_outbox"
    ADD CONSTRAINT "execution_outbox_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
