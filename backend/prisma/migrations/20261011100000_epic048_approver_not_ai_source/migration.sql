-- EPIC-048 T2673 (convergence finding G3) — the database refuses an AI approver,
-- not a person's own approval.
--
-- FR-LRN-027: "An AI actor MUST NEVER approve a candidate — its own or
-- another's. Whether a person may approve a candidate they submitted MUST
-- follow the workspace's separation-of-duties policy." The trigger written in
-- 20261010090100 refused `approvedBy = sourcePrincipalId` for every candidate,
-- so where EPIC-031's tenant policy allows self-approval a person's approval was
-- recorded by EPIC-031 and then refused here, leaving the candidate stranded.
--
-- Now it refuses exactly the AI source identities approver.guard.ts's
-- `aiSourceIdentities` names: the source principal of an execution-sourced
-- candidate, and the candidate's Expert. A person's own approval is EPIC-031's
-- question (`selfApprovalAllowed`), and an AI approver of any other candidate is
-- refused by the principal-kind guard and by knowledge_versions_require_decision
-- (a human version needs a human approval).
--
-- Replaces the function body only; the trigger is unchanged.

CREATE OR REPLACE FUNCTION knowledge_versions_approver_not_source() RETURNS TRIGGER AS $$
DECLARE
    src TEXT;
    src_kind TEXT;
    expert TEXT;
BEGIN
    SELECT "sourcePrincipalId", "sourceKind", "expertId" INTO src, src_kind, expert FROM "learning_candidates"
     WHERE "id" = NEW."candidateId" AND "workspaceId" = NEW."workspaceId";
    IF src IS NULL THEN
        RAISE EXCEPTION 'version % names no candidate % in workspace %', NEW."id", NEW."candidateId", NEW."workspaceId";
    END IF;
    IF (src_kind = 'execution' AND NEW."approvedBy" = src) OR NEW."approvedBy" = expert THEN
        RAISE EXCEPTION 'the approver of version % is the candidate''s own AI source (FR-LRN-027)', NEW."id";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
