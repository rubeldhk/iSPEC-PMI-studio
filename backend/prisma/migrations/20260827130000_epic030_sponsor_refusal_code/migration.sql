-- T1143 (EPIC-030, C3B) — one more refusal reason, at the approval stage.
--
-- `sponsor_cannot_approve_sponsored_proposal`. A sponsoring human answers for
-- what their agent does, so they stand on the PROPOSER's side of a
-- separation-of-duties check. Without this, "an agent may not approve its own
-- proposal" is satisfied by the agent handing the approval to the one person
-- accountable for it -- which is the rule defeated by following it.
--
-- Additive: widening a CHECK vocabulary. No existing row can violate it.
ALTER TABLE "adjudication_records"
    DROP CONSTRAINT "adjudication_records_refusal_reason_vocabulary";

ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_refusal_reason_vocabulary" CHECK (
        "refusalReasonCode" IS NULL OR "refusalReasonCode" IN (
            'invalid_lifecycle_transition', 'gate_failed', 'gate_outcomes_unavailable',
            'unauthorized_actor', 'self_approval_prohibited', 'distinct_approver_required',
            'sponsor_cannot_approve_sponsored_proposal',
            'approval_authority_missing', 'lifecycle_application_refused'
        )
    );
