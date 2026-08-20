-- T109 + T120 (EPIC-009) — the two records the lifecycle produces.
--
-- Design source: specs/_shared/schema.sql (lifecycle_transitions,
-- validation_findings). Column naming is camelCase per the T012a convention.
--
-- Both tables reference `specifications`, so neither could land before
-- EPIC-008's T077 created it. That dependency is why the lifecycle wave staged
-- itself as "everything EPIC-008 does not gate".

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateTable
CREATE TABLE "lifecycle_transitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "fromState" "SpecLifecycleState" NOT NULL,
    "toState" "SpecLifecycleState" NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_findings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "specificationVersionId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_findings_pkey" PRIMARY KEY ("id")
);

-- FR-011 / SRS M08 §8: ONLY these eight transitions exist. `approved -> draft`
-- is deliberately absent (US5 scenario 4), and `baselined` is immutable
-- (FR-011a) — editing it forks a new version in `draft` rather than moving the
-- baseline. This is the database half of the rule `lifecycle.machine.ts`
-- enforces in code; T106 pins the two together.
ALTER TABLE "lifecycle_transitions"
    ADD CONSTRAINT "lifecycle_permitted_transition" CHECK (
        ("fromState" = 'draft'       AND "toState" = 'review')      OR
        ("fromState" = 'review'      AND "toState" = 'draft')       OR
        ("fromState" = 'review'      AND "toState" = 'approved')    OR
        ("fromState" = 'approved'    AND "toState" = 'baselined')   OR
        ("fromState" = 'baselined'   AND "toState" = 'implemented') OR
        ("fromState" = 'approved'    AND "toState" = 'archived')    OR
        ("fromState" = 'baselined'   AND "toState" = 'archived')    OR
        ("fromState" = 'implemented' AND "toState" = 'archived')
    );

-- FR-023: a finding that cannot say WHERE the problem is cannot be acted on,
-- and is malformed engine output rather than a finding.
ALTER TABLE "validation_findings"
    ADD CONSTRAINT "validation_findings_location_present" CHECK (char_length(trim("location")) > 0);

ALTER TABLE "validation_findings"
    ADD CONSTRAINT "validation_findings_message_present" CHECK (char_length(trim("message")) > 0);

-- CreateIndex
CREATE INDEX "lifecycle_transitions_workspaceId_idx" ON "lifecycle_transitions"("workspaceId");
CREATE INDEX "lifecycle_transitions_specificationId_occurredAt_idx" ON "lifecycle_transitions"("specificationId", "occurredAt" DESC);
CREATE INDEX "validation_findings_workspaceId_idx" ON "validation_findings"("workspaceId");
CREATE INDEX "validation_findings_specificationVersionId_idx" ON "validation_findings"("specificationVersionId");

-- AddForeignKey
ALTER TABLE "lifecycle_transitions" ADD CONSTRAINT "lifecycle_transitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lifecycle_transitions" ADD CONSTRAINT "lifecycle_transitions_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_specificationVersionId_fkey" FOREIGN KEY ("specificationVersionId") REFERENCES "specification_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-014: lifecycle history is HISTORY. Append-only, attached to EPIC-004's
-- shared `reject_mutation()` — the same function `requirement_versions` and
-- `specification_versions` use. A transition that could be edited afterwards
-- would make "who approved this, and when" unanswerable.
CREATE TRIGGER "lifecycle_transitions_immutable"
    BEFORE UPDATE OR DELETE ON "lifecycle_transitions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
