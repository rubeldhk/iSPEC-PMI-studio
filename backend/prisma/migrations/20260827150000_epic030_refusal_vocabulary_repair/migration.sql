-- T1146 (EPIC-030, C3B) — repair: `gate_outcomes_unavailable` is NOT a refusal.
--
-- C2B established that an unreadable gate outcome routes to reconciliation
-- rather than refusal, because a refusal citing unavailability claims a gate
-- examined the proposal and turned it down -- a decision nobody made. The code
-- was removed from the refusal vocabulary in the contract and the database.
--
-- C3B's `20260827130000` migration then DROPPED and recreated this constraint
-- to widen it by one code, and rebuilt the list from an outdated copy --
-- silently reinstating the removed one. The database became more permissive
-- than the contract, which is the direction that matters: the type would have
-- refused it and the database would not.
--
-- Rebuilt here from `REFUSAL_REASON_CODES` as it actually stands: eight codes,
-- no gate causes. `adjudication-persistence.spec.ts` now asserts the two
-- vocabularies agree, so a drop-and-recreate cannot drift them again.
ALTER TABLE "adjudication_records"
    DROP CONSTRAINT "adjudication_records_refusal_reason_vocabulary";

ALTER TABLE "adjudication_records"
    ADD CONSTRAINT "adjudication_records_refusal_reason_vocabulary" CHECK (
        "refusalReasonCode" IS NULL OR "refusalReasonCode" IN (
            'invalid_lifecycle_transition',
            'gate_failed',
            'unauthorized_actor',
            'self_approval_prohibited',
            'distinct_approver_required',
            'sponsor_cannot_approve_sponsored_proposal',
            'approval_authority_missing',
            'lifecycle_application_refused'
        )
    );
