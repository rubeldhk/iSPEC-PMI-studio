-- EPIC-047 T2575, R-047-17 — a refused contract version may be submitted again.
--
-- R-047-14's trigger let a version's decision id be written once, from null.
-- EPIC-031 has no human "reject": every refused outcome is policy's (a gate, a
-- band needing gates), so a refused version may be resubmitted and its decision
-- id replaced. The trigger still binds the rule an application refactor could
-- drop: the id may be replaced only while the decision it names stands refused
-- — the last record along its resolution chain in policy_decisions is a
-- refusal — or is EPIC-031's 'unrecorded' (a refusal that could not be stored).
-- A pending or approved version's decision id still cannot change, and nothing
-- else about a version ever may.

CREATE OR REPLACE FUNCTION "expert_contract_versions_immutable"() RETURNS trigger AS $$
DECLARE
    standing TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'expert contract versions are immutable: version % cannot be deleted (R-047-14)', OLD."version";
    END IF;
    IF NEW."decisionId" IS NULL
       OR NEW."id" <> OLD."id" OR NEW."workspaceId" <> OLD."workspaceId"
       OR NEW."expertId" <> OLD."expertId" OR NEW."version" <> OLD."version"
       OR NEW."contract" <> OLD."contract" OR NEW."createdBy" <> OLD."createdBy"
       OR NEW."createdAt" <> OLD."createdAt" THEN
        RAISE EXCEPTION 'expert contract versions are immutable: only the decisionId may be written (R-047-14)';
    END IF;
    IF OLD."decisionId" IS NULL OR OLD."decisionId" = 'unrecorded' THEN
        RETURN NEW;
    END IF;
    WITH RECURSIVE chain AS (
        SELECT d."id", d."outcome" FROM "policy_decisions" d WHERE d."id" = OLD."decisionId"
        UNION ALL
        SELECT r."id", r."outcome" FROM "policy_decisions" r JOIN chain c ON r."resolvesDecisionId" = c."id"
    )
    SELECT c."outcome" INTO standing FROM chain c
    WHERE NOT EXISTS (SELECT 1 FROM "policy_decisions" r WHERE r."resolvesDecisionId" = c."id")
    LIMIT 1;
    IF standing = 'refused' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'expert contract versions are immutable: a decisionId is replaced only in place of a refused decision (R-047-14, T2575)';
END;
$$ LANGUAGE plpgsql;
