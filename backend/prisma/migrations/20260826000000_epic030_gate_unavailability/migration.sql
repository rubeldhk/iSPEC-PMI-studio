-- T1103 (EPIC-030 Phase C2B) — gate unavailability is not a refusal.
--
-- C2A closure recorded `gate_outcomes_unavailable` as a REFUSAL reason at stage
-- `validation`, which EPIC-037 would have mapped to `validation-failed`. That
-- says a gate examined the proposal and turned it down. Nothing examined it.
--
-- `FR-ENH-016` -- "an unavailable or malformed role fails the gate" -- is a
-- different case and stays `gate_failed`: there the gate RAN, a role could not
-- answer, and failing is the authoritative outcome. No approved EPIC-021 policy
-- defines an outcome being unobtainable as a final refusal, so unavailability,
-- staleness and incompleteness route to reconciliation instead.

-- The vocabularies are stated as CHECK constraints, so correcting the semantics
-- means replacing them rather than editing a list in code.
ALTER TABLE "adjudication_records"
    DROP CONSTRAINT "adjudication_records_refusal_reason_vocabulary",
    DROP CONSTRAINT "adjudication_records_reconciliation_cause_vocabulary";

ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_refusal_reason_vocabulary" CHECK (
        "refusalReasonCode" IS NULL OR "refusalReasonCode" IN (
            'invalid_lifecycle_transition', 'gate_failed',
            'unauthorized_actor', 'self_approval_prohibited', 'distinct_approver_required',
            'approval_authority_missing', 'lifecycle_application_refused'
        )
    ),
    ADD CONSTRAINT "adjudication_records_reconciliation_cause_vocabulary" CHECK (
        "reconciliationCause" IS NULL OR "reconciliationCause" IN (
            'application_outcome_unknown', 'application_state_unconfirmed',
            'application_transition_unidentified',
            'gate_outcomes_unavailable', 'gate_outcomes_stale', 'gate_evaluation_incomplete'
        )
    );
