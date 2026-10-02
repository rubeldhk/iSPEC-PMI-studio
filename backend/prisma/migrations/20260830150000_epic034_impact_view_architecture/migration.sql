-- T996q (EPIC-034) — the architecture panel, persisted with the view.
--
-- `FR-CHR-033` surfaces the governed decisions a change reaches; `FR-CHR-034`
-- requires the view to state that `BR-0073`'s violation check has NOT run.
-- `FR-CHR-035` retains the view so a decision can later be read against what
-- was known at the time -- which means the caveat has to be stored, not
-- re-derived. Re-deriving would rewrite every historical view the day someone
-- implements `BR-0073`, turning "nobody looked" into "it passed" retroactively,
-- which is the exact claim `FR-CHR-034` exists to forbid.
--
-- `violationCheckStatus` is CHECKed to a single value, mirroring the TypeScript
-- literal type that has one inhabitant. Whoever implements `BR-0073` widens
-- both, deliberately and together.
--
-- Added NOT NULL without a default: `change_impact_views` is empty -- `T996q`
-- writes the first row -- and a default here would be a sentence nobody wrote
-- appearing on views nobody computed.
ALTER TABLE "change_impact_views"
    ADD COLUMN "architectureDecisions"  JSONB,
    ADD COLUMN "architectureDetail"     TEXT NOT NULL,
    ADD COLUMN "violationCheckStatus"   TEXT NOT NULL,
    ADD COLUMN "violationCheckBecause"  TEXT NOT NULL;

-- NULL means nobody could tell; an empty array means the register was read and
-- none were reached. The two must stay distinguishable, so the column is
-- nullable and the empty case is a real JSON array.
COMMENT ON COLUMN "change_impact_views"."architectureDecisions" IS
    'NULL = undeterminable; [] = read, none reached (FR-CHR-033)';

ALTER TABLE "change_impact_views"
    ADD CONSTRAINT "change_impact_views_violation_check_has_not_run" CHECK (
        "violationCheckStatus" = 'not-run'
    );
