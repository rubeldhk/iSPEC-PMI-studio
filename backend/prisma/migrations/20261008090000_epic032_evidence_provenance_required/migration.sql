-- EPIC-032 T1800 — SC-EVS-002: "a missing field fails a check rather than
-- reading as blank."
--
-- The 20261007 migration required a subject digest, integrity metadata and an
-- attachment on every attestation, and left `projectId` and `subjectName`
-- unchecked — so a row could lose them and the mapper read the gap as '' or
-- '_'. These close the remaining two.
--
-- NOT VALID, like the others: binding on every row written from now on, and not
-- re-judging the T1203 slice's rows, which predate the attestation columns.
-- Scoped to attestations (subjectDigest present) so the slice's own shape, which
-- has neither column, is still insertable.

ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_project_required"
    CHECK ("subjectDigest" IS NULL OR "projectId" IS NOT NULL) NOT VALID;

-- in-toto permits a subject with no meaningful name and spells that '_'. An
-- empty or absent name is not that spelling; it is a missing field.
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_subject_name_required"
    CHECK ("subjectDigest" IS NULL OR length(coalesce("subjectName", '')) > 0) NOT VALID;
