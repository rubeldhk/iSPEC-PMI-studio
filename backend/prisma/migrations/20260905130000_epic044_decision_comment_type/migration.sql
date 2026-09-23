-- EPIC-044 DEF-044-002 — the decomposition decision is a comment the registry admits
-- (specs/044-epic-model-journey-board/defects/DEF-044-002-decision-comment-type-refused-by-registry.md).
-- EPIC-042's hooks record a confirmed or rejected split as `commentType = 'decomposition-decision'`
-- (specs/042-pmi-spec-kit-extension/data-model.md §8); the EPIC-037 vocabulary CHECK refused it,
-- which EPIC-042 could not see because its loop was proved against a stub. Additive: the five
-- existing values stay; one is added. No row changes.
ALTER TABLE "execution_comments" DROP CONSTRAINT "execution_comments_type_vocabulary";
ALTER TABLE "execution_comments" ADD CONSTRAINT "execution_comments_type_vocabulary" CHECK (
    "commentType" IN ('completion','clarification','review','decision','system','decomposition-decision')
);
