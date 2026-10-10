-- EPIC-031 T2507 — FR-DPE-017 (amendment A-031-1, for EPIC-048).
--
-- A pending decision may be closed without approval — rejected, withdrawn or
-- expired. The closure is a resolving row like an approval (append-only, no
-- UPDATE), and its kind and reason live in that row's explanation.
--
-- The two columns are both absent (not a closure) or both present with a known
-- kind and a non-empty reason. Every operand is NULL-checked so that NULL cannot
-- satisfy the CHECK: a CHECK that evaluates to NULL is ACCEPTED by PostgreSQL.

ALTER TABLE "decision_explanations" ADD COLUMN "closureKind" TEXT;
ALTER TABLE "decision_explanations" ADD COLUMN "closureReason" TEXT;

ALTER TABLE "decision_explanations" ADD CONSTRAINT "decision_explanations_closure_states_kind_and_reason"
    CHECK (
        ("closureKind" IS NULL AND "closureReason" IS NULL)
        OR (
            "closureKind" IS NOT NULL
            AND "closureKind" IN ('rejected', 'withdrawn', 'expired')
            AND "closureReason" IS NOT NULL
            AND length(trim("closureReason")) > 0
        )
    );
