-- T1104 (EPIC-009 C2C reopening) — durable transition identity.
--
-- `lifecycle_transitions` already existed, append-only with its trigger
-- attached, and already carried the transition's id. What it lacked was the
-- causal and version identity a caller needs to prove WHICH application
-- produced it -- so the id could not close the proposal -> verdict -> transition
-- chain even once it was exposed.
--
-- Additive only: every column is nullable, so rows written before this
-- migration remain valid. Nothing is dropped or rewritten.

ALTER TABLE "lifecycle_transitions"
    ADD COLUMN "correlationId"     TEXT,
    ADD COLUMN "causationId"       TEXT,
    ADD COLUMN "idempotencyKey"    TEXT,
    ADD COLUMN "actorSnapshotId"   TEXT,
    ADD COLUMN "previousVersionId" TEXT,
    ADD COLUMN "resultingVersionId" TEXT;

-- Idempotency, enforced by the database rather than by a read-then-write race.
-- Partial, because history written before this migration has no key and must
-- not collide on NULL.
CREATE UNIQUE INDEX "lifecycle_transitions_idempotency_key"
    ON "lifecycle_transitions"("workspaceId", "specificationId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX "lifecycle_transitions_correlation_idx"
    ON "lifecycle_transitions"("workspaceId", "correlationId");
