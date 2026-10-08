-- EPIC-031 T731 — the decision engine (data-model §2–§5).
--
-- Four tables, all append-only. Classification RULES are not here: they are
-- EPIC-019 steering documents (R-031-1). Two constraints are fences, not
-- conveniences:
--   * policy_decisions.explanationId NOT NULL       — FR-DPE-040, SC-DPE-002
--   * effectiveClass = 'high' ⇒ actorKind = 'human'  — FR-DPE-010, FR-DPE-012
-- Any CHECK that could meet a NULL is written so NULL cannot satisfy it: a CHECK
-- that evaluates to NULL is ACCEPTED by PostgreSQL (EPIC-032 found that the
-- hard way in its fence 2).

CREATE TABLE "decision_explanations" (
    "id"                   TEXT NOT NULL,
    "workspaceId"          TEXT NOT NULL,
    "policyVersion"        TEXT NOT NULL,
    "matchedRule"          JSONB,
    "riskClass"            TEXT NOT NULL,
    "precedenceResolution" TEXT,
    "authorityApplied"     TEXT NOT NULL,
    "constraintCited"      TEXT,
    "proposalDisagreement" TEXT,
    "triggerRule"          TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decision_explanations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "decision_explanations_risk_class_is_a_band"
        CHECK ("riskClass" IN ('low', 'medium', 'high')),
    CONSTRAINT "decision_explanations_says_what_applied"
        CHECK (length(trim("authorityApplied")) > 0)
);

CREATE TABLE "policy_decisions" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT NOT NULL,
    "projectId"          TEXT NOT NULL,
    "actionType"         TEXT NOT NULL,
    "targetType"         TEXT NOT NULL,
    "targetId"           TEXT NOT NULL,
    "effectiveClass"     TEXT NOT NULL,
    "proposedClass"      TEXT,
    "outcome"            TEXT NOT NULL,
    "decidedBy"          TEXT,
    "authorityBasis"     TEXT NOT NULL,
    "objectVersion"      TEXT NOT NULL,
    "decidedAt"          TIMESTAMP(3),
    "actorKind"          TEXT NOT NULL,
    "actorId"            TEXT NOT NULL,
    "requestedBy"        TEXT,
    "steeringVersions"   JSONB NOT NULL,
    "policyVersion"      INTEGER NOT NULL,
    "requiredGates"      JSONB NOT NULL,
    "gateOutcomes"       JSONB NOT NULL,
    "resolvesDecisionId" TEXT,
    -- FR-DPE-040: an unexplained decision is not representable.
    "explanationId"      TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "policy_decisions_effective_class_is_a_band"
        CHECK ("effectiveClass" IN ('low', 'medium', 'high')),
    CONSTRAINT "policy_decisions_proposed_class_is_a_band"
        CHECK ("proposedClass" IS NULL OR "proposedClass" IN ('low', 'medium', 'high')),
    CONSTRAINT "policy_decisions_outcome_known"
        CHECK ("outcome" IN ('auto-executed', 'approved', 'refused', 'pending', 'exception')),
    CONSTRAINT "policy_decisions_actor_kind_known"
        CHECK ("actorKind" IN ('human', 'automation')),
    -- FR-DPE-010, FR-DPE-012 — ADR-0025 constraint 1, in the schema, not a branch.
    -- Automation may ASK for a high-band action — the request is recorded as
    -- pending, or as refused — but never TAKE one. Forbidding the row outright
    -- would make an agent's refused request unrecordable, which FR-DPE-016 and
    -- FR-DPE-040 both forbid.
    CONSTRAINT "policy_decisions_high_band_is_human"
        CHECK ("effectiveClass" <> 'high' OR "actorKind" = 'human' OR "outcome" IN ('pending', 'refused')),
    -- A decision that is not pending was taken by someone.
    CONSTRAINT "policy_decisions_decided_names_who"
        CHECK ("outcome" = 'pending' OR COALESCE(length(trim("decidedBy")) > 0, false))
);

CREATE TABLE "decision_gate_exceptions" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "decisionId"   TEXT NOT NULL,
    "gateId"       TEXT NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decision_gate_exceptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "decision_gate_exceptions_say_who_and_why"
        CHECK (length(trim("authorizedBy")) > 0 AND length(trim("reason")) > 0)
);

CREATE TABLE "tenant_policies" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "version"             INTEGER NOT NULL,
    "bandTreatment"       JSONB NOT NULL,
    "selfApprovalAllowed" JSONB NOT NULL,
    "automatedActions"    JSONB NOT NULL,
    "approvedBy"          TEXT NOT NULL,
    "approvedAt"          TIMESTAMP(3) NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_policies_version_positive" CHECK ("version" >= 1)
);

ALTER TABLE "decision_explanations" ADD CONSTRAINT "decision_explanations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_explanationId_fkey"
    FOREIGN KEY ("explanationId") REFERENCES "decision_explanations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_resolvesDecisionId_fkey"
    FOREIGN KEY ("resolvesDecisionId") REFERENCES "policy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decision_gate_exceptions" ADD CONSTRAINT "decision_gate_exceptions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decision_gate_exceptions" ADD CONSTRAINT "decision_gate_exceptions_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "policy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_policies" ADD CONSTRAINT "tenant_policies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "decision_explanations_workspaceId_idx" ON "decision_explanations"("workspaceId");
CREATE INDEX "policy_decisions_workspaceId_idx" ON "policy_decisions"("workspaceId");
CREATE INDEX "policy_decisions_workspaceId_outcome_idx" ON "policy_decisions"("workspaceId", "outcome");
CREATE INDEX "policy_decisions_resolvesDecisionId_idx" ON "policy_decisions"("resolvesDecisionId");
CREATE INDEX "decision_gate_exceptions_workspaceId_idx" ON "decision_gate_exceptions"("workspaceId");
CREATE INDEX "decision_gate_exceptions_decisionId_idx" ON "decision_gate_exceptions"("decisionId");
CREATE INDEX "tenant_policies_workspaceId_idx" ON "tenant_policies"("workspaceId");
CREATE UNIQUE INDEX "tenant_policies_workspaceId_version_key" ON "tenant_policies"("workspaceId", "version");

-- Append-only, all four. reject_mutation() is SHARED (init migration): attached, never redefined.
CREATE TRIGGER "decision_explanations_immutable" BEFORE UPDATE OR DELETE ON "decision_explanations"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "policy_decisions_immutable" BEFORE UPDATE OR DELETE ON "policy_decisions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "decision_gate_exceptions_immutable" BEFORE UPDATE OR DELETE ON "decision_gate_exceptions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "tenant_policies_immutable" BEFORE UPDATE OR DELETE ON "tenant_policies"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
