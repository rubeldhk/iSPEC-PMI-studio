-- EPIC-032 (scoped) T1203 — Evidence Contracts and typed evidence.
--
-- The last seam between the Requirement Room and an approved baseline
-- (DEF-033-002). Additive: three new tables, nothing existing is altered.
--
-- The columns are the requirements. `attestsArtifactVersion` exists because
-- FR-EVS-011 asks for the version and not just the artifact, and FR-EVS-012
-- turns that into "evidence for a superseded version is not evidence for this
-- one". `integrityValid` exists because FR-EVS-034 says presence is not
-- validity. `declaredEmptyByPolicy` exists because FR-EVS-026 will not let an
-- empty Contract satisfy anything by accident.

CREATE TABLE "evidence_contracts" (
    "id"                     TEXT NOT NULL,
    "workspaceId"            TEXT NOT NULL,
    "projectId"              TEXT NOT NULL,
    -- FR-EVS-023: work is judged against the version it began under.
    "version"                INTEGER NOT NULL DEFAULT 1,
    -- FR-EVS-026: only policy may declare a work class needs no evidence.
    "declaredEmptyByPolicy"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_contract_items" (
    "id"            TEXT NOT NULL,
    -- FR-002: every tenant-scoped table carries its workspace. Denormalised
    -- from the contract deliberately -- a join is not tenant isolation, and
    -- `universal-columns.spec.ts` refuses a table that cannot be scoped without
    -- one.
    "workspaceId"   TEXT NOT NULL,
    "contractId"    TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    -- FR-EVS-025: an item states which evidence types satisfy it.
    "acceptedTypes" TEXT[] NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_contract_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evidence_contract_items_state_what_satisfies_them"
        CHECK (array_length("acceptedTypes", 1) >= 1)
);

CREATE TABLE "evidence_items" (
    "id"                     TEXT NOT NULL,
    "workspaceId"            TEXT NOT NULL,
    -- FR-EVS-003: typed by what it proves, never by which tool produced it.
    "type"                   TEXT NOT NULL,
    "satisfiesItemId"        TEXT NOT NULL,
    "attestsArtifactId"      TEXT NOT NULL,
    "attestsArtifactVersion" INTEGER NOT NULL,
    -- FR-EVS-010: source and time of production.
    "source"                 TEXT NOT NULL,
    "producedAt"             TIMESTAMP(3) NOT NULL,
    -- FR-EVS-013/034. Defaults to NOT valid: an item whose integrity nobody
    -- established must not count, and a default of `true` would make the
    -- unchecked case indistinguishable from the checked one.
    "integrityValid"         BOOLEAN NOT NULL DEFAULT false,
    -- FR-EVS-014: a referenced target that no longer resolves.
    "resolvable"             BOOLEAN NOT NULL DEFAULT true,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evidence_contracts" ADD CONSTRAINT "evidence_contracts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence_contract_items" ADD CONSTRAINT "evidence_contract_items_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "evidence_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence_contract_items" ADD CONSTRAINT "evidence_contract_items_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_satisfiesItemId_fkey"
    FOREIGN KEY ("satisfiesItemId") REFERENCES "evidence_contract_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-EVS-006/022: "which items are unmet across this scope" without opening each object.
CREATE INDEX "evidence_contract_items_contractId_idx" ON "evidence_contract_items"("contractId");
-- FR-002: workspaceId is indexed on every tenant-scoped table.
CREATE INDEX "evidence_contracts_workspaceId_idx" ON "evidence_contracts"("workspaceId");
CREATE INDEX "evidence_contract_items_workspaceId_idx" ON "evidence_contract_items"("workspaceId");
CREATE INDEX "evidence_items_workspaceId_idx" ON "evidence_items"("workspaceId");
CREATE INDEX "evidence_items_satisfiesItemId_idx" ON "evidence_items"("satisfiesItemId");
-- FR-EVS-016: evidence never crosses a workspace boundary, so every read is scoped by it.
CREATE INDEX "evidence_items_workspaceId_attests_idx"
    ON "evidence_items"("workspaceId", "attestsArtifactId", "attestsArtifactVersion");
