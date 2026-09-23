-- T994p (EPIC-034) — BR-0048's fourth question needs somewhere to live.
--
-- `FR-CHR-070` requires a closure to identify four things: what changed, why,
-- which tests and evidence validate it, and **which baseline supersedes the old
-- state**. `20260830120000_epic034_change_room` gave `change_closures` columns
-- for the first three.
--
-- `FR-CHR-073` says all four are answerable from the record alone, without
-- reconstruction, and `SC-CHR-006` measures 100% of closed changes doing so. A
-- closure that had to join back to `change_baseline_deltas` or the baseline
-- table to answer the fourth would be reconstructing exactly what the
-- requirement rules out -- and until this column existed, `SC-CHR-006` was not
-- meetable by any closure this Room could store.
--
-- Not a defect record: nothing incorrect was ever written, because no closure
-- has been written at all. `T994p` is the first task that needs the column, and
-- this is that task.
--
-- Added NOT NULL without a default: `change_closures` is empty, and a default
-- would put a baseline reference nobody chose on closures nobody wrote.
ALTER TABLE "change_closures"
    ADD COLUMN "supersedingBaselineId"      TEXT NOT NULL,
    ADD COLUMN "supersedingBaselineVersion" INTEGER NOT NULL;

-- The fourth question must be answerable, so the answer cannot be blank.
ALTER TABLE "change_closures"
    ADD CONSTRAINT "change_closures_name_the_superseding_baseline" CHECK (
        length(trim("supersedingBaselineId")) > 0 AND "supersedingBaselineVersion" > 0
    );

-- FR-CHR-072, BR-0144: a declaration of completion does not substitute for the
-- validating evidence. A closure with an empty `evidenceRefs` array is exactly
-- that declaration, so the database refuses it too -- the service checks the
-- same thing, and this holds when a caller reaches past it.
ALTER TABLE "change_closures"
    ADD CONSTRAINT "change_closures_evidence_is_not_a_declaration" CHECK (
        jsonb_array_length("evidenceRefs") > 0
    );

-- One closure per change: two would give the record two answers to each of the
-- four questions and nothing to say which one holds.
CREATE UNIQUE INDEX "change_closures_one_per_change"
    ON "change_closures" ("workspaceId", "changeRequestId");
