-- EPIC-048 T2690 — a status event names a decision EPIC-031 recorded, in its
-- own workspace (FR-LRN-033, SC-LRN-001).
--
-- 20261010090200 fenced knowledge_entry_versions on policy_decisions. A status
-- event — `superseded`, `deprecated` — is the other half of what a decision
-- changes, and its "decisionId" was free text: a deprecation could name a
-- decision nobody took, or another workspace's. Now:
--
-- 1. "decisionId" is a foreign key to policy_decisions (ON DELETE RESTRICT;
--    both tables are append-only). NULL stays allowed: the CHECK
--    knowledge_version_status_events_deprecated already demands a decision for
--    a deprecation, and a `current` or `superseded` event written with its
--    version carries the version's own decision.
-- 2. knowledge_status_events_require_decision, BEFORE INSERT: the named
--    decision belongs to the event's workspace.
--
-- `reject_mutation()` is SHARED (20260814000000_init): not touched here.

ALTER TABLE "knowledge_version_status_events" ADD CONSTRAINT "knowledge_version_status_events_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "policy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "knowledge_version_status_events" VALIDATE CONSTRAINT "knowledge_version_status_events_decisionId_fkey";

CREATE FUNCTION knowledge_status_events_require_decision() RETURNS TRIGGER AS $$
DECLARE
    owner TEXT;
BEGIN
    IF NEW."decisionId" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT "workspaceId" INTO owner FROM "policy_decisions" WHERE "id" = NEW."decisionId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'knowledge_status_events_require_decision: decision % is not recorded', NEW."decisionId";
    END IF;
    IF owner <> NEW."workspaceId" THEN
        RAISE EXCEPTION 'knowledge_status_events_require_decision: decision % belongs to another workspace', NEW."decisionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "knowledge_status_events_require_decision" BEFORE INSERT ON "knowledge_version_status_events"
    FOR EACH ROW EXECUTE FUNCTION knowledge_status_events_require_decision();
