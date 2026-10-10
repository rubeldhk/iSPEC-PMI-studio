-- EPIC-032 T856o — the evidence store, the Evidence Contract binding and the
-- completion record (data-model §1–§5).
--
-- EVOLVED, NOT REPLACED. The scoped slice (T1203, 2026-08-30) created
-- evidence_contracts, evidence_contract_items and evidence_items with a
-- narrower shape, and two shipped Rooms read them (EPIC-033 BaselineService,
-- EPIC-034 ClosureService). data-model.md was written before that slice and
-- names the same tables with a different shape. Replacing them would break both
-- Rooms; this migration adds the attestation columns beside the slice's and
-- leaves every existing column meaning what it meant. Recorded as DEF-032-001.
--
-- THREE FENCES, NOT CONVENIENCES (tasks.md T856o):
--   1. subjectDigest NOT NULL           — FR-EVS-042
--   2. stored XOR referenced            — FR-EVS-005
--   3. refused => unmetItems NOT NULL   — FR-EVS-032
-- Fences 1 and 2 are NOT VALID: PostgreSQL enforces them on every row written
-- from now on and does not re-check T1203's rows, which predate the columns.
-- A NOT VALID check is still a check; it is not a TODO.

-- evidence_contracts / evidence_contract_items are NOT altered. Work-class
-- Contracts are repository-resident JSON (R-032-4) under
-- packages/evidence-contract/contracts/, versioned by file and loaded at
-- startup; a row per version would be a second copy of a reviewed file, and two
-- copies of a Contract can disagree. T1203's Room-scoped Contracts keep using
-- these tables unchanged.

-- ─────────────────────────────────────────────── evidence_items (§1)
-- An attestation satisfies items by type and attachment, not by a pointer.
ALTER TABLE "evidence_items" ALTER COLUMN "satisfiesItemId" DROP NOT NULL;

ALTER TABLE "evidence_items"
    ADD COLUMN "projectId"      TEXT,
    ADD COLUMN "subjectDigest"  JSONB,
    ADD COLUMN "subjectName"    TEXT,
    ADD COLUMN "sourceVersion"  TEXT,
    ADD COLUMN "storage"        TEXT,
    ADD COLUMN "payload"        JSONB,
    ADD COLUMN "reference"      JSONB,
    ADD COLUMN "integrity"      JSONB,
    ADD COLUMN "attachedToType" TEXT,
    ADD COLUMN "attachedToId"   TEXT;

-- Fence 1 — FR-EVS-042. A contribution naming no artifact version is refused by
-- the schema, not by a service check that could be bypassed.
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_subject_digest_required"
    CHECK ("subjectDigest" IS NOT NULL) NOT VALID;

-- Fence 2 — FR-EVS-005. A row that is neither stored nor referenced is not
-- representable, and neither is one that is both.
--
-- `COALESCE(..., false)` is load-bearing. Without it a NULL "storage" makes both
-- disjuncts NULL, the CHECK evaluates to NULL, and PostgreSQL ACCEPTS a CHECK
-- that is NULL — so the "neither" row this fence exists to refuse went straight
-- in. Found by evidence-append-only.spec.ts on its first run.
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_stored_xor_referenced"
    CHECK (COALESCE(
        ("storage" = 'stored'     AND "payload"   IS NOT NULL AND "reference" IS NULL)
     OR ("storage" = 'referenced' AND "reference" IS NOT NULL AND "payload"   IS NULL),
        false)) NOT VALID;

-- FR-EVS-013 — integrity metadata travels with every attestation.
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_integrity_required"
    CHECK ("integrity" IS NOT NULL) NOT VALID;

-- FR-EVS-004 — attached to an artifact, a task, a decision or an outcome.
-- Bindings use the same four kinds for their workRef, which is how evidence
-- attached to a piece of work is found without a Room foreign key.
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_attached_to_known_kind"
    CHECK (COALESCE(
        "attachedToType" IN ('artifact', 'task', 'decision', 'outcome')
        AND "attachedToId" IS NOT NULL,
        false)) NOT VALID;

CREATE INDEX "evidence_items_workspaceId_attachedTo_idx"
    ON "evidence_items"("workspaceId", "attachedToType", "attachedToId");

-- Append-only (data-model §1), following audit_entries. reject_mutation() is
-- SHARED and defined by the init migration; this attaches to it, never
-- redefines it. Evidence for a superseded version must stay readable, so it is
-- never pruned either (R-032-7).
CREATE TRIGGER "evidence_items_immutable"
    BEFORE UPDATE OR DELETE ON "evidence_items"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ─────────────────────────────────────────────── work_evidence_bindings (§4)
CREATE TABLE "work_evidence_bindings" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    -- Opaque: no foreign key into any Room's tables (data-model §4).
    "workRefType"     TEXT NOT NULL,
    "workRefId"       TEXT NOT NULL,
    "workClass"       TEXT NOT NULL,
    -- FR-EVS-021, FR-EVS-023: fixed at creation.
    "contractVersion" INTEGER NOT NULL,
    -- FR-EVS-011/012: the artifact, and its version, this work is judged
    -- against. Evidence for another artifact or another version does not count.
    -- FR-EVS-015: the type is what EPIC-024's access rules are keyed by.
    "subjectArtifactType" TEXT NOT NULL,
    "subjectArtifactId" TEXT NOT NULL,
    "subjectVersion"  INTEGER NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_evidence_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_evidence_bindings_workRef_known_kind"
        CHECK ("workRefType" IN ('artifact', 'task', 'decision', 'outcome')),
    CONSTRAINT "work_evidence_bindings_versions_positive"
        CHECK ("contractVersion" >= 1 AND "subjectVersion" >= 1)
);

ALTER TABLE "work_evidence_bindings" ADD CONSTRAINT "work_evidence_bindings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_evidence_bindings_workspaceId_idx" ON "work_evidence_bindings"("workspaceId");
CREATE INDEX "work_evidence_bindings_workRef_idx"
    ON "work_evidence_bindings"("workspaceId", "workRefType", "workRefId");

-- A new subject version is a new binding row; the old one is history.
CREATE TRIGGER "work_evidence_bindings_immutable"
    BEFORE UPDATE OR DELETE ON "work_evidence_bindings"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ─────────────────────────────────────────────── evidence_completion_attempts (§5)
CREATE TABLE "evidence_completion_attempts" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "workRefType"     TEXT NOT NULL,
    "workRefId"       TEXT NOT NULL,
    "declaredBy"      TEXT NOT NULL,
    "declaredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome"         TEXT NOT NULL,
    "unmetItems"      JSONB,
    "contractVersion" INTEGER NOT NULL,
    "trigger"         TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_completion_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evidence_completion_attempts_outcome_known"
        CHECK ("outcome" IN ('accepted', 'refused')),
    CONSTRAINT "evidence_completion_attempts_trigger_known"
        CHECK ("trigger" IN ('declaration', 'evidence-arrival')),
    -- Fence 3 — FR-EVS-032. A refusal that does not say what is missing is the
    -- "not ready" message the requirement exists to forbid.
    CONSTRAINT "evidence_completion_attempts_refusal_names_unmet"
        CHECK (
            "outcome" <> 'refused'
            OR ("unmetItems" IS NOT NULL
                AND jsonb_typeof("unmetItems") = 'array'
                AND jsonb_array_length("unmetItems") > 0)
        )
);

ALTER TABLE "evidence_completion_attempts" ADD CONSTRAINT "evidence_completion_attempts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "evidence_completion_attempts_workspaceId_idx" ON "evidence_completion_attempts"("workspaceId");
CREATE INDEX "evidence_completion_attempts_workRef_idx"
    ON "evidence_completion_attempts"("workspaceId", "workRefType", "workRefId");

-- FR-EVS-031: re-evaluation is a new attempt, not a mutation of the old.
CREATE TRIGGER "evidence_completion_attempts_immutable"
    BEFORE UPDATE OR DELETE ON "evidence_completion_attempts"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
