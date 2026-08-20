-- T460 (EPIC-009) — FR-013 / SC-007 at the database, not only in code.
--
-- `SpecificationVersionService` exposes no update and no delete, so the code
-- cannot mutate a version. That is a guarantee about ONE caller. SC-007 says
-- any prior version is retrievable *unchanged*, and only the table can promise
-- that — a migration script, an admin console, or a repository method added
-- later all bypass the service.
--
-- Same two-layer pattern as EPIC-004's analysis finding C1, and the same shape
-- as T458 for `requirement_versions`.
--
-- `reject_mutation()` is EPIC-004's shared function, created by T454 in the
-- init migration. Deliberately NOT redefined here: one function, one rule,
-- every append-only table attaches to it. Two copies can drift, and the one
-- nobody reads is the one that stops working. Asserted by T459.
--
-- Gated on EPIC-008: the table this protects is T077's, which is why the
-- lifecycle wave's stage 1 could not carry it.

CREATE TRIGGER "specification_versions_immutable"
    BEFORE UPDATE OR DELETE ON "specification_versions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
