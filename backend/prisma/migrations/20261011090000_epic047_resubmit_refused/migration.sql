-- EPIC-047 T2575, R-047-17 — a refused or withdrawn contract version may be submitted again.
--
-- R-047-14's trigger let a version's decision id be written once, from null.
-- A version refused by policy (a gate, a band needing gates) or withdrawn by its
-- submitter may be resubmitted and its decision id replaced. The trigger still
-- binds the rule an application refactor could
-- drop: the id may be replaced only while the decision it names stands refused
-- by policy or withdrawn — the last record along its resolution chain in
-- policy_decisions is a refusal that is not a human's rejection (FR-DPE-017,
-- closureKind 'rejected') — or is EPIC-031's 'unrecorded' (a refusal that could
-- not be stored). A rejected, pending or approved version's decision id cannot
-- change, and nothing else about a version ever may.

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
    SELECT CASE WHEN e."closureKind" = 'rejected' THEN 'rejected' ELSE c."outcome" END INTO standing
    FROM chain c
    JOIN "policy_decisions" d ON d."id" = c."id"
    JOIN "decision_explanations" e ON e."id" = d."explanationId"
    WHERE NOT EXISTS (SELECT 1 FROM "policy_decisions" r WHERE r."resolvesDecisionId" = c."id")
    LIMIT 1;
    IF standing = 'refused' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'expert contract versions are immutable: a decisionId is replaced only in place of a refused decision (R-047-14, T2575)';
END;
$$ LANGUAGE plpgsql;
