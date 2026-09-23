-- `T998f` (EPIC-035) — the version a re-evaluation was judged against.
--
-- `FR-DFR-024`: a defect reported against a superseded version is *recorded
-- against the version reported* and *re-evaluated against current*, never
-- silently re-targeted.
--
-- The reported version lives on `defect_records.contestedArtifactVersion` and
-- nothing rewrites it. The version a **re-evaluation** was made against is a
-- different fact, and until this column it had nowhere to live: a reader of the
-- history could see two classifications and not tell whether the second was
-- about v7 or v9. That is the silent re-target arriving by a slower route — the
-- record reads as "current", and "current" moves.
--
-- ## Why nullable, and what NULL means
--
-- **NULL = the version reported on the defect.** The first classification
-- writes NULL rather than a copy, because a copy would be a second place the
-- same answer lives and the two would disagree the first time one was written
-- alone. A non-null value means: this classification deliberately judged a
-- version other than the reported one.
--
-- A separate migration rather than an edit to `20260831000000`, which is
-- committed: amending an applied migration is how one developer's database
-- stops matching everybody else's.
ALTER TABLE "defect_classifications" ADD COLUMN "evaluatedAgainstVersion" TEXT;

-- A version that is present must be a version. An empty string here would read
-- as "some other version, unspecified" — worse than NULL, which at least says
-- exactly which version it means.
ALTER TABLE "defect_classifications"
  ADD CONSTRAINT "defect_classifications_reevaluation_names_its_version" CHECK (
    "evaluatedAgainstVersion" IS NULL OR length(trim("evaluatedAgainstVersion")) > 0
  );

-- `FR-DFR-025`, `ADR-0016` — the two halves of a supersession move together.
--
-- A row pointing at its successor with no `reclassifiedAt` cannot say when it
-- stopped standing; a `reclassifiedAt` with no successor claims the row was
-- replaced by nothing. Both are half-written history, which is the failure the
-- never-delete rule exists to prevent — an update that loses the record is not
-- improved by being partial.
ALTER TABLE "defect_classifications"
  ADD CONSTRAINT "defect_classifications_supersession_says_when" CHECK (
    ("supersededByClassificationId" IS NULL) = ("reclassifiedAt" IS NULL)
  );
