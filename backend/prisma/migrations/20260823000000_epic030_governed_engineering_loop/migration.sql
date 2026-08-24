-- EPIC-030 — the Governed Engineering Loop. T993o.
--
-- Three tables. `loop_transitions` is the append-only core and the only writer
-- of `loop_objects.currentStage`; `loop_instance_configurations` is never
-- UPDATEd, because a configuration change writes a new version and supersedes
-- the old one, which is what makes FR-GEL-006 hold by construction.
--
-- Two of the constraints below are the ones this Epic exists for, and both are
-- database constraints rather than service checks because a service check is
-- bypassable by any caller that goes around it:
--
--   * actorKind = 'automation' => triggerRuleId IS NOT NULL  (FR-GEL-031).
--     RULE-11 forbids invisible automation, and this is where that becomes
--     unrepresentable rather than merely forbidden.
--   * outcome = 'accepted' => refusalReason IS NULL, else NOT NULL
--     (FR-GEL-014). A refusal with no recorded reason is the shape of a silent
--     pass.

-- CreateEnum
CREATE TYPE "LoopTransitionOutcome" AS ENUM ('accepted', 'refused', 'conflict', 'exception', 'violation');
CREATE TYPE "LoopActorKind" AS ENUM ('human', 'automation');

-- CreateTable
CREATE TABLE "loop_instance_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "stages" JSONB NOT NULL,
    "authorities" JSONB NOT NULL,
    "requiredGates" JSONB NOT NULL,
    "triggerRules" JSONB NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvalRef" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededBy" INTEGER,

    CONSTRAINT "loop_instance_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_objects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loop_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loop_transitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectVersion" INTEGER NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "outcome" "LoopTransitionOutcome" NOT NULL,
    "refusalReason" TEXT,
    "wonBy" TEXT,
    "actorId" TEXT NOT NULL,
    "actorKind" "LoopActorKind" NOT NULL,
    "authorityBasis" TEXT NOT NULL,
    "triggerRuleId" TEXT,
    "triggerEventId" TEXT,
    "configVersion" INTEGER NOT NULL,
    "gateOutcomes" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loop_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loop_instance_configurations_workspaceId_workflowType_config_key"
    ON "loop_instance_configurations"("workspaceId", "workflowType", "configVersion");
CREATE INDEX "loop_instance_configurations_workspaceId_workflowType_idx"
    ON "loop_instance_configurations"("workspaceId", "workflowType");

-- SC-GEL-006 — which stage is it in and how long has it been there, without a scan.
CREATE INDEX "loop_objects_workspaceId_workflowType_currentStage_idx"
    ON "loop_objects"("workspaceId", "workflowType", "currentStage");
-- The Room's own join back to its subject, which this Epic keeps opaque.
CREATE INDEX "loop_objects_workspaceId_subjectType_subjectId_idx"
    ON "loop_objects"("workspaceId", "subjectType", "subjectId");

CREATE INDEX "loop_transitions_objectId_occurredAt_idx"
    ON "loop_transitions"("objectId", "occurredAt");
CREATE INDEX "loop_transitions_workspaceId_outcome_idx"
    ON "loop_transitions"("workspaceId", "outcome");

-- AddForeignKey
ALTER TABLE "loop_instance_configurations" ADD CONSTRAINT "loop_instance_configurations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loop_objects" ADD CONSTRAINT "loop_objects_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loop_transitions" ADD CONSTRAINT "loop_transitions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loop_transitions" ADD CONSTRAINT "loop_transitions_objectId_fkey"
    FOREIGN KEY ("objectId") REFERENCES "loop_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-GEL-031 — RULE-11 made unrepresentable.
--
-- An automated transition with no visible rule id cannot be written, by anyone,
-- including a service that forgot. This is the constraint the whole "no
-- invisible automation" rule turns on, so it is not left to application code.
ALTER TABLE "loop_transitions" ADD CONSTRAINT "loop_transitions_automation_names_its_rule"
    CHECK ("actorKind" <> 'automation' OR "triggerRuleId" IS NOT NULL);

-- FR-GEL-014 — a refusal always carries its reason, and an acceptance never
-- carries one. Both directions, because "accepted with a refusalReason" is a
-- row nobody can interpret.
ALTER TABLE "loop_transitions" ADD CONSTRAINT "loop_transitions_refusal_states_its_reason"
    CHECK (
        ("outcome" = 'accepted' AND "refusalReason" IS NULL)
        OR ("outcome" <> 'accepted' AND "refusalReason" IS NOT NULL)
    );

-- FR-GEL-033 — idempotency: one rule, one event, one advance.
--
-- PARTIAL, on accepted rows only. A rule that fired twice and was refused the
-- second time must still be able to record the refusal — that record is the
-- evidence the guard worked, and a total unique index would suppress it.
CREATE UNIQUE INDEX "loop_transitions_one_advance_per_rule_event"
    ON "loop_transitions"("objectId", "triggerEventId", "triggerRuleId")
    WHERE "outcome" = 'accepted';

-- FR-GEL-040 — append-only at the database.
--
-- `reject_mutation()` is EPIC-004's shared function, created by T454 in the init
-- migration. Deliberately NOT redefined here: one function, one rule, every
-- append-only table attaches to it. `audit_entries` and `requirement_versions`
-- are the precedents.
CREATE TRIGGER "loop_transitions_immutable"
    BEFORE UPDATE OR DELETE ON "loop_transitions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- A configuration row is never updated either: a change writes a new
-- configVersion and sets supersededBy on the prior row. UPDATE is therefore
-- allowed ONLY to set supersededBy, which no shared trigger expresses — so this
-- one is specific, and says why in its name.
CREATE OR REPLACE FUNCTION reject_loop_config_rewrite() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'loop_instance_configurations is append-only (FR-GEL-006)';
    END IF;
    IF row(NEW.*) IS DISTINCT FROM row(OLD.*)
       AND row(NEW."supersededBy") IS NOT DISTINCT FROM row(OLD."supersededBy") THEN
        RAISE EXCEPTION 'a loop configuration is superseded, never rewritten (FR-GEL-006)';
    END IF;
    IF NEW."id" <> OLD."id"
       OR NEW."workflowType" <> OLD."workflowType"
       OR NEW."configVersion" <> OLD."configVersion"
       OR NEW."stages"::text <> OLD."stages"::text
       OR NEW."authorities"::text <> OLD."authorities"::text
       OR NEW."requiredGates"::text <> OLD."requiredGates"::text
       OR NEW."triggerRules"::text <> OLD."triggerRules"::text
       OR NEW."approvedBy" <> OLD."approvedBy"
       OR NEW."approvalRef" <> OLD."approvalRef" THEN
        RAISE EXCEPTION 'a loop configuration is superseded, never rewritten (FR-GEL-006)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "loop_instance_configurations_supersede_only"
    BEFORE UPDATE OR DELETE ON "loop_instance_configurations"
    FOR EACH ROW EXECUTE FUNCTION reject_loop_config_rewrite();
