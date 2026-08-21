-- EPIC-021 — review gates and roles (FR-ENH-012..016, 023/024).

-- CreateTable — the twelve roles: deployment configuration, not tenant data.
CREATE TABLE "review_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "permittedArtifactTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "review_roles_name_key" ON "review_roles"("name");

-- T274 — seed the twelve named by the source document ("Recommended AI Agents").
INSERT INTO "review_roles" ("id", "name", "responsibility", "permittedArtifactTypes", "updatedAt") VALUES
  ('role_requirements_analyst', 'requirements-analyst', 'Reviews requirements and specifications for completeness, testability, and ambiguity.', ARRAY['specification','requirement'], CURRENT_TIMESTAMP),
  ('role_business_analyst', 'business-analyst', 'Reviews business rules, value alignment, and stakeholder impact.', ARRAY['specification','requirement'], CURRENT_TIMESTAMP),
  ('role_solution_architect', 'solution-architect', 'Reviews architectural fit, boundaries, and technology-stack conformance.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_ux_designer', 'ux-designer', 'Reviews user-facing flows against UI standards and accessibility expectations.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_planning_agent', 'planning-agent', 'Reviews decomposition, sequencing, and dependency realism.', ARRAY['specification','task'], CURRENT_TIMESTAMP),
  ('role_developer_agent', 'developer-agent', 'Authors and reviews implementation-facing content for feasibility.', ARRAY['specification','task'], CURRENT_TIMESTAMP),
  ('role_qa_agent', 'qa-agent', 'Reviews acceptance criteria, test scenarios, and verifiability.', ARRAY['specification','task'], CURRENT_TIMESTAMP),
  ('role_security_reviewer', 'security-reviewer', 'Reviews specifications for security concerns against the security steering subject.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_performance_reviewer', 'performance-reviewer', 'Reviews scale assumptions and performance-sensitive designs.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_documentation_agent', 'documentation-agent', 'Reviews structure, clarity, and conformance to the documentation standard.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_release_manager', 'release-manager', 'Reviews release readiness, baselining, and promotion criteria.', ARRAY['specification'], CURRENT_TIMESTAMP),
  ('role_operations_advisor', 'operations-advisor', 'Reviews operability, observability, and run-time concerns.', ARRAY['specification'], CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "review_gates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transition" TEXT NOT NULL,
    "requiredRoles" TEXT[],
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- The gate fails closed: configuration is required, twelve is never a default.
    CONSTRAINT "review_gates_roles_nonempty" CHECK (array_length("requiredRoles", 1) >= 1),
    CONSTRAINT "review_gates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "review_gates_workspaceId_transition_idx" ON "review_gates"("workspaceId", "transition");
ALTER TABLE "review_gates" ADD CONSTRAINT "review_gates_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "gate_outcomes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "rolesRun" JSONB NOT NULL,
    "gateFailed" BOOLEAN NOT NULL,
    "humanDecision" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "overriddenFindings" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_outcomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gate_outcomes_workspaceId_idx" ON "gate_outcomes"("workspaceId");
CREATE INDEX "gate_outcomes_specificationId_idx" ON "gate_outcomes"("specificationId");
ALTER TABLE "gate_outcomes" ADD CONSTRAINT "gate_outcomes_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gate_outcomes" ADD CONSTRAINT "gate_outcomes_gateId_fkey"
    FOREIGN KEY ("gateId") REFERENCES "review_gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- T287 — append-only, the audit_entries treatment, with ONE precise
-- exception: the one-time decision fill on a row that is still undecided,
-- touching only the decision columns. Everything else is refused raw.
CREATE OR REPLACE FUNCTION gate_outcomes_write_once() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'gate_outcomes is append-only';
    END IF;
    IF OLD."humanDecision" IS NOT NULL THEN
        RAISE EXCEPTION 'gate_outcomes is append-only; this outcome is already decided';
    END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id"
        OR NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId"
        OR NEW."specificationId" IS DISTINCT FROM OLD."specificationId"
        OR NEW."gateId" IS DISTINCT FROM OLD."gateId"
        OR NEW."rolesRun" IS DISTINCT FROM OLD."rolesRun"
        OR NEW."gateFailed" IS DISTINCT FROM OLD."gateFailed"
        OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt" THEN
        RAISE EXCEPTION 'gate_outcomes is append-only; only the one-time decision fill is permitted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "gate_outcomes_immutable"
    BEFORE UPDATE OR DELETE ON "gate_outcomes"
    FOR EACH ROW EXECUTE FUNCTION gate_outcomes_write_once();

-- CreateTable
CREATE TABLE "review_findings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gateOutcomeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- SC-ENH-005: zero unattributed findings — enforced raw as well as in code.
    CONSTRAINT "review_findings_location_nonempty" CHECK (length(btrim("location")) > 0),
    CONSTRAINT "review_findings_role_nonempty" CHECK (length(btrim("roleId")) > 0),
    CONSTRAINT "review_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "review_findings_workspaceId_idx" ON "review_findings"("workspaceId");
CREATE INDEX "review_findings_gateOutcomeId_idx" ON "review_findings"("gateOutcomeId");
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_gateOutcomeId_fkey"
    FOREIGN KEY ("gateOutcomeId") REFERENCES "gate_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
