-- `T1820`, `T1822` (EPIC-038) — refusals before ranking are rows, and unknown
-- staleness is counted.
--
-- `FR-CTX-065`, `SC-CTX-005`: every refusal is inspectable. A refusal made
-- before anything was ranked — no index, no budget policy, no such project —
-- has no model to name, and `embeddingModelId` was NOT NULL, so it could not be
-- stored at all. The column becomes nullable, and the CHECK below keeps the
-- one row that must name a model honest: an ASSEMBLED package always does.
ALTER TABLE "context_packages" ALTER COLUMN "embeddingModelId" DROP NOT NULL;

ALTER TABLE "context_packages"
    ADD CONSTRAINT "context_packages_assembled_names_model" CHECK (
        "state" <> 'assembled' OR length(trim(coalesce("embeddingModelId", ''))) > 0
    );

-- `SC-CTX-009` — items whose staleness nobody could determine. "Not marked
-- stale" and "nobody could tell" must not read alike. Null on refusals that
-- never ranked.
ALTER TABLE "context_packages"
    ADD COLUMN "stalenessUnknown" INTEGER,
    ADD CONSTRAINT "context_packages_staleness_unknown_not_negative" CHECK (
        "stalenessUnknown" IS NULL OR "stalenessUnknown" >= 0
    );
