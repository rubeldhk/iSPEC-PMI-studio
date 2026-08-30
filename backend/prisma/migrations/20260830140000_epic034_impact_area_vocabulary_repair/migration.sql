-- DEF-034-001 (EPIC-034, T996k) — repair: the eighth impact area is operational
-- effects, not security.
--
-- `BR-0044` and `FR-CHR-030` name eight classes: requirements, specifications,
-- architecture, tasks, code, tests, release scope and known operational
-- effects. `20260830120000_epic034_change_room` enumerated `security` in this
-- constraint instead, matching a constant that had the same error.
--
-- `security` IS correct in `TRADEOFF_DIMENSIONS` (`FR-CHR-041`), which is the
-- likeliest origin: two lists written in one sitting. It is not an impact
-- class, and an impact class that is absent from the vocabulary cannot even be
-- reported `unknown` -- it is invisible, which is what the eight-area type
-- exists to prevent.
--
-- Recreated rather than edited in place, following
-- `20260827150000_epic030_refusal_vocabulary_repair`. No rows are rewritten:
-- `change_impact_areas` is empty until `T996q` writes the first view, and the
-- constraint is the only thing that has to change.
ALTER TABLE "change_impact_areas"
    DROP CONSTRAINT "change_impact_areas_area_is_known";

ALTER TABLE "change_impact_areas"
    ADD CONSTRAINT "change_impact_areas_area_is_known" CHECK (
        "area" IN (
            'requirements',
            'specifications',
            'architecture',
            'tasks',
            'code',
            'tests',
            'release',
            'operations'
        )
    );
