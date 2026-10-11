-- EPIC-048 T2393 — the decision fences (plan items 2.3 and 2.8).
--
-- Written after EPIC-031 (policy_decisions) and EPIC-038
-- (context_reusable_authorisations) reached main. A version of approved
-- knowledge can exist only where EPIC-031 recorded the decision that approved
-- it (SC-LRN-001, R-048-4 fence 3), whatever the code above it does.
--
-- 1. FKs: knowledge_entry_versions.decisionId / .resolvingDecisionId →
--    policy_decisions.id (ON DELETE RESTRICT; both tables are append-only).
-- 2. knowledge_versions_require_decision, BEFORE INSERT:
--    - the requested decision is in the same workspace and decides this
--      candidate (targetType 'learning-candidate', targetId = candidateId);
--    - a resolving row, when named, is in the same workspace and resolves that
--      decision;
--    - COALESCE(resolving, requested) has outcome approved or auto-executed;
--    - approvedByKind 'human' needs an 'approved' row by a 'human' actor
--      (FR-LRN-027): an automation approval or an on-the-spot auto-execution is
--      a policy approval, never a person's.
--    The source-exclusion half is knowledge_versions_approver_not_source,
--    already in 20261010090100_epic048_governed_learning.
-- 3. no_cross_workspace_knowledge on EPIC-038's reusable authorisations
--    (FR-LRN-043), removed only by the Epic that discharges DEFER-048-01.
--    NOT VALID then VALIDATE: no row can match today.
--
-- `reject_mutation()` is SHARED (20260814000000_init): not touched here.

ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "policy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_resolvingDecisionId_fkey"
    FOREIGN KEY ("resolvingDecisionId") REFERENCES "policy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION knowledge_versions_require_decision() RETURNS TRIGGER AS $$
DECLARE
    requested  RECORD;
    resolving  RECORD;
    deciding   RECORD;
BEGIN
    SELECT "workspaceId", "targetType", "targetId", "outcome", "actorKind"
      INTO requested FROM "policy_decisions" WHERE "id" = NEW."decisionId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'knowledge_versions_require_decision: decision % is not recorded', NEW."decisionId";
    END IF;
    IF requested."workspaceId" <> NEW."workspaceId" THEN
        RAISE EXCEPTION 'knowledge_versions_require_decision: decision % belongs to another workspace', NEW."decisionId";
    END IF;
    IF requested."targetType" <> 'learning-candidate' OR requested."targetId" <> NEW."candidateId" THEN
        RAISE EXCEPTION 'knowledge_versions_require_decision: decision % does not decide candidate %', NEW."decisionId", NEW."candidateId";
    END IF;

    IF NEW."resolvingDecisionId" IS NOT NULL THEN
        SELECT "workspaceId", "outcome", "actorKind", "resolvesDecisionId"
          INTO resolving FROM "policy_decisions" WHERE "id" = NEW."resolvingDecisionId";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'knowledge_versions_require_decision: resolving decision % is not recorded', NEW."resolvingDecisionId";
        END IF;
        IF resolving."workspaceId" <> NEW."workspaceId"
           OR resolving."resolvesDecisionId" IS DISTINCT FROM NEW."decisionId" THEN
            RAISE EXCEPTION 'knowledge_versions_require_decision: decision % does not resolve decision %',
                NEW."resolvingDecisionId", NEW."decisionId";
        END IF;
        deciding := resolving;
    ELSE
        deciding := requested;
    END IF;

    IF deciding."outcome" NOT IN ('approved', 'auto-executed') THEN
        RAISE EXCEPTION 'knowledge_versions_require_decision: the deciding row is %, not approved (SC-LRN-001)', deciding."outcome";
    END IF;
    IF NEW."approvedByKind" = 'human'
       AND (deciding."outcome" <> 'approved' OR deciding."actorKind" <> 'human') THEN
        RAISE EXCEPTION 'knowledge_versions_require_decision: a human version needs a human approval; the deciding row is % by %',
            deciding."outcome", deciding."actorKind";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "knowledge_versions_require_decision" BEFORE INSERT ON "knowledge_entry_versions"
    FOR EACH ROW EXECUTE FUNCTION knowledge_versions_require_decision();

ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "no_cross_workspace_knowledge" CHECK ("sourceType" <> 'knowledge-entry') NOT VALID;
ALTER TABLE "context_reusable_authorisations" VALIDATE CONSTRAINT "no_cross_workspace_knowledge";
