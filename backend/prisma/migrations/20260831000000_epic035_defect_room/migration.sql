-- T997t (EPIC-035) — the Defect Room's eight tables.
--
-- Written by hand rather than generated, because the guarantees this Epic rests
-- on are CHECK constraints and Prisma's schema language cannot express them
-- (R-035-8). A generated migration would produce the tables and silently omit
-- every rule that makes them worth having.
--
-- The two the task names:
--
--   1. A fix cannot be accepted for an automatable defect with no failing test
--      (FR-DFR-041). The service refuses it too; this holds when a caller
--      reaches past the service, which is the case SC-DFR-004 measures.
--   2. A Classification cannot exist without the destination its outcome maps
--      to (FR-DFR-077). An item resting classified with nowhere to go is how a
--      requirement gap becomes a defect nobody routes.
--
-- And the ones the data model asks for beside them: a confirmed defect is
-- classified by a human (FR-DFR-023), a not-automatable reproduction states its
-- reason (FR-DFR-043), an evidence-check path is one of three (R-035-6), and a
-- contested artifact names the VERSION it was reported against (FR-DFR-024).

CREATE TABLE "defect_records" (
    "id"                       TEXT NOT NULL,
    "workspaceId"              TEXT NOT NULL,
    "projectId"                TEXT NOT NULL,
    -- FR-DFR-012: nullable, and nullable is not laxity. An unlinkable defect is
    -- HELD FOR TRIAGE rather than filed against an Epic somebody guessed.
    "epicId"                   TEXT,
    "state"                    TEXT NOT NULL DEFAULT 'held-for-triage',
    "origin"                   TEXT NOT NULL,
    "originDetail"             TEXT,
    "contestedArtifactRef"     TEXT NOT NULL,
    -- FR-DFR-024, PP-012. Without this the report silently re-targets whatever
    -- is current, and answers a question nobody asked.
    "contestedArtifactVersion" TEXT NOT NULL,
    "severity"                 TEXT NOT NULL,
    "reportedBy"               TEXT NOT NULL,
    "reportedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt"              TIMESTAMP(3),
    "withdrawnReason"          TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defect_records_state_is_known" CHECK ("state" IN (
        'held-for-triage','triaged','reproducing','test-pending','confirmed',
        'repairing','verifying','closed','routed','withdrawn'
    )),
    -- The specification's edge cases accept an AI-filed defect. `agent` is an
    -- ORIGIN and nothing more: FR-DFR-023 still forbids an agent confirming one.
    CONSTRAINT "defect_records_origin_is_known" CHECK ("origin" IN (
        'automated-test','manual-report','monitoring','review-tool',
        'production-incident','agent'
    )),
    -- FR-DFR-012: an Epic-less defect may exist, but only while it is being
    -- triaged. Any other state without an Epic is a defect nobody can find.
    CONSTRAINT "defect_records_unlinked_are_held_for_triage" CHECK (
        "epicId" IS NOT NULL OR "state" IN ('held-for-triage','withdrawn')
    ),
    -- A withdrawal says why. FR-DFR-025's never-delete rule is worth nothing if
    -- the record can be emptied instead.
    CONSTRAINT "defect_records_withdrawals_say_why" CHECK (
        "withdrawnAt" IS NULL OR length(trim(coalesce("withdrawnReason",''))) > 0
    )
);

CREATE TABLE "defect_classifications" (
    "id"                           TEXT NOT NULL,
    "workspaceId"                  TEXT NOT NULL,
    "defectId"                     TEXT NOT NULL,
    "outcome"                      TEXT NOT NULL,
    -- FR-DFR-077. NOT NULL and CHECKed against the outcome below.
    "destination"                  TEXT NOT NULL,
    "approvedBehaviourRef"         TEXT,
    "absenceRecorded"              BOOLEAN NOT NULL DEFAULT false,
    "classifiedBy"                 TEXT NOT NULL,
    "classifiedByKind"             TEXT NOT NULL,
    "proposedByAgent"              BOOLEAN NOT NULL DEFAULT false,
    "supersededByClassificationId" TEXT,
    "reclassifiedAt"               TIMESTAMP(3),
    "rationale"                    TEXT NOT NULL,
    "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_classifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defect_classifications_outcome_is_known" CHECK (
        "outcome" IN ('confirmed-defect','change-request','requirement-gap')
    ),
    -- ── The first of the two the task names ──────────────────────────────────
    -- FR-DFR-077: a Classification cannot exist without the destination its
    -- outcome maps to. Not merely NOT NULL: the destination must be THE one the
    -- outcome maps to, or a caller could route a requirement gap to the Change
    -- Room and the row would look well-formed.
    CONSTRAINT "defect_classifications_destination_matches_outcome" CHECK (
        ("outcome" = 'confirmed-defect' AND "destination" = 'repair') OR
        ("outcome" = 'change-request'   AND "destination" = 'change-room') OR
        ("outcome" = 'requirement-gap'  AND "destination" = 'requirement-room')
    ),
    -- FR-DFR-023, the belt beside EPIC-031's braces: an agent may propose a
    -- classification; it may not confirm a defect.
    CONSTRAINT "defect_classifications_confirmed_by_a_human" CHECK (
        "outcome" <> 'confirmed-defect' OR "classifiedByKind" = 'human'
    ),
    -- FR-DFR-021: judged against approved behaviour, or the absence recorded.
    -- A requirement gap is the one outcome that may have no behaviour to cite —
    -- and it must say so rather than leaving the column blank.
    CONSTRAINT "defect_classifications_absence_is_recorded" CHECK (
        "approvedBehaviourRef" IS NOT NULL
        OR ("outcome" = 'requirement-gap' AND "absenceRecorded" = true)
    ),
    CONSTRAINT "defect_classifications_state_their_rationale" CHECK (
        length(trim("rationale")) > 0
    )
);

CREATE TABLE "defect_reproductions" (
    "id"                   TEXT NOT NULL,
    "workspaceId"          TEXT NOT NULL,
    "defectId"             TEXT NOT NULL,
    "reproducible"         TEXT NOT NULL,
    "environment"          TEXT NOT NULL,
    "steps"                TEXT NOT NULL,
    -- FR-DFR-032: references into EPIC-032. No payload is stored here, so a
    -- reproduction HAR carrying a session token stays under the access rules of
    -- the artifact it concerns rather than this Room's (BR-0062).
    "evidenceRefs"         JSONB NOT NULL DEFAULT '[]'::jsonb,
    "notAutomatableReason" TEXT,
    "affectedBehaviour"    TEXT NOT NULL,
    "observedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_reproductions_pkey" PRIMARY KEY ("id"),
    -- FR-DFR-031: intermittent is a member of the vocabulary, never a boolean
    -- flag beside one. The four-state/three-meaning shape is where an
    -- intermittent defect lands after a single passing run.
    CONSTRAINT "defect_reproductions_reproducible_is_known" CHECK (
        "reproducible" IN ('always','intermittent','not-reproduced','not-automatable')
    ),
    -- FR-DFR-043: the exception must be visible and ENUMERABLE, which means
    -- countable, which means it cannot be blank.
    CONSTRAINT "defect_reproductions_exceptions_say_why" CHECK (
        "reproducible" <> 'not-automatable'
        OR length(trim(coalesce("notAutomatableReason",''))) > 0
    )
);

CREATE TABLE "defect_tests" (
    "id"                     TEXT NOT NULL,
    "workspaceId"            TEXT NOT NULL,
    "defectId"               TEXT NOT NULL,
    "testRef"                TEXT NOT NULL,
    -- FR-DFR-042: linked to the behaviour it contests, not only to the defect.
    "contestedBehaviourRef"  TEXT NOT NULL,
    -- FR-DFR-040: NOT NULL. A nullable column here would let a test that never
    -- failed satisfy a naive "does a test exist?" check, and the NULL would
    -- read as "not recorded yet" rather than "this never happened".
    "firstObservedFailingAt" TIMESTAMP(3) NOT NULL,
    "lastRunOutcome"         TEXT NOT NULL DEFAULT 'not-run',
    "lastRunEvidenceRef"     TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_tests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defect_tests_last_run_is_known" CHECK (
        "lastRunOutcome" IN ('fail','pass','not-run')
    )
);

CREATE TABLE "defect_evidence_checks" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "defectId"     TEXT NOT NULL,
    "defectTestId" TEXT NOT NULL,
    "path"         TEXT NOT NULL,
    "resolvedBy"   TEXT NOT NULL,
    "resolvedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rationale"    TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_evidence_checks_pkey" PRIMARY KEY ("id"),
    -- R-035-6, FR-DFR-044: three paths, required, no default. A path taken by
    -- omission is a decision nobody made — and the omission always resolves
    -- towards the one that closes work.
    CONSTRAINT "defect_evidence_checks_path_is_one_of_three" CHECK (
        "path" IN ('refine-test','investigate','reclassify')
    ),
    CONSTRAINT "defect_evidence_checks_state_their_rationale" CHECK (
        length(trim("rationale")) > 0
    )
);

CREATE TABLE "defect_repair_links" (
    "id"                         TEXT NOT NULL,
    "workspaceId"                TEXT NOT NULL,
    "defectId"                   TEXT NOT NULL,
    "defectTestId"               TEXT NOT NULL,
    -- R-035-3: EPIC-012's TaskRecord is NOT modified. The link lives here, so
    -- this Epic adds provenance without editing a table it does not own.
    "taskId"                     TEXT NOT NULL,
    "orphanedByClassificationId" TEXT,
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_repair_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "defect_routings" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "defectId"            TEXT NOT NULL,
    "classificationId"    TEXT NOT NULL,
    "destination"         TEXT NOT NULL,
    -- FR-DFR-072, UX-0034. "An unexplained transfer button is a
    -- reclassification nobody decided."
    "offeredReason"       TEXT NOT NULL,
    "state"               TEXT NOT NULL DEFAULT 'offered',
    "declinedAt"          TIMESTAMP(3),
    "declinedReason"      TEXT,
    -- FR-DFR-074: an item the destination refuses returns carrying the refusal,
    -- so the defect does not sit saying somebody else has it while nobody does.
    "refusalDetail"       TEXT,
    -- FR-DFR-071, FR-DFR-076: references, never copies. A copied attestation is
    -- a second artifact with the same digest and a different id.
    "carriedEvidenceRefs" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "targetRef"           TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_routings_pkey" PRIMARY KEY ("id"),
    -- 'repair' needs no routing row: it stays here. A row saying `repair` would
    -- be recording a transfer that never happened.
    CONSTRAINT "defect_routings_destination_leaves_this_room" CHECK (
        "destination" IN ('change-room','requirement-room')
    ),
    CONSTRAINT "defect_routings_state_is_known" CHECK (
        "state" IN ('offered','declined','accepted','refused','returned')
    ),
    -- FR-DFR-073: the offer AND the decline are both retained.
    CONSTRAINT "defect_routings_declines_say_why" CHECK (
        "state" <> 'declined'
        OR ("declinedAt" IS NOT NULL AND length(trim(coalesce("declinedReason",''))) > 0)
    ),
    -- FR-DFR-074: a refusal that carried no detail would tell the Defect Room
    -- only that something went wrong somewhere else.
    CONSTRAINT "defect_routings_refusals_carry_detail" CHECK (
        "state" <> 'refused' OR length(trim(coalesce("refusalDetail",''))) > 0
    ),
    -- SC-DFR-010: an item is recorded as ACCEPTED only when the destination
    -- gave back a reference. Accepted with no target is the state where this
    -- Room believes somebody else has it and nobody does.
    CONSTRAINT "defect_routings_accepted_have_a_target" CHECK (
        "state" <> 'accepted' OR "targetRef" IS NOT NULL
    )
);

CREATE TABLE "defect_escape_records" (
    "id"                       TEXT NOT NULL,
    "workspaceId"              TEXT NOT NULL,
    "defectId"                 TEXT NOT NULL,
    "origin"                   TEXT NOT NULL,
    -- Nullable — but the ROW is not. FR-DFR-082: written at intake, because a
    -- field that only exists at closure loses the first quarter of data.
    "escapePoint"              TEXT,
    "severity"                 TEXT NOT NULL,
    "affectedRequirementRef"   TEXT,
    "affectedSpecificationRef" TEXT,
    "resolutionEvidenceRef"    TEXT,
    -- `capturedAt` is the DOMAIN fact: when the escape data was taken, which
    -- FR-DFR-082 puts at intake. `createdAt` is the row's own, required of
    -- every table by FR-002. They coincide today and are different claims — a
    -- backfilled escape record would have a `createdAt` long after its
    -- `capturedAt`, and the analysis needs the second one.
    "capturedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "defect_escape_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defect_escape_records_escape_point_is_known" CHECK (
        "escapePoint" IS NULL OR "escapePoint" IN (
            'requirements','specification','design','implementation',
            'review','test','release','production'
        )
    )
);

-- ── The second of the two the task names ─────────────────────────────────────
-- FR-DFR-041: a fix cannot be accepted for an automatable defect with no
-- failing test on record.
--
-- Expressed as a trigger rather than a CHECK because it spans three tables —
-- the defect's state, its reproduction's automatability, and whether a
-- DefectTest exists. A CHECK cannot see beyond its own row, and putting this in
-- the service alone would leave it holding only where somebody remembered to
-- call it, which is the check most worth skipping on a Friday.
CREATE OR REPLACE FUNCTION defect_room_fix_needs_a_failing_test()
RETURNS TRIGGER AS $$
DECLARE
  automatable BOOLEAN;
  has_failing_test BOOLEAN;
BEGIN
  IF NEW."state" NOT IN ('verifying','closed') THEN
    RETURN NEW;
  END IF;

  -- Not automatable is a stated exception (FR-DFR-043), and it is enumerable
  -- because the reason column cannot be blank. Absence of any reproduction is
  -- treated as automatable: assuming the exception would grant it by default.
  SELECT NOT EXISTS (
    SELECT 1 FROM "defect_reproductions" r
    WHERE r."defectId" = NEW."id" AND r."reproducible" = 'not-automatable'
  ) INTO automatable;

  SELECT EXISTS (
    SELECT 1 FROM "defect_tests" t WHERE t."defectId" = NEW."id"
  ) INTO has_failing_test;

  IF automatable AND NOT has_failing_test THEN
    RAISE EXCEPTION
      'defect_records_fix_needs_a_failing_test: defect % has no failing test on record and is not recorded as not-automatable (FR-DFR-041)',
      NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "defect_records_fix_needs_a_failing_test"
    BEFORE INSERT OR UPDATE ON "defect_records"
    FOR EACH ROW EXECUTE FUNCTION defect_room_fix_needs_a_failing_test();

CREATE INDEX "defect_records_workspaceId_idx" ON "defect_records"("workspaceId");
CREATE INDEX "defect_records_projectId_idx" ON "defect_records"("projectId");
CREATE INDEX "defect_classifications_workspaceId_idx" ON "defect_classifications"("workspaceId");
CREATE INDEX "defect_classifications_defectId_idx" ON "defect_classifications"("defectId");
CREATE INDEX "defect_reproductions_workspaceId_idx" ON "defect_reproductions"("workspaceId");
CREATE INDEX "defect_reproductions_defectId_idx" ON "defect_reproductions"("defectId");
CREATE INDEX "defect_tests_workspaceId_idx" ON "defect_tests"("workspaceId");
CREATE INDEX "defect_tests_defectId_idx" ON "defect_tests"("defectId");
CREATE INDEX "defect_evidence_checks_workspaceId_idx" ON "defect_evidence_checks"("workspaceId");
CREATE INDEX "defect_evidence_checks_defectId_idx" ON "defect_evidence_checks"("defectId");
CREATE INDEX "defect_repair_links_workspaceId_idx" ON "defect_repair_links"("workspaceId");
CREATE INDEX "defect_repair_links_defectId_idx" ON "defect_repair_links"("defectId");
CREATE INDEX "defect_routings_workspaceId_idx" ON "defect_routings"("workspaceId");
CREATE INDEX "defect_routings_defectId_idx" ON "defect_routings"("defectId");
CREATE UNIQUE INDEX "defect_escape_records_defectId_key" ON "defect_escape_records"("defectId");
CREATE INDEX "defect_escape_records_workspaceId_idx" ON "defect_escape_records"("workspaceId");

ALTER TABLE "defect_classifications" ADD CONSTRAINT "defect_classifications_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_reproductions" ADD CONSTRAINT "defect_reproductions_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_tests" ADD CONSTRAINT "defect_tests_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_evidence_checks" ADD CONSTRAINT "defect_evidence_checks_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_evidence_checks" ADD CONSTRAINT "defect_evidence_checks_defectTestId_fkey"
    FOREIGN KEY ("defectTestId") REFERENCES "defect_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_repair_links" ADD CONSTRAINT "defect_repair_links_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_repair_links" ADD CONSTRAINT "defect_repair_links_defectTestId_fkey"
    FOREIGN KEY ("defectTestId") REFERENCES "defect_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_routings" ADD CONSTRAINT "defect_routings_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defect_escape_records" ADD CONSTRAINT "defect_escape_records_defectId_fkey"
    FOREIGN KEY ("defectId") REFERENCES "defect_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
