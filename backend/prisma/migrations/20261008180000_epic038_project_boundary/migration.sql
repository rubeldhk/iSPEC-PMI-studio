-- `T1808` (EPIC-038) — the project boundary.
--
-- `FR-CTX-050`: context from one tenant **or project** must not appear in
-- another's package. The workspace boundary is the partition; the project
-- boundary is a second line inside it, and needs the owning project recorded
-- where the material is indexed and where a crossing is authorised.

-- The project that owns an indexed source. Nullable: some governed material
-- belongs to the workspace rather than to any one project, and that material is
-- not a project crossing. Added on the partitioned parent, so every partition
-- carries it.
ALTER TABLE "context_index_entries" ADD COLUMN "projectId" TEXT;

-- FR-CTX-051 — an authorisation may name the two projects a source crosses
-- between, inside one workspace. Both or neither: a grant naming one end of a
-- crossing is a grant to whoever fills in the other.
ALTER TABLE "context_reusable_authorisations"
    ADD COLUMN "fromProjectId" TEXT,
    ADD COLUMN "toProjectId"   TEXT;

ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "context_reusable_authorisations_projects_together" CHECK (
        ("fromProjectId" IS NULL) = ("toProjectId" IS NULL)
    );

-- `T1231`'s rule was "two different workspaces". It becomes "a real crossing":
-- two workspaces, or two different projects inside one. A grant from a place to
-- itself still crosses nothing, and is still refused.
ALTER TABLE "context_reusable_authorisations"
    DROP CONSTRAINT "context_reusable_authorisations_cross_two";
ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "context_reusable_authorisations_cross_two" CHECK (
        "workspaceId" <> "toWorkspaceId"
        OR ("fromProjectId" IS NOT NULL AND "fromProjectId" <> "toProjectId")
    );
