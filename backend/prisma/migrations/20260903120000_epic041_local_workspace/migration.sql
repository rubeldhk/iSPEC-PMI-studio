-- `T1319` (EPIC-041) — Local Project Workspace. Additive only.
--
-- data-model.md §1–§6. Hand-written because four things here cannot be said in
-- Prisma Schema Language: CHECK constraints, an append-only trigger, a
-- back-filled NOT NULL, and widening a vocabulary constraint.
--
-- ## The structural idea, stated once
--
-- **A directory is a fact the database records, never a fact the database
-- owns.** Nothing below holds a byte of what is IN a project directory. The one
-- apparent exception — the connector credential — is stored as a digest so that
-- the only place the value ever exists is the user's environment.

-- ─────────────────────────────────────────────────────────────────────────────
-- §1 · projects gain a workspace on disk

-- `prepared` and `initialisation_pending` are DIFFERENT facts: one says "wait
-- for the worker", the other says "run the setup skill". A single "pending"
-- would send the user to the skill while the worker was still working.
CREATE TYPE "ProvisioningState" AS ENUM (
    'not_provisioned',
    'prepared',
    'initialisation_pending',
    'provisioned',
    'failed'
);

ALTER TABLE "projects"
    -- The directory AS THE USER'S MACHINE SEES IT (R-041-2). The API writes
    -- under PMI_PROJECTS_ROOT; this column stores PMI_PROJECTS_ROOT_HOST/<name>.
    ADD COLUMN "rootPath"          TEXT,
    ADD COLUMN "agentIntegration"  TEXT,
    ADD COLUMN "scriptType"        TEXT,
    ADD COLUMN "provisioningState" "ProvisioningState" NOT NULL DEFAULT 'not_provisioned',
    ADD COLUMN "provisionedAt"     TIMESTAMP(3);

-- One directory, one project. A second project claiming a path would silently
-- overwrite the first's files (FR-LPW-007).
CREATE UNIQUE INDEX "projects_workspaceId_rootPath_key" ON "projects"("workspaceId", "rootPath");

-- ─────────────────────────────────────────────────────────────────────────────
-- §2 · provisioning records — append-only, and a failure names its step

CREATE TABLE "provisioning_records" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "actorId"        TEXT NOT NULL,
    "correlationId"  TEXT NOT NULL,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"        TIMESTAMP(3),
    "outcome"        TEXT NOT NULL,
    "stepsCompleted" JSONB NOT NULL,
    "failedStep"     TEXT,
    "failureReason"  TEXT,
    "specKitTag"     TEXT,
    "bundleVersion"  TEXT,
    "filesWritten"   JSONB NOT NULL,

    CONSTRAINT "provisioning_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provisioning_records_outcome_vocabulary" CHECK (
        "outcome" IN ('succeeded', 'no_change', 'pending', 'failed')
    ),
    -- "it failed" with no step is the message that sends a user to the wrong
    -- place (US1 scenario 5).
    CONSTRAINT "provisioning_records_failed_step_named" CHECK (
        "outcome" <> 'failed' OR "failedStep" IS NOT NULL
    )
);

CREATE INDEX "provisioning_records_project_started_idx" ON "provisioning_records"("projectId", "startedAt");
CREATE INDEX "provisioning_records_workspace_idx" ON "provisioning_records"("workspaceId");

ALTER TABLE "provisioning_records"
    ADD CONSTRAINT "provisioning_records_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provisioning_records"
    ADD CONSTRAINT "provisioning_records_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, enforced by PostgreSQL. reject_mutation() is the SHARED function
-- the init migration defined for audit_entries; it is attached, never redefined.
CREATE TRIGGER provisioning_records_immutable
    BEFORE UPDATE OR DELETE ON "provisioning_records"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- §3 · connector credentials — a digest, a prefix, never a value, never an expiry

CREATE TABLE "connector_credentials" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    -- The first characters after `pmi_ct_`: the lookup key (R-041-3).
    "tokenPrefix" TEXT NOT NULL,
    -- sha256(token), hex. THE VALUE IS NEVER STORED (FR-LPW-021).
    "tokenHash"   TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"  TIMESTAMP(3),
    -- The ONLY thing that ends a credential (FR-LPW-023, FR-LPW-028). There is
    -- deliberately no expiresAt: expiry is a tenant policy for a later Epic.
    "revokedAt"   TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connector_credentials_prefix_idx" ON "connector_credentials"("tokenPrefix");
CREATE INDEX "connector_credentials_project_idx" ON "connector_credentials"("projectId");
CREATE INDEX "connector_credentials_workspace_idx" ON "connector_credentials"("workspaceId");

ALTER TABLE "connector_credentials"
    ADD CONSTRAINT "connector_credentials_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connector_credentials"
    ADD CONSTRAINT "connector_credentials_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connector_credentials"
    ADD CONSTRAINT "connector_credentials_principalId_fkey"
    FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- §4 · principals admit `connector` (R-041-3). `human` stays absent — D-46.

ALTER TABLE "principals" DROP CONSTRAINT "principals_kind_vocabulary";
ALTER TABLE "principals"
    ADD CONSTRAINT "principals_kind_vocabulary" CHECK ("kind" IN ('agent', 'service', 'connector'));

-- ─────────────────────────────────────────────────────────────────────────────
-- §5 · every execution carries an assurance (FR-LPW-034, R-041-5)

ALTER TABLE "executions" ADD COLUMN "assurance" TEXT;

-- Back-fill by surface, from the same table assuranceFor() implements. Every
-- existing row came from the managed sandbox or the fixture, so no row is
-- ambiguous.
UPDATE "executions"
   SET "assurance" = CASE WHEN "surface" IN ('managed-sandbox', 'ci-cd') THEN 'managed' ELSE 'local' END
 WHERE "assurance" IS NULL;

ALTER TABLE "executions" ALTER COLUMN "assurance" SET NOT NULL;
ALTER TABLE "executions"
    ADD CONSTRAINT "executions_assurance_vocabulary" CHECK ("assurance" IN ('managed', 'local'));

-- ─────────────────────────────────────────────────────────────────────────────
-- §6 · the worker has a job kind to claim (R-041-1)

ALTER TYPE "JobKind" ADD VALUE IF NOT EXISTS 'initialise_workspace';
