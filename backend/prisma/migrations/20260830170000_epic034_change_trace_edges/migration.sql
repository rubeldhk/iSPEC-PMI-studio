-- T994n (EPIC-034) — FR-CHR-064: work arising from a change traces to it.
--
-- "Specification, task and test changes arising from an approved change MUST be
-- traceable to that change." The trace goes through EPIC-011's link table, not
-- a second store of this Room's own: two answers to one question is how nobody
-- knows which is the trace.
--
-- `change` is added as an artifact TYPE but deliberately NOT as a CHAIN STAGE.
-- CHAIN_STAGES is the ordered derivation chain vision→…→operation, and
-- `chain-gap.service.ts` indexes into it to decide what is up-chain of what. A
-- change request is not a stage of derivation; it is the reason a derivation
-- changed. Putting it in the chain would give the gap report an ordering
-- question with no correct answer.
--
-- The three new edges all point FROM the artifact TO the change, matching the
-- existing convention that an edge points at what its source came from.
--
-- Enum widened by the rename dance rather than `ALTER TYPE ... ADD VALUE`,
-- following `20260820230000_epic022_chain_structure`: a value added in a
-- transaction cannot be referenced by the CHECK constraint in that same
-- transaction, and this migration needs both.
ALTER TABLE "traceability_links" DROP CONSTRAINT "trace_permitted_edges";

CREATE TYPE "TraceArtifactType_new" AS ENUM (
    'vision', 'goal', 'capability', 'requirement', 'specification', 'architecture',
    'plan', 'task', 'code', 'test', 'release', 'operation', 'change'
);
ALTER TABLE "traceability_links"
    ALTER COLUMN "sourceType" TYPE "TraceArtifactType_new"
    USING ("sourceType"::text::"TraceArtifactType_new");
ALTER TABLE "traceability_links"
    ALTER COLUMN "targetType" TYPE "TraceArtifactType_new"
    USING ("targetType"::text::"TraceArtifactType_new");
ALTER TYPE "TraceArtifactType" RENAME TO "TraceArtifactType_old";
ALTER TYPE "TraceArtifactType_new" RENAME TO "TraceArtifactType";
DROP TYPE "TraceArtifactType_old";

-- The twelve chain edges, unchanged, plus the three that answer FR-CHR-064.
ALTER TABLE "traceability_links"
    ADD CONSTRAINT "trace_permitted_edges" CHECK (
        ("sourceType" = 'specification' AND "targetType" = 'requirement') OR
        ("sourceType" = 'task'          AND "targetType" = 'specification') OR
        ("sourceType" = 'goal'          AND "targetType" = 'vision') OR
        ("sourceType" = 'capability'    AND "targetType" = 'goal') OR
        ("sourceType" = 'requirement'   AND "targetType" = 'capability') OR
        ("sourceType" = 'architecture'  AND "targetType" = 'specification') OR
        ("sourceType" = 'plan'          AND "targetType" = 'architecture') OR
        ("sourceType" = 'task'          AND "targetType" = 'plan') OR
        ("sourceType" = 'code'          AND "targetType" = 'task') OR
        ("sourceType" = 'test'          AND "targetType" = 'code') OR
        ("sourceType" = 'release'       AND "targetType" = 'test') OR
        ("sourceType" = 'operation'     AND "targetType" = 'release') OR
        -- FR-CHR-064. `change` is never a SOURCE: a change request does not
        -- derive from the work it caused, and an edge in that direction would
        -- put it in the chain by the back door.
        ("sourceType" = 'specification' AND "targetType" = 'change') OR
        ("sourceType" = 'task'          AND "targetType" = 'change') OR
        ("sourceType" = 'test'          AND "targetType" = 'change')
    );
