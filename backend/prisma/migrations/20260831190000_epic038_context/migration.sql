-- `T1231` (EPIC-038) — Engineering Context. Six tables, one of them partitioned.
--
-- `BR-0091`–`BR-0096`. Hand-written rather than generated, because three things
-- here cannot be expressed in Prisma Schema Language: `CHECK` constraints, a
-- partitioned table, and the `vector` type.
--
-- ## The structural idea, stated once
--
-- **An absence must be as visible as a presence.** `context_exclusions` exists
-- so an empty package and a heavily filtered one are different rows rather than
-- the same row with no children — the question people actually ask a year later
-- is not what a package contained, it is why it did not contain the thing they
-- expected.

-- `R-038-1` — the index lives here rather than in a separate vector database,
-- so the isolation predicate is evaluated in the same query as the similarity
-- search. A second store means the workspace filter is applied in a different
-- process against a different copy of the authorisation facts.
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "context_packages" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "projectId"         TEXT NOT NULL,
    -- FR-CTX-062. Nullable only while assembly is in flight; a package that
    -- fed nothing is a package nobody can trace to a decision.
    "executionId"       TEXT,
    -- FR-CTX-032 — what it was assembled for, in the requester's words.
    "objective"         TEXT NOT NULL,
    "actorId"           TEXT NOT NULL,
    "actorRole"         TEXT NOT NULL,
    "budgetTokens"      INTEGER NOT NULL,
    "budgetCost"        NUMERIC(12,4) NOT NULL,
    "state"             TEXT NOT NULL,
    "refusalReason"     TEXT,
    -- R-038-4 — which model ranked this package's candidates. Two models of one
    -- dimension produce incomparable spaces and the database computes distances
    -- across them without erroring, so the model is recorded rather than assumed.
    "embeddingModelId"  TEXT NOT NULL,
    "assembledAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_packages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_packages_state_is_known" CHECK ("state" IN ('assembled','refused')),
    -- FR-CTX-065. A refusal is a ROW, not an absence: without a reason,
    -- "no context was assembled" and "assembly was never attempted" are the
    -- same record.
    CONSTRAINT "context_packages_refusal_states_why" CHECK (
        "state" <> 'refused' OR length(trim(coalesce("refusalReason",''))) > 0
    ),
    CONSTRAINT "context_packages_state_their_objective" CHECK (
        length(trim("objective")) > 0
    )
);

CREATE INDEX "context_packages_workspace_idx" ON "context_packages" ("workspaceId");
-- FR-CTX-062 — the audit path: from an execution to what it was shown.
CREATE INDEX "context_packages_execution_idx" ON "context_packages" ("executionId");

-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "context_items" (
    "id"                   TEXT NOT NULL,
    "packageId"            TEXT NOT NULL,
    -- FR-CTX-040, FR-CTX-041 — the reference. There is deliberately NO content,
    -- body, payload or text column: a copy here would sit under this Epic's
    -- access rules rather than the artifact's, which is how a classified
    -- specification becomes readable by everyone who can open a package.
    "sourceType"           TEXT NOT NULL,
    "sourceId"             TEXT NOT NULL,
    "sourceVersion"        TEXT NOT NULL,
    "authoritativeStatus"  TEXT NOT NULL,
    "supersededBy"         TEXT,
    "undeterminedReason"   TEXT,
    -- FR-CTX-064, PP-016 — the objective term or rule that selected it.
    "inclusionReason"      TEXT NOT NULL,
    -- FR-CTX-014 — the score that ranked it.
    "relevanceScore"       DOUBLE PRECISION NOT NULL,
    "crossBoundary"        BOOLEAN NOT NULL DEFAULT false,
    "authorisationRef"     TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_items_package_fkey" FOREIGN KEY ("packageId")
        REFERENCES "context_packages"("id") ON DELETE CASCADE,
    CONSTRAINT "context_items_status_is_known" CHECK (
        "authoritativeStatus" IN ('current','superseded','undetermined')
    ),
    -- FR-CTX-043. A reader who learns the material is stale, and not what
    -- replaced it, has been told the half that does not let them act.
    CONSTRAINT "context_items_superseded_names_successor" CHECK (
        "authoritativeStatus" <> 'superseded'
        OR length(trim(coalesce("supersededBy",''))) > 0
    ),
    -- FR-CTX-044. "I could not look" and "nobody has decided" are both
    -- undetermined, and the reason is what separates them.
    CONSTRAINT "context_items_undetermined_says_why" CHECK (
        "authoritativeStatus" <> 'undetermined'
        OR length(trim(coalesce("undeterminedReason",''))) > 0
    ),
    -- FR-CTX-052. Without this the marking is a boolean somebody set, rather
    -- than a pointer to who permitted the crossing.
    CONSTRAINT "context_items_cross_boundary_names_authorisation" CHECK (
        "crossBoundary" = false
        OR length(trim(coalesce("authorisationRef",''))) > 0
    ),
    -- FR-CTX-064. A column that accepts '' is a column that fills with ''.
    CONSTRAINT "context_items_state_their_inclusion_reason" CHECK (
        length(trim("inclusionReason")) > 0
    )
);

CREATE INDEX "context_items_package_idx" ON "context_items" ("packageId");

-- ─────────────────────────────────────────────────────────────────────────────
-- The load-bearing table. Without it an empty package and a filtered one are
-- the same row with no children.
CREATE TABLE "context_exclusions" (
    "id"           TEXT NOT NULL,
    "packageId"    TEXT NOT NULL,
    "sourceType"   TEXT NOT NULL,
    "sourceId"     TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "detail"       TEXT NOT NULL,
    -- FR-CTX-039 — on the exclusion, so the refusal it caused is explainable
    -- after the fact.
    "wasEssential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_exclusions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_exclusions_package_fkey" FOREIGN KEY ("packageId")
        REFERENCES "context_packages"("id") ON DELETE CASCADE,
    -- Five, closed, no default. A reason by omission is an exclusion nobody
    -- can explain.
    CONSTRAINT "context_exclusions_reason_is_known" CHECK (
        "reason" IN ('permission','classification','budget','boundary','stale')
    ),
    CONSTRAINT "context_exclusions_state_their_detail" CHECK (
        length(trim("detail")) > 0
    )
);

CREATE INDEX "context_exclusions_package_idx" ON "context_exclusions" ("packageId");

-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "context_source_classes" (
    "id"                     TEXT NOT NULL,
    "workspaceId"            TEXT NOT NULL,
    "sourceType"             TEXT NOT NULL,
    "securityClassification" TEXT NOT NULL,
    -- FR-CTX-015 — governed documents and execution history only.
    "indexable"              BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_source_classes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_source_classes_unique" UNIQUE ("workspaceId","sourceType")
);

-- FR-CTX-034 — `indexable` defaults to FALSE. A source type absent from this
-- table is NOT classified, and an unclassified source is excluded. The default
-- that permits is the one nobody sees (FR-GEL-062).

-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "context_reusable_authorisations" (
    "id"              TEXT NOT NULL,
    "sourceType"      TEXT NOT NULL,
    "sourceId"        TEXT NOT NULL,
    -- Directional deliberately: "A may read B's handbook" does not imply the
    -- reverse, and a symmetric row would grant a permission nobody stated.
    "fromWorkspaceId" TEXT NOT NULL,
    "toWorkspaceId"   TEXT NOT NULL,
    "authorisedBy"    TEXT NOT NULL,
    "authorisedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rationale"       TEXT NOT NULL,
    CONSTRAINT "context_reusable_authorisations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_reusable_authorisations_state_why" CHECK (
        length(trim("rationale")) > 0
    ),
    CONSTRAINT "context_reusable_authorisations_cross_two" CHECK (
        "fromWorkspaceId" <> "toWorkspaceId"
    )
);

-- FR-CTX-053 — no row means no crossing. The absence of a prohibition is not a
-- permission, so there is nothing here that grants by default.

-- ─────────────────────────────────────────────────────────────────────────────
-- `R-038-2` — PARTITIONED BY WORKSPACE, and this is the decision the whole
-- retrieval design rests on.
--
-- pgvector applies a WHERE clause AFTER an approximate index scan, bounded by
-- hnsw.ef_search (default 40). A workspace predicate is restrictive by
-- construction in a multi-tenant corpus, so the top-40 neighbours of a query
-- are mostly other workspaces' rows — discarded after the scan, leaving fewer
-- candidates than asked for with nothing saying so.
--
-- pgvector's own guidance: partial indexes when filtering by a FEW distinct
-- values, partitioning when filtering by MANY. A tenant column is many.
--
-- Partitioning makes the boundary a property of where the row lives rather than
-- of what the query remembered to say.
CREATE TABLE "context_index_entries" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "sourceType"        TEXT NOT NULL,
    "sourceId"          TEXT NOT NULL,
    -- FR-CTX-016, R-038-5 — staleness is a VERSION comparison, never a
    -- timestamp: a re-save moves a timestamp without changing meaning, and a
    -- corrected document restored from history changes meaning without moving
    -- one forward.
    "sourceVersion"     TEXT NOT NULL,
    "embeddingModelId"  TEXT NOT NULL,
    "dimension"         INTEGER NOT NULL,
    "embedding"         vector,
    "indexedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_index_entries_pkey" PRIMARY KEY ("id","workspaceId"),
    CONSTRAINT "context_index_entries_dimension_positive" CHECK ("dimension" > 0)
) PARTITION BY LIST ("workspaceId");

-- The default partition. A workspace with no partition of its own still lands
-- somewhere rather than erroring at insert — and lands in a partition scoped to
-- nothing else, so the boundary holds either way.
CREATE TABLE "context_index_entries_default"
    PARTITION OF "context_index_entries" DEFAULT;

CREATE INDEX "context_index_entries_source_idx"
    ON "context_index_entries" ("workspaceId","sourceType","sourceId");
CREATE INDEX "context_index_entries_model_idx"
    ON "context_index_entries" ("embeddingModelId");
