-- T109 + T120 + T460 (EPIC-009) and the EPIC-016 join table (T143 completion).
--
-- Design source: specs/_shared/schema.sql. Sequenced deliberately AFTER
-- EPIC-008's 20260820000300_epic008_specifications, whose own header left the
-- `specification_versions_immutable` trigger to this epic.

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateTable — FR-014: who transitioned, and when.
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

-- FR-011 / M08 §8: only the eight permitted transitions exist — the database
-- half of the rule `assertTransition` enforces in code (T099/T106).
-- approved → draft is NOT permitted; a baselined edit is a FORK, not a row here.
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

-- CreateTable — FR-023: findings belong to the VERSION validated.
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

-- FR-023: a finding without a location is malformed engine output. T121
-- refuses it in code; this backs the refusal so no bypass can store one.
ALTER TABLE "validation_findings"
    ADD CONSTRAINT "validation_findings_location_nonempty" CHECK (char_length(trim("location")) > 0);

-- CreateTable — FR-034: decisions link to the specifications they affect.
CREATE TABLE "adr_specification_links" (
    "adrId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,

    CONSTRAINT "adr_specification_links_pkey" PRIMARY KEY ("adrId", "specificationId")
);

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
ALTER TABLE "adr_specification_links" ADD CONSTRAINT "adr_specification_links_adrId_fkey" FOREIGN KEY ("adrId") REFERENCES "architecture_decision_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adr_specification_links" ADD CONSTRAINT "adr_specification_links_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- T460 — FR-013 / SC-007 at the database, not only in code. Attached to (never
-- redefining) EPIC-004's shared reject_mutation(), exactly as T458 did for
-- requirement_versions. EPIC-008's migration left this to us by name.
CREATE TRIGGER "specification_versions_immutable"
    BEFORE UPDATE OR DELETE ON "specification_versions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- FR-014: lifecycle history that can be edited is not history.
CREATE TRIGGER "lifecycle_transitions_immutable"
    BEFORE UPDATE OR DELETE ON "lifecycle_transitions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
