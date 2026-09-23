-- T1096, T1097 (EPIC-030 C2A closure) — X1 in the database, and the durable
-- intent store the application adapter has always needed.
--
-- The verdict type is a closed discriminated union in which invalid
-- combinations cannot be CONSTRUCTED. These CHECK constraints make them
-- equally unwritable. Both layers, deliberately: the type stops this codebase,
-- the constraint stops everything else -- a migration, a console, a future
-- service that forgets.

-- ---------------------------------------------------------------------------
-- 1. Verdict-specific columns (X1).
-- ---------------------------------------------------------------------------
ALTER TABLE "adjudication_records"
    ADD COLUMN "refusalStage"         TEXT,
    ADD COLUMN "refusalReasonCode"    TEXT,
    ADD COLUMN "requiredApproverRole" TEXT,
    ADD COLUMN "observedStatus"       TEXT,
    ADD COLUMN "reconciliationCause"  TEXT,
    ADD COLUMN "reconciliationDetail" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Closed vocabularies. A value outside the set is a typo that would
--    otherwise reach EPIC-037 as an unmappable event.
-- ---------------------------------------------------------------------------
ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_verdict_vocabulary" CHECK (
        "verdict" IN ('validated', 'applied', 'approval_required',
                      'refused', 'inconsistent', 'reconciliation_required')
    ),
    ADD CONSTRAINT "adjudication_records_refusal_stage_vocabulary" CHECK (
        "refusalStage" IS NULL OR "refusalStage" IN ('validation', 'approval', 'transition')
    ),
    ADD CONSTRAINT "adjudication_records_refusal_reason_vocabulary" CHECK (
        "refusalReasonCode" IS NULL OR "refusalReasonCode" IN (
            'invalid_lifecycle_transition', 'gate_failed', 'gate_outcomes_unavailable',
            'unauthorized_actor', 'self_approval_prohibited', 'distinct_approver_required',
            'approval_authority_missing', 'lifecycle_application_refused'
        )
    ),
    ADD CONSTRAINT "adjudication_records_reconciliation_cause_vocabulary" CHECK (
        "reconciliationCause" IS NULL OR "reconciliationCause" IN (
            'application_outcome_unknown', 'application_state_unconfirmed',
            'application_transition_unidentified'
        )
    );

-- ---------------------------------------------------------------------------
-- 3. Per-verdict requirements, stated as equivalences so each column is
--    required by exactly one verdict and forbidden on the other five.
--
--    `applied` is the load-bearing one: a transition id on any other verdict
--    is the precise combination the union was introduced to eliminate.
-- ---------------------------------------------------------------------------
ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_applied_has_transition" CHECK (
        ("verdict" = 'applied') = ("appliedTransitionId" IS NOT NULL)
    ),
    ADD CONSTRAINT "adjudication_records_refused_has_stage_and_code" CHECK (
        ("verdict" = 'refused') = ("refusalStage" IS NOT NULL)
        AND ("verdict" = 'refused') = ("refusalReasonCode" IS NOT NULL)
    ),
    ADD CONSTRAINT "adjudication_records_approval_required_has_role" CHECK (
        ("verdict" = 'approval_required') = ("requiredApproverRole" IS NOT NULL)
    ),
    ADD CONSTRAINT "adjudication_records_inconsistent_has_observed" CHECK (
        ("verdict" = 'inconsistent') = ("observedStatus" IS NOT NULL)
    ),
    ADD CONSTRAINT "adjudication_records_reconciliation_has_cause" CHECK (
        ("verdict" = 'reconciliation_required') = ("reconciliationCause" IS NOT NULL)
    );

-- ---------------------------------------------------------------------------
-- 4. The durable intent store (T1097).
--
--    Append-only, like everything else here. `settle` therefore APPENDS a
--    second row rather than updating the first -- an outcome nobody observed
--    must not be able to erase the record that the attempt was made. An intent
--    with an 'opened' row and no 'settled' partner is exactly what a
--    reconciliation pass looks for.
-- ---------------------------------------------------------------------------
CREATE TABLE "application_intents" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "intentId"        TEXT NOT NULL,
    "phase"           TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "expectedStatus"  TEXT NOT NULL,
    "requestedStatus" TEXT NOT NULL,
    "actorId"         TEXT NOT NULL,
    "outcome"         TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_intents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "application_intents_phase_vocabulary" CHECK (
        "phase" IN ('opened', 'settled')
    ),
    CONSTRAINT "application_intents_outcome_vocabulary" CHECK (
        "outcome" IS NULL OR "outcome" IN ('confirmed', 'refused', 'unknown')
    ),
    CONSTRAINT "application_intents_settled_has_outcome" CHECK (
        ("phase" = 'settled') = ("outcome" IS NOT NULL)
    )
);

CREATE INDEX "application_intents_workspace_intent_idx"
    ON "application_intents"("workspaceId", "intentId");

CREATE INDEX "application_intents_workspace_specification_idx"
    ON "application_intents"("workspaceId", "specificationId");

ALTER TABLE "application_intents"
    ADD CONSTRAINT "application_intents_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The function alone protects nothing. This trigger is what makes the table
-- append-only.
CREATE TRIGGER "application_intents_immutable"
    BEFORE UPDATE OR DELETE ON "application_intents"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
