-- `T1281` (EPIC-038) — a short read is written onto the package.
--
-- `R-038-3`. The vector index is approximate and can return fewer candidates
-- than it was asked for. "These are the ten most relevant items" and "these are
-- the eight the index happened to surface" are different claims, and only one
-- is what a reader assumes — so the package records both numbers, and the
-- difference is visible without re-running anything.
--
-- Nullable together: a refused package that never reached retrieval has
-- neither. Set together, and never more returned than requested — a count
-- that claims otherwise is wrong in the direction that hides gaps.
ALTER TABLE "context_packages"
    ADD COLUMN "retrievalRequested" INTEGER,
    ADD COLUMN "retrievalReturned"  INTEGER;

ALTER TABLE "context_packages"
    ADD CONSTRAINT "context_packages_retrieval_counts_together" CHECK (
        ("retrievalRequested" IS NULL) = ("retrievalReturned" IS NULL)
    ),
    ADD CONSTRAINT "context_packages_retrieval_counts_sane" CHECK (
        "retrievalRequested" IS NULL
        OR ("retrievalReturned" >= 0 AND "retrievalReturned" <= "retrievalRequested")
    );
