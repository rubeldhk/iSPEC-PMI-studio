-- EPIC-033 — the Requirement Room. T337v.
--
-- Six tables, and two constraints that are the reason this migration is
-- hand-written rather than generated.
--
--   * decidedByKind = 'human' on every requirement decision (FR-RQR-041).
--     EPIC-031's policy engine is the braces; this is the belt, because a
--     caller can go around a service and a governed decision taken by an agent
--     is the one failure this Room exists to prevent.
--   * baselines are append-only except for `supersededBy` (RULE-02, BR-0026).
--     A baseline is superseded, never rewritten — rewriting one changes what an
--     approved decision approved, silently, after the fact.
--
-- What is NOT here: requirement text. FR-RQR-002 and D-33 — EPIC-007 owns the
-- register. `memberVersionIds` freezes VERSION IDS (R-033-5); a copy of the text
-- would be a second source of truth that drifts and looks right the whole time.

-- CreateEnum
CREATE TYPE "RoomEpistemic" AS ENUM ('fact', 'inference', 'recommendation', 'open_question');
CREATE TYPE "DecidedByKind" AS ENUM ('human', 'agent');

-- CreateTable
CREATE TABLE "requirement_candidates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomObjectId" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "epistemic" "RoomEpistemic" NOT NULL,
    "aiAnalysis" JSONB,
    "promotedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clarifications" (
    "id" TEXT NOT NULL,
    -- FR-002 / BR-0001 — every tenant-scoped table carries workspaceId from the
    -- FIRST migration, so row-level security is a switch rather than a data
    -- migration. Reachable through a parent is not the same as scoped.
    "workspaceId" TEXT NOT NULL,
    "roomObjectId" TEXT NOT NULL,
    "candidateId" TEXT,
    "question" TEXT NOT NULL,
    "askedBy" TEXT NOT NULL,
    "answer" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TIMESTAMP(3),
    "blocksBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "requirement_decisions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roomObjectId" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedByKind" "DecidedByKind" NOT NULL,
    "authorityBasis" TEXT NOT NULL,
    "objectVersion" INTEGER NOT NULL,
    "chosenOption" TEXT NOT NULL,
    "declinedOptions" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "decisionId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "baselines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "memberVersionIds" JSONB NOT NULL,
    "setHash" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rationale" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "supersededBy" INTEGER,
    "evidenceContractRef" TEXT,

    CONSTRAINT "baselines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "baseline_exceptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "requirementVersionId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "baselineVersion" INTEGER NOT NULL,
    "specificationWorkflowRef" TEXT NOT NULL,
    "selectedBy" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_candidates_workspaceId_roomObjectId_idx" ON "requirement_candidates"("workspaceId", "roomObjectId");
CREATE INDEX "requirement_candidates_workspaceId_projectId_idx" ON "requirement_candidates"("workspaceId", "projectId");
CREATE INDEX "clarifications_workspaceId_idx" ON "clarifications"("workspaceId");
CREATE INDEX "clarifications_roomObjectId_idx" ON "clarifications"("roomObjectId");
-- UX-0032 — "what is blocking" without opening another screen, so the readiness
-- query must not scan.
CREATE INDEX "clarifications_roomObjectId_blocksBaseline_idx" ON "clarifications"("roomObjectId", "blocksBaseline");
CREATE INDEX "requirement_decisions_workspaceId_roomObjectId_idx" ON "requirement_decisions"("workspaceId", "roomObjectId");
CREATE UNIQUE INDEX "baselines_projectId_version_key" ON "baselines"("projectId", "version");
CREATE INDEX "baselines_workspaceId_projectId_idx" ON "baselines"("workspaceId", "projectId");
CREATE INDEX "baseline_exceptions_workspaceId_idx" ON "baseline_exceptions"("workspaceId");
CREATE INDEX "baseline_exceptions_baselineId_idx" ON "baseline_exceptions"("baselineId");
CREATE INDEX "handoffs_workspaceId_idx" ON "handoffs"("workspaceId");
CREATE INDEX "handoffs_baselineId_idx" ON "handoffs"("baselineId");

-- AddForeignKey
ALTER TABLE "requirement_candidates" ADD CONSTRAINT "requirement_candidates_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "requirement_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "requirement_decisions" ADD CONSTRAINT "requirement_decisions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "requirement_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baseline_exceptions" ADD CONSTRAINT "baseline_exceptions_baselineId_fkey"
    FOREIGN KEY ("baselineId") REFERENCES "baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_baselineId_fkey"
    FOREIGN KEY ("baselineId") REFERENCES "baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-RQR-041 — a requirement decision is taken by a HUMAN.
--
-- RULE-03: AI recommends; humans and policy govern. EPIC-031 evaluates the
-- authority and this is the belt beside those braces — a service check protects
-- callers who go through the service, and this protects everyone else.
ALTER TABLE "requirement_decisions" ADD CONSTRAINT "requirement_decisions_decided_by_a_human"
    CHECK ("decidedByKind" = 'human');

-- BR-0025 — a decision states its rationale. Empty is not a rationale: "" passes
-- a NOT NULL check and explains nothing.
ALTER TABLE "requirement_decisions" ADD CONSTRAINT "requirement_decisions_state_their_rationale"
    CHECK (length(trim("rationale")) > 0);

ALTER TABLE "baselines" ADD CONSTRAINT "baselines_state_their_rationale"
    CHECK (length(trim("rationale")) > 0);

-- FR-RQR-032 — an exception names its authorizer AND its reason. Either one
-- missing makes it a bypass with a nicer name.
ALTER TABLE "baseline_exceptions" ADD CONSTRAINT "baseline_exceptions_are_explicit"
    CHECK (length(trim("authorizedBy")) > 0 AND length(trim("reason")) > 0);

-- RULE-02, BR-0026 — a baseline is SUPERSEDED, never rewritten.
--
-- Not fully immutable: `supersededBy` must be settable, which is how a new
-- baseline records that it replaced this one. "Append-only except one column" is
-- not a rule any shared trigger expresses, so this one is specific and named for
-- what it permits. EPIC-030's loop_instance_configurations trigger is the
-- precedent.
CREATE OR REPLACE FUNCTION reject_baseline_rewrite() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'baselines are append-only (RULE-02, BR-0026)';
    END IF;
    IF NEW."id" <> OLD."id"
       OR NEW."projectId" <> OLD."projectId"
       OR NEW."version" <> OLD."version"
       OR NEW."memberVersionIds"::text <> OLD."memberVersionIds"::text
       OR NEW."setHash" <> OLD."setHash"
       OR NEW."approvedBy" <> OLD."approvedBy"
       OR NEW."rationale" <> OLD."rationale"
       OR NEW."decisionId" <> OLD."decisionId" THEN
        RAISE EXCEPTION 'a baseline is superseded, never rewritten (RULE-02, BR-0026)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "baselines_supersede_only"
    BEFORE UPDATE OR DELETE ON "baselines"
    FOR EACH ROW EXECUTE FUNCTION reject_baseline_rewrite();

-- Clarifications are retained once answered (FR-RQR-013). The answer is part of
-- the requirement record, not scaffolding — so a DELETE is refused outright,
-- while an UPDATE is how an answer arrives.
CREATE TRIGGER "clarifications_are_retained"
    BEFORE DELETE ON "clarifications"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
