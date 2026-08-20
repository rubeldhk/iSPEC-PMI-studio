-- T845 (EPIC-008) — a succeeded generation job points at what it produced.
--
-- Raised as finding F4 by `/speckit-converge EPIC-008`. The job body in
-- `specs/_shared/contracts/platform-api.md` declares `resultRef`, and Quickstart
-- V4 step 4 — "open the resulting specification" — depends on it. The column
-- existed in no schema: not schema.prisma, not specs/_shared/schema.sql, not
-- data-model.md. A field the contract promises and the database cannot hold is
-- null on every path, including the composed one.
--
-- Nullable, and deliberately so. It is null while the job is queued or running,
-- and null FOREVER on a job that failed, was cancelled, or timed out — those
-- leave no artifact at all (FR-027, SC-006), so there is nothing to point at.
-- A NOT NULL column would force a placeholder, which is the same mistake
-- `engine_stamp.ts` refuses to make for FR-022.

ALTER TABLE "generation_jobs" ADD COLUMN "resultRef" TEXT;

-- No foreign key to "specifications", on purpose.
--
-- `resultRef` is a POLYMORPHIC reference: `job_kind` already has three members,
-- and `generate_tasks` (EPIC-012) and `validate_specification` (EPIC-015) will
-- point it at rows in other tables. A foreign key to one of them would be
-- correct for a third of the jobs and wrong for the rest.
--
-- The integrity that matters is guaranteed where it can be: the specification
-- and this column are written in the SAME transaction (see
-- PrismaSpecificationStore.commitGeneration), so a job cannot reference an
-- artifact that was rolled back.
