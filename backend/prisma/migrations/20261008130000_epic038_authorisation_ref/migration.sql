-- `T1260` (EPIC-038) — a crossing cites a real authorisation.
--
-- `FR-CTX-051`–`FR-CTX-053`. `T1231`'s CHECK required `authorisationRef` to be
-- non-empty when `crossBoundary` is true, and accepted any non-empty string. A
-- marking that points at nothing is a boolean with a longer name, so the
-- reference becomes a foreign key — and a composite one, because there are
-- three distinct ways to cite a REAL authorisation wrongly:
--
-- | Wrong citation | Stopped by |
-- |---|---|
-- | An authorisation that does not exist | the key itself |
-- | One granted to a different workspace | `toWorkspaceId` = the item's `workspaceId` |
-- | One for a different source | `sourceType`, `sourceId` = the item's |
--
-- MATCH SIMPLE (the default): an item with a NULL `authorisationRef` is not
-- checked against the table, which is exactly own-workspace material.

-- The target of the composite key. `id` is already unique; this names the
-- combination a citation must match.
ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "context_reusable_authorisations_citable"
    UNIQUE ("id", "toWorkspaceId", "sourceType", "sourceId");

-- FR-CTX-051 — an authorisation nobody gave is not an authorisation.
ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "context_reusable_authorisations_names_grantor"
    CHECK (length(trim("authorisedBy")) > 0);

-- ON DELETE RESTRICT: withdrawing a grant stops FUTURE crossings, and the
-- package that was shown the material still has to say who permitted it. The
-- audit trail outlives the grant.
ALTER TABLE "context_items"
    ADD CONSTRAINT "context_items_authorisation_fkey"
    FOREIGN KEY ("authorisationRef", "workspaceId", "sourceType", "sourceId")
    REFERENCES "context_reusable_authorisations" ("id", "toWorkspaceId", "sourceType", "sourceId")
    ON DELETE RESTRICT;

-- The converse of `context_items_cross_boundary_names_authorisation`. Own
-- material carrying a reference would make `crossBoundary` stop being the
-- thing a reviewer scans for.
ALTER TABLE "context_items"
    ADD CONSTRAINT "context_items_only_crossings_cite_authorisation"
    CHECK ("crossBoundary" = true OR "authorisationRef" IS NULL);

CREATE INDEX "context_items_authorisationRef_idx" ON "context_items"("authorisationRef");
