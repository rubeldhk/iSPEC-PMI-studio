-- `T1853` (EPIC-038) — a project-scoped grant does not also cross workspaces.
--
-- `FR-CTX-051`, `FR-CTX-053`. A grant naming projects is a crossing *inside* one
-- workspace (`T1808`). One that also crossed workspaces was retrievable — and
-- could never match, because the boundary asks a workspace crossing for a
-- workspace-level grant. The source was then excluded with "no authorisation
-- permits…", which was false. Forbidding the combination makes the two halves
-- agree: a workspace crossing names workspaces, a project crossing names
-- projects in one.
ALTER TABLE "context_reusable_authorisations"
    ADD CONSTRAINT "context_reusable_authorisations_projects_same_workspace" CHECK (
        "fromProjectId" IS NULL OR "workspaceId" = "toWorkspaceId"
    );
