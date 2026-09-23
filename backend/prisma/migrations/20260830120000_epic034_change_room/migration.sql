-- EPIC-034 T406s — the Change Room's six tables.
--
-- Additive: nothing existing is altered. Three constraints carry rules the
-- services also enforce, and each is a belt beside a brace rather than a
-- duplicate — the fence holds even when a caller bypasses the service.
--
--   targetBaselineVersion NOT NULL  a change with no baseline is not a change
--   decidedByKind = 'human'         baseline change is permanently high band
--   unknownReason NOT NULL          "unknown" must say why it could not tell
--
-- The third is the one worth reading twice. FR-CHR-032 lets an unreachable
-- impact source degrade to `unknown`, and the whole value of that state is that
-- it is distinguishable from `not-impacted`. An `unknown` row with no reason is
-- indistinguishable from a row nobody filled in, so the column is required
-- exactly when the state is `unknown`.

CREATE TABLE "change_requests" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "projectId"             TEXT NOT NULL,
    -- → the EPIC-030 loop object. This Room is a distinct workflow type.
    "roomObjectId"          TEXT NOT NULL,
    "targetBaselineId"      TEXT NOT NULL,
    -- FR-CHR-010: a change is always AGAINST a baseline.
    "targetBaselineVersion" INTEGER NOT NULL,
    "requestedOutcome"      TEXT NOT NULL,
    "reason"                TEXT NOT NULL,
    "requester"             TEXT NOT NULL,
    -- FR-CHR-021: a recorded attribute, never a gate bypass. Nothing reads this
    -- to skip a check; it is here so a reviewer can see what was claimed.
    "urgency"               TEXT NOT NULL DEFAULT 'normal',
    "openQuestions"         JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- FR-CHR-012: where it came from, with the defect ref when transferred.
    "origin"                TEXT NOT NULL DEFAULT 'direct',
    "originDefectRef"       TEXT,
    "state"                 TEXT NOT NULL DEFAULT 'open',
    -- FR-CHR-013: the prior target version, when explicitly rebased.
    "rebasedFrom"           INTEGER,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "change_requests_origin_is_known"
        CHECK ("origin" IN ('direct', 'defect-transfer')),
    CONSTRAINT "change_requests_state_is_known"
        CHECK ("state" IN ('open', 'withdrawn', 'decided', 'applied', 'closed')),
    -- A transfer that forgot where it came from loses its provenance silently.
    CONSTRAINT "change_requests_transfers_name_their_defect"
        CHECK ("origin" <> 'defect-transfer' OR "originDefectRef" IS NOT NULL)
);

CREATE TABLE "change_impact_views" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "changeRequestId"     TEXT NOT NULL,
    "computedAt"          TIMESTAMP(3) NOT NULL,
    -- DEFAULT_IMPACT_DEPTH, adopted from EPIC-020 and never chosen here.
    "traversalDepth"      INTEGER NOT NULL,
    -- FR-CHR-035: true once a decision referenced it.
    "retainedForDecision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_impact_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "change_impact_areas" (
    "id"            TEXT NOT NULL,
    "workspaceId"   TEXT NOT NULL,
    "impactViewId"  TEXT NOT NULL,
    -- One of the eight BR-0044 classes.
    "area"          TEXT NOT NULL,
    "state"         TEXT NOT NULL,
    "detail"        TEXT NOT NULL,
    -- NULL when nobody counted. Zero is a count; NULL is the absence of one.
    "itemCount"     INTEGER,
    -- Required exactly when the state is `unknown` — see the header.
    "unknownReason" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_impact_areas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "change_impact_areas_area_is_known"
        CHECK ("area" IN ('requirements','specifications','architecture','tasks',
                          'code','tests','release','security')),
    CONSTRAINT "change_impact_areas_state_is_known"
        CHECK ("state" IN ('impacted', 'not-impacted', 'unknown')),
    CONSTRAINT "change_impact_areas_unknown_states_say_why"
        CHECK ("state" <> 'unknown' OR "unknownReason" IS NOT NULL)
);

CREATE TABLE "change_decisions" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "decidedBy"       TEXT NOT NULL,
    -- The belt beside EPIC-031's braces. Baseline change is permanently high
    -- band (FR-DPE-012), so the fence holds even if a caller bypasses policy.
    "decidedByKind"   TEXT NOT NULL,
    "authorityBasis"  TEXT NOT NULL,
    "objectVersion"   INTEGER NOT NULL,
    "decidedAt"       TIMESTAMP(3) NOT NULL,
    -- → EPIC-031's Decision, which evaluated the band. Not redefined here.
    "decisionId"      TEXT NOT NULL,
    "chosenOption"    TEXT NOT NULL,
    -- FR-CHR-043: what was NOT chosen travels with the decision.
    "declinedOptions" JSONB NOT NULL,
    "rationale"       TEXT NOT NULL,
    -- FR-CHR-035: the snapshot the decision was made against.
    "impactViewId"    TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_decisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "change_decisions_decided_by_a_human"
        CHECK ("decidedByKind" = 'human'),
    CONSTRAINT "change_decisions_state_their_rationale"
        CHECK (length(trim("rationale")) > 0)
);

CREATE TABLE "change_baseline_deltas" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "changeDecisionId"    TEXT NOT NULL,
    "fromBaselineVersion" INTEGER NOT NULL,
    "toBaselineVersion"   INTEGER NOT NULL,
    -- R-034-4: member requirement VERSION ids, never requirement text.
    "added"               JSONB NOT NULL DEFAULT '[]'::jsonb,
    "removed"             JSONB NOT NULL DEFAULT '[]'::jsonb,
    "versionChanged"      JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_baseline_deltas_pkey" PRIMARY KEY ("id"),
    -- A delta that goes nowhere is not a delta.
    CONSTRAINT "change_baseline_deltas_move_forward"
        CHECK ("toBaselineVersion" > "fromBaselineVersion")
);

CREATE TABLE "change_replan_obligations" (
    "id"                      TEXT NOT NULL,
    "workspaceId"             TEXT NOT NULL,
    "changeDecisionId"        TEXT NOT NULL,
    "affectedSpecificationId" TEXT NOT NULL,
    "whatMustChange"          TEXT NOT NULL,
    "why"                     TEXT NOT NULL,
    "state"                   TEXT NOT NULL DEFAULT 'recorded',
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_replan_obligations_pkey" PRIMARY KEY ("id"),
    -- R-034-2: recorded, never executed. There is no `executed` state, because
    -- this Epic has no verb that would produce one — U-12 discharges it.
    CONSTRAINT "change_replan_obligations_are_recorded_not_run"
        CHECK ("state" IN ('recorded', 'discharged-by-U-12'))
);

CREATE TABLE "change_closures" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    -- BR-0048: what changed, why, and what proves it.
    "whatChanged"     TEXT NOT NULL,
    "why"             TEXT NOT NULL,
    "evidenceRefs"    JSONB NOT NULL DEFAULT '[]'::jsonb,
    "closedBy"        TEXT NOT NULL,
    "closedAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_closures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "change_closures_say_what_changed"
        CHECK (length(trim("whatChanged")) > 0 AND length(trim("why")) > 0)
);

-- FR-002: every tenant-scoped table names its workspace and is indexed by it.
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_impact_views" ADD CONSTRAINT "change_impact_views_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_impact_areas" ADD CONSTRAINT "change_impact_areas_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_decisions" ADD CONSTRAINT "change_decisions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_baseline_deltas" ADD CONSTRAINT "change_baseline_deltas_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_replan_obligations" ADD CONSTRAINT "change_replan_obligations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_closures" ADD CONSTRAINT "change_closures_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "change_impact_views" ADD CONSTRAINT "change_impact_views_changeRequestId_fkey"
    FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_impact_areas" ADD CONSTRAINT "change_impact_areas_impactViewId_fkey"
    FOREIGN KEY ("impactViewId") REFERENCES "change_impact_views"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_decisions" ADD CONSTRAINT "change_decisions_changeRequestId_fkey"
    FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_decisions" ADD CONSTRAINT "change_decisions_impactViewId_fkey"
    FOREIGN KEY ("impactViewId") REFERENCES "change_impact_views"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_baseline_deltas" ADD CONSTRAINT "change_baseline_deltas_changeDecisionId_fkey"
    FOREIGN KEY ("changeDecisionId") REFERENCES "change_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_replan_obligations" ADD CONSTRAINT "change_replan_obligations_changeDecisionId_fkey"
    FOREIGN KEY ("changeDecisionId") REFERENCES "change_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_closures" ADD CONSTRAINT "change_closures_changeRequestId_fkey"
    FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "change_requests_workspaceId_idx" ON "change_requests"("workspaceId");
CREATE INDEX "change_requests_roomObjectId_idx" ON "change_requests"("roomObjectId");
CREATE INDEX "change_impact_views_workspaceId_idx" ON "change_impact_views"("workspaceId");
CREATE INDEX "change_impact_views_changeRequestId_idx" ON "change_impact_views"("changeRequestId");
CREATE INDEX "change_impact_areas_workspaceId_idx" ON "change_impact_areas"("workspaceId");
CREATE INDEX "change_impact_areas_impactViewId_idx" ON "change_impact_areas"("impactViewId");
CREATE INDEX "change_decisions_workspaceId_idx" ON "change_decisions"("workspaceId");
CREATE INDEX "change_decisions_changeRequestId_idx" ON "change_decisions"("changeRequestId");
CREATE INDEX "change_baseline_deltas_workspaceId_idx" ON "change_baseline_deltas"("workspaceId");
CREATE INDEX "change_replan_obligations_workspaceId_idx" ON "change_replan_obligations"("workspaceId");
CREATE INDEX "change_closures_workspaceId_idx" ON "change_closures"("workspaceId");
