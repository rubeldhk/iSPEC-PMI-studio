-- EPIC-047 T1910 — Engineering Experts.
--
-- Six tables (data-model.md). Hand-written CHECK constraints and two triggers,
-- because the rules they enforce are the ones an application refactor would
-- quietly drop (R-047-14):
--
--   * a contract version is immutable — its decision id may be written once,
--     from null, and nothing else may change; no version is ever deleted;
--   * an assignment is append-only — it may be superseded once, and nothing
--     else may change.
--
-- The contract is stored whole as jsonb. Its memory policy and risk class are
-- CHECKed inside the document, so the rule binds the stored contract itself
-- rather than a copied column that could drift from it.

-- CreateTable
CREATE TABLE "engineering_experts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "registeredBy" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredBy" TEXT,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "engineering_experts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "engineering_experts_status_check" CHECK ("status" IN ('active', 'retired')),
    -- FR-EXP-006/007: a retirement records who and when, and only a retirement does.
    CONSTRAINT "engineering_experts_retired_check" CHECK (
        ("status" = 'retired') = ("retiredAt" IS NOT NULL AND "retiredBy" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "engineering_experts_workspaceId_key_key" ON "engineering_experts"("workspaceId", "key");
ALTER TABLE "engineering_experts" ADD CONSTRAINT "engineering_experts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "expert_contract_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contract" JSONB NOT NULL,
    "decisionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_contract_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expert_contract_versions_version_check" CHECK ("version" >= 1),
    -- FR-EXP-020 (clarified 2026-10-09): no memory beyond the session.
    CONSTRAINT "expert_contract_versions_memory_check" CHECK ("contract"->>'memoryPolicy' = 'none'),
    -- R-047-6: EPIC-031's three bands.
    CONSTRAINT "expert_contract_versions_risk_check" CHECK ("contract"->>'riskClass' IN ('low', 'medium', 'high'))
);

CREATE UNIQUE INDEX "expert_contract_versions_expertId_version_key" ON "expert_contract_versions"("expertId", "version");
CREATE INDEX "expert_contract_versions_workspaceId_idx" ON "expert_contract_versions"("workspaceId");
ALTER TABLE "expert_contract_versions" ADD CONSTRAINT "expert_contract_versions_expertId_fkey"
    FOREIGN KEY ("expertId") REFERENCES "engineering_experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "expert_contract_versions_immutable"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'expert contract versions are immutable: version % cannot be deleted (R-047-14)', OLD."version";
    END IF;
    IF OLD."decisionId" IS NULL AND NEW."decisionId" IS NOT NULL
       AND NEW."id" = OLD."id" AND NEW."workspaceId" = OLD."workspaceId"
       AND NEW."expertId" = OLD."expertId" AND NEW."version" = OLD."version"
       AND NEW."contract" = OLD."contract" AND NEW."createdBy" = OLD."createdBy"
       AND NEW."createdAt" = OLD."createdAt" THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'expert contract versions are immutable: only a null decisionId may be written, once (R-047-14)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "expert_contract_versions_immutable"
    BEFORE UPDATE OR DELETE ON "expert_contract_versions"
    FOR EACH ROW EXECUTE FUNCTION "expert_contract_versions_immutable"();

-- CreateTable
CREATE TABLE "expert_delegation_policies" (
    "workspaceId" TEXT NOT NULL,
    "maxDepth" INTEGER NOT NULL DEFAULT 3,
    "maxFanOut" INTEGER NOT NULL DEFAULT 5,
    "allowedPairs" JSONB NOT NULL DEFAULT '[]',
    "maxUnattendedBand" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_delegation_policies_bounds_check" CHECK ("maxDepth" >= 1 AND "maxFanOut" >= 1),
    CONSTRAINT "expert_delegation_policies_band_check" CHECK ("maxUnattendedBand" IN ('low', 'medium', 'high'))
);

-- One policy per workspace: the workspace IS the key, declared through its index.
CREATE UNIQUE INDEX "expert_delegation_policies_pkey" ON "expert_delegation_policies"("workspaceId");
ALTER TABLE "expert_delegation_policies" ADD CONSTRAINT "expert_delegation_policies_pkey"
    PRIMARY KEY USING INDEX "expert_delegation_policies_pkey";
ALTER TABLE "expert_delegation_policies" ADD CONSTRAINT "expert_delegation_policies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "expert_sessions" (
    "executionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    -- R-047-3: the DELEGATION parent. Not EPIC-037's re-run parent.
    "delegatedFromExecutionId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "fallbackReason" TEXT,
    "effectiveAuthority" JSONB NOT NULL,
    "toolObservation" TEXT NOT NULL,
    "unattended" BOOLEAN NOT NULL DEFAULT false,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "expert_sessions_pkey" PRIMARY KEY ("executionId"),
    CONSTRAINT "expert_sessions_depth_check" CHECK (
        "depth" >= 0 AND ("depth" = 0) = ("delegatedFromExecutionId" IS NULL)
    ),
    -- FR-EXP-017: a fallback says why.
    CONSTRAINT "expert_sessions_fallback_check" CHECK ("usedFallback" = ("fallbackReason" IS NOT NULL)),
    -- FR-EXP-024: never 'observed' by default — the column has none.
    CONSTRAINT "expert_sessions_tools_check" CHECK ("toolObservation" IN ('observed', 'unobserved')),
    -- FR-EXP-063: unattended work always enters review.
    CONSTRAINT "expert_sessions_review_check" CHECK (NOT "unattended" OR "reviewRequired"),
    CONSTRAINT "expert_sessions_outcome_check" CHECK (
        "outcome" IS NULL OR "outcome" IN ('succeeded', 'incomplete', 'failed', 'stopped-by-limit', 'stopped-by-parent')
    ),
    CONSTRAINT "expert_sessions_ended_check" CHECK (("outcome" IS NULL) = ("endedAt" IS NULL))
);

CREATE INDEX "expert_sessions_workspaceId_expertId_idx" ON "expert_sessions"("workspaceId", "expertId");
CREATE INDEX "expert_sessions_delegatedFromExecutionId_idx" ON "expert_sessions"("delegatedFromExecutionId");
ALTER TABLE "expert_sessions" ADD CONSTRAINT "expert_sessions_expertId_fkey"
    FOREIGN KEY ("expertId") REFERENCES "engineering_experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_sessions" ADD CONSTRAINT "expert_sessions_contractVersionId_fkey"
    FOREIGN KEY ("contractVersionId") REFERENCES "expert_contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expert_sessions" ADD CONSTRAINT "expert_sessions_delegatedFromExecutionId_fkey"
    FOREIGN KEY ("delegatedFromExecutionId") REFERENCES "expert_sessions"("executionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "expert_session_limits" (
    "executionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "limit" TEXT NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "requested" DECIMAL(20,4),
    "enforcement" TEXT NOT NULL,
    "consumed" DECIMAL(20,4),
    "consumedReason" TEXT,
    "reached" TEXT NOT NULL DEFAULT 'no',
    "detectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_session_limits_pkey" PRIMARY KEY ("executionId", "limit"),
    CONSTRAINT "expert_session_limits_limit_check" CHECK ("limit" IN ('time', 'resource', 'tokens', 'cost')),
    CONSTRAINT "expert_session_limits_enforcement_check" CHECK ("enforcement" IN ('enforced', 'unenforceable')),
    CONSTRAINT "expert_session_limits_reached_check" CHECK ("reached" IN ('no', 'stopped', 'detected-late')),
    -- FR-EXP-041/042: only an enforced limit can have stopped anything.
    CONSTRAINT "expert_session_limits_stopped_check" CHECK ("reached" <> 'stopped' OR "enforcement" = 'enforced'),
    -- FR-EXP-046: a late breach carries the instant it was detected.
    CONSTRAINT "expert_session_limits_late_check" CHECK ("reached" <> 'detected-late' OR "detectedAt" IS NOT NULL)
);

CREATE INDEX "expert_session_limits_workspaceId_idx" ON "expert_session_limits"("workspaceId");
ALTER TABLE "expert_session_limits" ADD CONSTRAINT "expert_session_limits_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "expert_sessions"("executionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assigneeKind" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "decisionId" TEXT,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "supersededBy" TEXT,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_assignments_kind_check" CHECK ("assigneeKind" IN ('person', 'expert')),
    -- FR-EXP-052: every assignment says what permitted it.
    CONSTRAINT "task_assignments_rule_check" CHECK (length(trim("rule")) > 0),
    CONSTRAINT "task_assignments_state_check" CHECK ("state" IN ('standing', 'pending-decision')),
    -- FR-EXP-054: a gated assignment names its decision.
    CONSTRAINT "task_assignments_decision_check" CHECK ("state" <> 'pending-decision' OR "decisionId" IS NOT NULL),
    CONSTRAINT "task_assignments_superseded_check" CHECK (("supersededAt" IS NULL) = ("supersededBy" IS NULL))
);

CREATE INDEX "task_assignments_workspaceId_taskId_idx" ON "task_assignments"("workspaceId", "taskId");
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "task_assignments_append_only"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'task assignments are append-only: assignment % cannot be deleted (FR-EXP-055)', OLD."id";
    END IF;
    IF OLD."supersededAt" IS NULL AND NEW."supersededAt" IS NOT NULL
       AND NEW."id" = OLD."id" AND NEW."workspaceId" = OLD."workspaceId" AND NEW."taskId" = OLD."taskId"
       AND NEW."assigneeKind" = OLD."assigneeKind" AND NEW."assigneeId" = OLD."assigneeId"
       AND NEW."rule" = OLD."rule" AND NEW."state" = OLD."state"
       AND NEW."decisionId" IS NOT DISTINCT FROM OLD."decisionId"
       AND NEW."assignedBy" = OLD."assignedBy" AND NEW."assignedAt" = OLD."assignedAt" THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'task assignments are append-only: an assignment may only be superseded, once (FR-EXP-055)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "task_assignments_append_only"
    BEFORE UPDATE OR DELETE ON "task_assignments"
    FOR EACH ROW EXECUTE FUNCTION "task_assignments_append_only"();
