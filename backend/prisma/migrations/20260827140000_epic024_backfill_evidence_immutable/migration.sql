-- T1144 (EPIC-024, C3B) — Y1: the backfill record is authoritative evidence.
--
-- The finding was raised LOW and the review says otherwise, so it is being
-- promoted rather than left alone because of where it started.
--
-- `ownership_backfill_records` names every artifact the C2E backfill could NOT
-- give an owner. Those artifacts remain inaccessible until a human decides who
-- owns them, and this table is the only list of them. A mutable list of
-- outstanding security remediations can be quietly shortened.
--
-- It is NOT a rebuildable projection. "Which specifications have no grants"
-- can be re-derived today; "which ones the migration could not resolve, and
-- why" cannot -- grants added since would erase the distinction, and the
-- `reason` was never derivable from the artifact at all.
--
-- Corrections therefore append. Deciding an owner later adds a grant and,
-- if the record needs superseding, a new row -- it does not edit this one.
CREATE TRIGGER "ownership_backfill_records_immutable"
    BEFORE UPDATE OR DELETE ON "ownership_backfill_records"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
