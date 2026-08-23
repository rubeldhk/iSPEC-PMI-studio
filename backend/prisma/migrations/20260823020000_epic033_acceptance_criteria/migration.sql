-- EPIC-033 T339b — the acceptance-criteria precondition. FR-RQR-030, FR-RQR-031,
-- SC-RQR-003, BR-0024.
--
-- Two columns on `requirement_candidates`, because the gate has to read data
-- this Room owns. An approval that carried its own answer to "does this
-- requirement have criteria" would let a caller assert its way past
-- SC-RQR-003's "zero requirements reach baseline without measurable acceptance
-- criteria or a recorded exception" -- and zero is the whole requirement.
--
-- `intendedForImplementation` DEFAULTS TRUE. A candidate is presumed to need
-- criteria until somebody says otherwise. Defaulting false would fire the gate
-- only for candidates a caller had already flagged, which is a default that
-- permits: indistinguishable, at the point of approval, from a requirement that
-- genuinely needed nothing.
ALTER TABLE "requirement_candidates"
    ADD COLUMN "acceptanceCriteria" JSONB,
    ADD COLUMN "intendedForImplementation" BOOLEAN NOT NULL DEFAULT true;

-- FR-RQR-033 -- exceptions must be enumerable for a baseline WITHOUT opening
-- each requirement. `baseline_exceptions_baselineId_idx` already makes that one
-- lookup; this is the index that keeps it one lookup as baselines accumulate.
CREATE INDEX IF NOT EXISTS "baseline_exceptions_baselineId_condition_idx"
    ON "baseline_exceptions"("baselineId", "condition");
