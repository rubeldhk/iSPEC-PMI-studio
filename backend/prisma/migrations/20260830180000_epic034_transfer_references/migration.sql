-- T994y (EPIC-034) — FR-CHR-012, R-034-6: what a transfer brought, by reference.
--
-- Ids into EPIC-032's evidence store and EPIC-035's defect record, never copies.
-- A copied attestation is a second artifact with the same digest and a
-- different id, which is the provenance ambiguity FR-EVS-013 exists to prevent:
-- two rows attesting one fact, and no way to tell which one an auditor saw.
--
-- DEFAULT '[]' rather than NULL: empty says nobody attached any, and a NULL
-- would leave a reader unable to tell that from a transfer that lost them. A
-- direct change carries two empty arrays, which is true of it.
ALTER TABLE "change_requests"
    ADD COLUMN "transferredEvidenceRefs" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "transferredContextRefs"  JSONB NOT NULL DEFAULT '[]'::jsonb;

-- A direct change has nothing transferred. Anything in these columns on a
-- direct change means a transfer was recorded without its origin.
ALTER TABLE "change_requests"
    ADD CONSTRAINT "change_requests_only_transfers_carry_references" CHECK (
        "origin" = 'defect-transfer'
        OR (jsonb_array_length("transferredEvidenceRefs") = 0
            AND jsonb_array_length("transferredContextRefs") = 0)
    );
