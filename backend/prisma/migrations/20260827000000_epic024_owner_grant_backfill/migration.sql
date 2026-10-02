-- T1131 (EPIC-024, C2E) — give existing specifications the owner grant that
-- deny-by-default now requires, WITHOUT inventing an owner.
--
-- `X19` inverted the zero-grant rule: an artifact with no grants is refused
-- rather than open. Every specification created before C2E has no grants, so
-- without this they all become unreachable at once.
--
-- The only authoritative owner available is `specifications.createdById`. It is
-- used **only** where it resolves to a real user in the SAME workspace. Where it
-- does not, nothing is invented: the artifact stays inaccessible and is recorded
-- below for governed remediation. A blanket administrator grant would make every
-- one of them reachable by somebody nobody chose, which is the defect wearing a
-- migration's clothes.

-- ---------------------------------------------------------------------------
-- 1. The evidence table. Written before the backfill so the "before" counts
--    are recorded even if the insert below matches nothing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ownership_backfill_records" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "artifactType"    TEXT NOT NULL,
    "artifactId"      TEXT NOT NULL,
    "outcome"         TEXT NOT NULL,
    "reason"          TEXT NOT NULL,
    "resolvedOwnerId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_backfill_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ownership_backfill_outcome_vocabulary" CHECK (
        "outcome" IN ('granted', 'unresolved')
    ),
    CONSTRAINT "ownership_backfill_resolved_has_owner" CHECK (
        ("outcome" = 'granted') = ("resolvedOwnerId" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "ownership_backfill_records_artifact_key"
    ON "ownership_backfill_records"("workspaceId", "artifactType", "artifactId");

-- ---------------------------------------------------------------------------
-- 2. Record what will happen, for both outcomes.
--
--    `ON CONFLICT DO NOTHING` against the unique index is what makes the whole
--    migration idempotent: re-running records nothing new and grants nothing new.
-- ---------------------------------------------------------------------------
INSERT INTO "ownership_backfill_records"
    ("id","workspaceId","artifactType","artifactId","outcome","reason","resolvedOwnerId")
SELECT
    gen_random_uuid()::text,
    s."workspaceId",
    'specification',
    s."id",
    CASE WHEN u."id" IS NULL THEN 'unresolved' ELSE 'granted' END,
    CASE
        WHEN u."id" IS NULL THEN
            'createdById does not resolve to a user in this workspace; no owner was invented'
        ELSE 'owner resolved from specifications.createdById'
    END,
    u."id"
FROM "specifications" s
LEFT JOIN "users" u
       ON u."id" = s."createdById"
      AND u."workspaceId" = s."workspaceId"
WHERE NOT EXISTS (
    SELECT 1 FROM "access_grants" g
     WHERE g."artifactType" = 'specification'
       AND g."artifactId"   = s."id"
       AND g."revokedAt"    IS NULL
)
ON CONFLICT ("workspaceId","artifactType","artifactId") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Grant, only where the owner resolved unambiguously.
-- ---------------------------------------------------------------------------
INSERT INTO "access_grants"
    ("id","workspaceId","artifactType","artifactId","userId","level","grantedById","grantedAt")
SELECT
    gen_random_uuid()::text,
    r."workspaceId",
    'specification',
    r."artifactId",
    r."resolvedOwnerId",
    'edit',
    r."resolvedOwnerId",
    now()
FROM "ownership_backfill_records" r
WHERE r."outcome" = 'granted'
  AND r."artifactType" = 'specification'
  AND NOT EXISTS (
    SELECT 1 FROM "access_grants" g
     WHERE g."artifactType" = 'specification'
       AND g."artifactId"   = r."artifactId"
       AND g."revokedAt"    IS NULL
  );

-- ---------------------------------------------------------------------------
-- 4. Counts, in the migration output. The unresolved ones are the operational
--    finding: they remain inaccessible until a human owner is decided.
-- ---------------------------------------------------------------------------
DO $$
DECLARE granted_count INT; unresolved_count INT;
BEGIN
    SELECT count(*) INTO granted_count
      FROM "ownership_backfill_records" WHERE "outcome" = 'granted';
    SELECT count(*) INTO unresolved_count
      FROM "ownership_backfill_records" WHERE "outcome" = 'unresolved';
    RAISE NOTICE 'C2E owner-grant backfill: % granted, % unresolved and still inaccessible',
        granted_count, unresolved_count;
END $$;
