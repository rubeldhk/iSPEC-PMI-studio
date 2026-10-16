-- EPIC-048 T2686 — a corroboration remembers the digest of what was submitted
-- (FR-LRN-061), as a candidate does in "objectDigest", so a replay under its
-- idempotency key with different evidence, scope or confidence is told apart
-- from the same submission and refused 409.
--
-- Nullable: learning_corroborations is append-only (reject_mutation), so rows
-- recorded before this column cannot be back-filled; the service compares their
-- statement, as it did before. Every row written since carries the digest.

ALTER TABLE "learning_corroborations" ADD COLUMN "objectDigest" TEXT;
ALTER TABLE "learning_corroborations" ADD CONSTRAINT "learning_corroborations_object_digest"
    CHECK ("objectDigest" IS NULL OR "objectDigest" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE "learning_corroborations" VALIDATE CONSTRAINT "learning_corroborations_object_digest";
