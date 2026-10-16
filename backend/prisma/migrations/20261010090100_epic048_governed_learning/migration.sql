-- `T2317` (EPIC-048) — Governed Learning. Ten tables, all append-only.
--
-- `BR-0114`–`BR-0118`. Hand-written, the house practice (`EPIC-031`, `EPIC-032`,
-- `EPIC-038`): CHECKs and triggers cannot be expressed in Prisma Schema Language.
-- **Never `prisma format` this file's model, and never let `migrate dev` plan
-- over it** — Prisma treats a hand-written CHECK or trigger as an extra and plans
-- a drop. `learning-constraints.spec.ts` (`T2315`) watches for every one.
--
-- ## The one structural idea
--
-- Untrusted candidates and trusted knowledge never share a table (`R-048-1`).
-- Nothing on the knowledge side is written except by `materialiser.ts`; the
-- database adds its own fences below that code fence (`R-048-4`).
--
-- ## Deferred to `T2393`, after `EPIC-031` and `EPIC-038` merge (plan items 2.3, 2.8)
--
-- - foreign keys from `decisionId` / `resolvingDecisionId` to `policy_decisions`,
--   and the `knowledge_versions_require_decision` trigger;
-- - `no_cross_workspace_knowledge` on `context_reusable_authorisations`.
--
-- The **source-exclusion half** of item 2.3 needs nothing from `EPIC-031`, so it
-- is here now: `knowledge_versions_approver_not_source` (`FR-LRN-027`, `R-048-6`
-- layer 3).
--
-- CHECKs that could meet NULL are wrapped in COALESCE(…, false).
-- `reject_mutation()` is SHARED (`20260814000000_init`): attached, never redefined.

-- ─────────────────────────────────────────────────────────────────── candidates
CREATE TABLE "learning_candidates" (
    "id"                      TEXT NOT NULL,
    "workspaceId"             TEXT NOT NULL,
    "projectId"               TEXT NOT NULL,
    "kind"                    TEXT NOT NULL,
    "targetVersionId"         TEXT,
    "statement"               TEXT NOT NULL,
    "category"                TEXT NOT NULL,
    "subject"                 TEXT NOT NULL,
    -- `R-048-15` — category ':' normalised subject; corroboration and conflict match on it.
    "subjectKey"              TEXT NOT NULL,
    "sourceKind"              TEXT NOT NULL,
    "executionId"             TEXT,
    "sourcePrincipalId"       TEXT NOT NULL,
    "expertId"                TEXT,
    "expertContractVersionId" TEXT,
    "expertContractVersion"   INTEGER,
    -- `FR-LRN-013` — as stated, never raised.
    "confidenceLevel"         TEXT NOT NULL,
    "confidenceBasis"         TEXT NOT NULL,
    -- `FR-LRN-014` — a proposal, not a grant.
    "claimedScope"            JSONB NOT NULL,
    -- `FR-LRN-023` — the submitter's proposal only; the effective band is EPIC-031's.
    "proposedBand"            TEXT,
    "late"                    BOOLEAN NOT NULL DEFAULT false,
    "provisional"             BOOLEAN NOT NULL DEFAULT false,
    "policyVersion"           INTEGER NOT NULL,
    -- sha256 of the canonical core — the `objectVersion` sent to EPIC-031.
    "objectDigest"            TEXT NOT NULL,
    "idempotencyKey"          TEXT NOT NULL,
    "correlationId"           TEXT NOT NULL,
    "submittedAt"             TIMESTAMP(3) NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_candidates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_candidates_kind" CHECK (COALESCE("kind" IN ('new','supersede','deprecate','widen-scope'), false)),
    CONSTRAINT "learning_candidates_target" CHECK (COALESCE(("kind" = 'new') = ("targetVersionId" IS NULL), false)),
    CONSTRAINT "learning_candidates_statement" CHECK (COALESCE(length(btrim("statement")) > 0 AND length(btrim("subject")) > 0 AND length(btrim("category")) > 0, false)),
    CONSTRAINT "learning_candidates_source" CHECK (COALESCE(
        ("sourceKind" = 'execution' AND "executionId" IS NOT NULL) OR ("sourceKind" = 'person' AND "executionId" IS NULL), false)),
    CONSTRAINT "learning_candidates_expert_together" CHECK (COALESCE(
        ("expertId" IS NULL) = ("expertContractVersionId" IS NULL) AND ("expertId" IS NULL) = ("expertContractVersion" IS NULL), false)),
    CONSTRAINT "learning_candidates_confidence" CHECK (COALESCE("confidenceLevel" IN ('low','medium','high') AND length(btrim("confidenceBasis")) > 0, false)),
    CONSTRAINT "learning_candidates_band" CHECK ("proposedBand" IS NULL OR "proposedBand" IN ('low','medium','high')),
    CONSTRAINT "learning_candidates_scope" CHECK (COALESCE("claimedScope"->>'kind' IN ('project','workspace','projects'), false)),
    CONSTRAINT "learning_candidates_digest" CHECK (COALESCE("objectDigest" ~ '^[a-f0-9]{64}$', false))
);
CREATE UNIQUE INDEX "learning_candidates_workspace_idempotency_key" ON "learning_candidates"("workspaceId", "idempotencyKey");
CREATE INDEX "learning_candidates_workspaceId_idx" ON "learning_candidates"("workspaceId");
CREATE INDEX "learning_candidates_subject_idx" ON "learning_candidates"("workspaceId", "subjectKey");
CREATE INDEX "learning_candidates_execution_idx" ON "learning_candidates"("workspaceId", "executionId");

-- ───────────────────────────────────────────────────────────────── corroborations
CREATE TABLE "learning_corroborations" (
    "id"                      TEXT NOT NULL,
    "workspaceId"             TEXT NOT NULL,
    "candidateId"             TEXT NOT NULL,
    "sourceKind"              TEXT NOT NULL,
    "executionId"             TEXT,
    "sourcePrincipalId"       TEXT NOT NULL,
    "expertId"                TEXT,
    "expertContractVersionId" TEXT,
    -- Shown to the reviewer as submitted; never merged into the candidate.
    "statement"               TEXT NOT NULL,
    "confidenceLevel"         TEXT NOT NULL,
    "confidenceBasis"         TEXT NOT NULL,
    "late"                    BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey"          TEXT NOT NULL,
    "correlationId"           TEXT NOT NULL,
    "submittedAt"             TIMESTAMP(3) NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_corroborations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_corroborations_source" CHECK (COALESCE(
        ("sourceKind" = 'execution' AND "executionId" IS NOT NULL) OR ("sourceKind" = 'person' AND "executionId" IS NULL), false)),
    CONSTRAINT "learning_corroborations_confidence" CHECK (COALESCE("confidenceLevel" IN ('low','medium','high'), false))
);
CREATE UNIQUE INDEX "learning_corroborations_workspace_idempotency_key" ON "learning_corroborations"("workspaceId", "idempotencyKey");
CREATE INDEX "learning_corroborations_workspaceId_idx" ON "learning_corroborations"("workspaceId");
CREATE INDEX "learning_corroborations_candidate_idx" ON "learning_corroborations"("candidateId");
CREATE INDEX "learning_corroborations_execution_idx" ON "learning_corroborations"("workspaceId", "executionId");

-- ─────────────────────────────────────────────────────────────────── citations
CREATE TABLE "learning_candidate_evidence" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "candidateId"     TEXT NOT NULL,
    "corroborationId" TEXT,
    -- EPIC-032 `evidence_items.id` — deliberately no FK: another Epic's table,
    -- resolved by reading through its service (`R-048-8`). No payload column.
    "evidenceId"      TEXT NOT NULL,
    "digestAlgorithm" TEXT NOT NULL,
    "digest"          TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_candidate_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_candidate_evidence_digest" CHECK (COALESCE("digestAlgorithm" = 'sha256' AND "digest" ~ '^[a-f0-9]{64}$', false))
);
CREATE INDEX "learning_candidate_evidence_workspaceId_idx" ON "learning_candidate_evidence"("workspaceId");
CREATE INDEX "learning_candidate_evidence_candidate_idx" ON "learning_candidate_evidence"("candidateId");

-- ───────────────────────────────────────────────────────────────── transitions
CREATE TABLE "learning_candidate_transitions" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "seq"         INTEGER NOT NULL,
    "state"       TEXT NOT NULL,
    "reason"      TEXT,
    "decisionId"  TEXT,
    "actorKind"   TEXT NOT NULL,
    "actorId"     TEXT NOT NULL,
    "at"          TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_candidate_transitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_candidate_transitions_seq" CHECK (COALESCE("seq" >= 1, false)),
    -- `FR-LRN-004` — exactly six.
    CONSTRAINT "learning_candidate_transitions_state" CHECK (COALESCE(
        "state" IN ('proposed','pending-review','approved','rejected','expired','withdrawn'), false)),
    CONSTRAINT "learning_candidate_transitions_actor" CHECK (COALESCE("actorKind" IN ('human','policy','platform'), false)),
    -- `FR-LRN-027` — approved names its decision, and is never a platform's (or an AI's) act.
    CONSTRAINT "learning_candidate_transitions_approved" CHECK (
        "state" <> 'approved' OR COALESCE("decisionId" IS NOT NULL AND "actorKind" IN ('human','policy'), false)),
    -- `FR-LRN-029` — a rejection keeps its reviewer and reason.
    CONSTRAINT "learning_candidate_transitions_rejected" CHECK (
        "state" <> 'rejected' OR COALESCE(length(btrim("reason")) > 0 AND "actorKind" = 'human', false))
);
CREATE UNIQUE INDEX "learning_candidate_transitions_candidate_seq_key" ON "learning_candidate_transitions"("candidateId", "seq");
CREATE INDEX "learning_candidate_transitions_workspaceId_idx" ON "learning_candidate_transitions"("workspaceId");
CREATE INDEX "learning_candidate_transitions_latest_idx" ON "learning_candidate_transitions"("candidateId", "seq" DESC);

-- ──────────────────────────────────────────────────────────────── review terms
CREATE TABLE "learning_review_terms" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "candidateId"       TEXT NOT NULL,
    "decisionId"        TEXT NOT NULL,
    "approvedStatement" TEXT NOT NULL,
    "approvedScope"     JSONB NOT NULL,
    "classification"    TEXT NOT NULL,
    "reviewerId"        TEXT NOT NULL,
    "at"                TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_review_terms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_review_terms_content" CHECK (COALESCE(
        length(btrim("approvedStatement")) > 0 AND length(btrim("classification")) > 0
        AND "approvedScope"->>'kind' IN ('project','workspace','projects'), false))
);
CREATE UNIQUE INDEX "learning_review_terms_candidate_decision_key" ON "learning_review_terms"("candidateId", "decisionId");
CREATE INDEX "learning_review_terms_workspaceId_idx" ON "learning_review_terms"("workspaceId");

-- ──────────────────────────────────────────────────────────────────── entries
CREATE TABLE "knowledge_entries" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "category"        TEXT NOT NULL,
    "subjectKey"      TEXT NOT NULL,
    -- `FR-LRN-044` — an undetermined classification stays here.
    "originProjectId" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_entries_workspaceId_idx" ON "knowledge_entries"("workspaceId");
CREATE INDEX "knowledge_entries_subject_idx" ON "knowledge_entries"("workspaceId", "subjectKey");

-- ─────────────────────────────────────────────────────────────────── versions
CREATE TABLE "knowledge_entry_versions" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "entryId"             TEXT NOT NULL,
    "version"             INTEGER NOT NULL,
    "statement"           TEXT NOT NULL,
    -- `FR-LRN-028` — what was proposed and what was approved, both kept.
    "proposedStatement"   TEXT NOT NULL,
    "scope"               JSONB NOT NULL,
    "proposedScope"       JSONB NOT NULL,
    -- `FR-LRN-038`; `undetermined` is a value, not a NULL.
    "classification"      TEXT NOT NULL,
    -- `SC-LRN-001` — no knowledge without a candidate.
    "candidateId"         TEXT NOT NULL,
    -- The EPIC-031 decision requested; FK to `policy_decisions` arrives with T2393.
    "decisionId"          TEXT NOT NULL,
    "resolvingDecisionId" TEXT,
    "approvedByKind"      TEXT NOT NULL,
    "approvedBy"          TEXT NOT NULL,
    "approvedAt"          TIMESTAMP(3) NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entry_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_entry_versions_version" CHECK (COALESCE("version" >= 1, false)),
    -- `FR-LRN-027` — there is no 'agent' value to write.
    CONSTRAINT "knowledge_entry_versions_approvedByKind" CHECK (COALESCE("approvedByKind" IN ('human','policy'), false)),
    CONSTRAINT "knowledge_entry_versions_content" CHECK (COALESCE(
        length(btrim("statement")) > 0 AND length(btrim("classification")) > 0 AND length(btrim("approvedBy")) > 0
        AND "scope"->>'kind' IN ('project','workspace','projects'), false))
);
CREATE UNIQUE INDEX "knowledge_entry_versions_entry_version_key" ON "knowledge_entry_versions"("entryId", "version");
CREATE UNIQUE INDEX "knowledge_entry_versions_candidate_key" ON "knowledge_entry_versions"("candidateId");
CREATE INDEX "knowledge_entry_versions_workspaceId_idx" ON "knowledge_entry_versions"("workspaceId");
CREATE INDEX "knowledge_entry_versions_browse_idx" ON "knowledge_entry_versions"("workspaceId", "approvedAt" DESC, "id" DESC);

-- ──────────────────────────────────────────────────────────────── status events
CREATE TABLE "knowledge_version_status_events" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT NOT NULL,
    "versionId"          TEXT NOT NULL,
    "status"             TEXT NOT NULL,
    "successorVersionId" TEXT,
    "reason"             TEXT,
    "actorId"            TEXT NOT NULL,
    "decisionId"         TEXT,
    -- The candidate whose approval caused this status — a deprecation's proof
    -- for `learning_transitions_guard`, since it writes no version.
    "candidateId"        TEXT,
    "at"                 TIMESTAMP(3) NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_version_status_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_version_status_events_status" CHECK (COALESCE("status" IN ('current','superseded','deprecated'), false)),
    -- `FR-LRN-032`.
    CONSTRAINT "knowledge_version_status_events_successor" CHECK ("status" <> 'superseded' OR "successorVersionId" IS NOT NULL),
    -- `FR-LRN-033` — reason, actor and instant; and the decision behind it.
    CONSTRAINT "knowledge_version_status_events_deprecated" CHECK (
        "status" <> 'deprecated' OR COALESCE(length(btrim("reason")) > 0 AND "decisionId" IS NOT NULL, false))
);
CREATE INDEX "knowledge_version_status_events_workspaceId_idx" ON "knowledge_version_status_events"("workspaceId");
CREATE INDEX "knowledge_version_status_events_version_idx" ON "knowledge_version_status_events"("versionId", "at" DESC);

-- ──────────────────────────────────────────────────────────────────── flags
CREATE TABLE "knowledge_flags" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "versionId"    TEXT,
    "candidateId"  TEXT,
    "kind"         TEXT NOT NULL,
    "detail"       TEXT NOT NULL,
    "raisedAt"     TIMESTAMP(3) NOT NULL,
    -- A later row clears an earlier one; nothing is updated.
    "clearsFlagId" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_flags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_flags_one_subject" CHECK (("versionId" IS NULL) <> ("candidateId" IS NULL)),
    CONSTRAINT "knowledge_flags_kind" CHECK (COALESCE("kind" IN (
        'evidence-changed','source-invalid','attestation-missing','policy-auto-executed-review','decision-not-accepted'), false))
);
CREATE INDEX "knowledge_flags_workspaceId_idx" ON "knowledge_flags"("workspaceId");
CREATE INDEX "knowledge_flags_version_idx" ON "knowledge_flags"("versionId");
CREATE INDEX "knowledge_flags_candidate_idx" ON "knowledge_flags"("candidateId");

-- ───────────────────────────────────────────────────────────── retrievability
CREATE TABLE "knowledge_retrievability" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "versionId"   TEXT NOT NULL,
    "outcome"     TEXT NOT NULL,
    "reason"      TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_retrievability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_retrievability_outcome" CHECK (COALESCE("outcome" IN ('retrievable','not-yet-retrievable'), false)),
    -- `FR-LRN-053` — not yet retrievable always says why.
    CONSTRAINT "knowledge_retrievability_reason" CHECK ("outcome" <> 'not-yet-retrievable' OR COALESCE(length(btrim("reason")) > 0, false))
);
CREATE INDEX "knowledge_retrievability_workspaceId_idx" ON "knowledge_retrievability"("workspaceId");
CREATE INDEX "knowledge_retrievability_version_idx" ON "knowledge_retrievability"("versionId", "attemptedAt" DESC);

-- ───────────────────────────────────────────────────────────────── foreign keys
ALTER TABLE "learning_candidates" ADD CONSTRAINT "learning_candidates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidates" ADD CONSTRAINT "learning_candidates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidates" ADD CONSTRAINT "learning_candidates_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "knowledge_entry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_corroborations" ADD CONSTRAINT "learning_corroborations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_corroborations" ADD CONSTRAINT "learning_corroborations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidate_evidence" ADD CONSTRAINT "learning_candidate_evidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidate_evidence" ADD CONSTRAINT "learning_candidate_evidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidate_evidence" ADD CONSTRAINT "learning_candidate_evidence_corroborationId_fkey" FOREIGN KEY ("corroborationId") REFERENCES "learning_corroborations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidate_transitions" ADD CONSTRAINT "learning_candidate_transitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_candidate_transitions" ADD CONSTRAINT "learning_candidate_transitions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_review_terms" ADD CONSTRAINT "learning_review_terms_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_review_terms" ADD CONSTRAINT "learning_review_terms_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_originProjectId_fkey" FOREIGN KEY ("originProjectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "knowledge_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_version_status_events" ADD CONSTRAINT "knowledge_version_status_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_version_status_events" ADD CONSTRAINT "knowledge_version_status_events_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_entry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_version_status_events" ADD CONSTRAINT "knowledge_version_status_events_successor_fkey" FOREIGN KEY ("successorVersionId") REFERENCES "knowledge_entry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_version_status_events" ADD CONSTRAINT "knowledge_version_status_events_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_flags" ADD CONSTRAINT "knowledge_flags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_flags" ADD CONSTRAINT "knowledge_flags_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_entry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_flags" ADD CONSTRAINT "knowledge_flags_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "learning_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_flags" ADD CONSTRAINT "knowledge_flags_clearsFlagId_fkey" FOREIGN KEY ("clearsFlagId") REFERENCES "knowledge_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_retrievability" ADD CONSTRAINT "knowledge_retrievability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_retrievability" ADD CONSTRAINT "knowledge_retrievability_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_entry_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────── append-only, all ten tables
CREATE TRIGGER "learning_candidates_immutable" BEFORE UPDATE OR DELETE ON "learning_candidates" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "learning_candidate_evidence_immutable" BEFORE UPDATE OR DELETE ON "learning_candidate_evidence" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "learning_corroborations_immutable" BEFORE UPDATE OR DELETE ON "learning_corroborations" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "learning_candidate_transitions_immutable" BEFORE UPDATE OR DELETE ON "learning_candidate_transitions" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "learning_review_terms_immutable" BEFORE UPDATE OR DELETE ON "learning_review_terms" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "knowledge_entries_immutable" BEFORE UPDATE OR DELETE ON "knowledge_entries" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "knowledge_entry_versions_immutable" BEFORE UPDATE OR DELETE ON "knowledge_entry_versions" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "knowledge_version_status_events_immutable" BEFORE UPDATE OR DELETE ON "knowledge_version_status_events" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "knowledge_flags_immutable" BEFORE UPDATE OR DELETE ON "knowledge_flags" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER "knowledge_retrievability_immutable" BEFORE UPDATE OR DELETE ON "knowledge_retrievability" FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ───────────────────────────────────────────── learning_transitions_guard (2.4)
-- Refuses any row after a terminal state, a sequence that is not the next one,
-- and `approved` unless the knowledge it stands for was inserted in THIS
-- transaction: a version for the candidate, or (a deprecation) a status event it
-- caused. The writer inserts the knowledge first, then the transition.
CREATE FUNCTION learning_transitions_guard() RETURNS TRIGGER AS $$
DECLARE
    last_state TEXT;
    last_seq   INTEGER;
    this_xact  TEXT := (txid_current() % 4294967296)::TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('learning-candidate:' || NEW."candidateId"));
    SELECT "state", "seq" INTO last_state, last_seq
      FROM "learning_candidate_transitions"
     WHERE "candidateId" = NEW."candidateId"
     ORDER BY "seq" DESC LIMIT 1;
    IF last_state IN ('approved','rejected','expired','withdrawn') THEN
        RAISE EXCEPTION 'candidate % is %, a terminal state; nothing follows it (FR-LRN-004)', NEW."candidateId", last_state;
    END IF;
    IF NEW."seq" <> COALESCE(last_seq, 0) + 1 THEN
        RAISE EXCEPTION 'transition seq % for candidate % is not the next sequence (%)', NEW."seq", NEW."candidateId", COALESCE(last_seq, 0) + 1;
    END IF;
    IF NEW."state" = 'approved' AND NOT EXISTS (
            SELECT 1 FROM "knowledge_entry_versions" v
             WHERE v."candidateId" = NEW."candidateId" AND v."workspaceId" = NEW."workspaceId" AND v.xmin::TEXT = this_xact)
       AND NOT EXISTS (
            SELECT 1 FROM "knowledge_version_status_events" s
             WHERE s."candidateId" = NEW."candidateId" AND s."workspaceId" = NEW."workspaceId"
               AND s."status" = 'deprecated' AND s.xmin::TEXT = this_xact) THEN
        RAISE EXCEPTION 'candidate % may become approved only with its knowledge version written in the same transaction (R-048-4)', NEW."candidateId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "learning_transitions_guard"
    BEFORE INSERT ON "learning_candidate_transitions"
    FOR EACH ROW EXECUTE FUNCTION learning_transitions_guard();

-- ────────────────────────────────────── learning_review_terms_within_claim (2.5)
CREATE FUNCTION learning_review_terms_within_claim() RETURNS TRIGGER AS $$
DECLARE
    claimed JSONB;
BEGIN
    SELECT "claimedScope" INTO claimed FROM "learning_candidates"
     WHERE "id" = NEW."candidateId" AND "workspaceId" = NEW."workspaceId";
    IF claimed IS NULL THEN
        RAISE EXCEPTION 'review terms name no candidate % in workspace %', NEW."candidateId", NEW."workspaceId";
    END IF;
    IF claimed->>'kind' = 'workspace' THEN
        RETURN NEW;
    END IF;
    IF NEW."approvedScope"->>'kind' = 'workspace' OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(NEW."approvedScope"->'projectIds', '[]'::jsonb)) a(p)
         WHERE a.p NOT IN (SELECT jsonb_array_elements_text(COALESCE(claimed->'projectIds', '[]'::jsonb)))) THEN
        RAISE EXCEPTION 'approved scope is wider than the scope claimed by candidate % (FR-LRN-028)', NEW."candidateId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "learning_review_terms_within_claim"
    BEFORE INSERT ON "learning_review_terms"
    FOR EACH ROW EXECUTE FUNCTION learning_review_terms_within_claim();

-- ────────────────────────────────────── learning_candidates_have_evidence (2.6)
CREATE FUNCTION learning_candidates_have_evidence() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "learning_candidate_evidence"
                    WHERE "candidateId" = NEW."id" AND "corroborationId" IS NULL) THEN
        RAISE EXCEPTION 'candidate % has no evidence citation at commit (FR-LRN-012)', NEW."id";
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "learning_candidates_have_evidence"
    AFTER INSERT ON "learning_candidates"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION learning_candidates_have_evidence();

-- ───────────────────────── knowledge_versions_approver_not_source (2.3, part)
-- `R-048-6` layer 3: whatever the code does, the candidate's own source — its
-- agent principal or its Expert — cannot be recorded as its approver.
CREATE FUNCTION knowledge_versions_approver_not_source() RETURNS TRIGGER AS $$
DECLARE
    src TEXT;
    expert TEXT;
BEGIN
    SELECT "sourcePrincipalId", "expertId" INTO src, expert FROM "learning_candidates"
     WHERE "id" = NEW."candidateId" AND "workspaceId" = NEW."workspaceId";
    IF src IS NULL THEN
        RAISE EXCEPTION 'version % names no candidate % in workspace %', NEW."id", NEW."candidateId", NEW."workspaceId";
    END IF;
    IF NEW."approvedBy" = src OR NEW."approvedBy" = expert THEN
        RAISE EXCEPTION 'the approver of version % is the candidate''s own source (FR-LRN-027)', NEW."id";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "knowledge_versions_approver_not_source"
    BEFORE INSERT ON "knowledge_entry_versions"
    FOR EACH ROW EXECUTE FUNCTION knowledge_versions_approver_not_source();

-- ──────────────────────────────────────────────────────────────── views (2.7)
CREATE VIEW "learning_candidate_current" AS
    SELECT DISTINCT ON ("candidateId") *
      FROM "learning_candidate_transitions"
     ORDER BY "candidateId", "seq" DESC;

CREATE VIEW "knowledge_current_versions" AS
    SELECT DISTINCT ON ("versionId") *
      FROM "knowledge_version_status_events"
     ORDER BY "versionId", "at" DESC, "createdAt" DESC, "id" DESC;
