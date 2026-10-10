-- EPIC-039 T2125 — the Integration Hub (specs/039-integration-hub/data-model.md).
--
-- Ten tables. Four are APPEND-ONLY by attaching EPIC-004's shared
-- reject_mutation() (attached, never redefined, as its comment requires):
-- integration_health_checks, capability_resolutions, capability_invocations,
-- deployment_capability_bindings — plus notification_deliveries, immutable after
-- insert. capability_contract_versions is WRITE-ONCE once approved (only
-- status approved -> retired). integration_credentials holds ciphertext only.
--
-- Two tables are not tenant-scoped, on purpose: the capability vocabulary
-- (deployment vocabulary, the engine_registrations exception) and the
-- deployment Embed binding record (analysis I1: deployment configuration
-- recorded at boot; EmbeddingPort carries no workspace).
--
-- Every hand-written CHECK and trigger here is asserted by
-- backend/tests/integration/integrations-constraints.spec.ts, because Prisma's
-- migration planning treats them as extras a later migrate dev may drop.

-- §1 · capability_contract_versions — the vocabulary as the platform holds it (FR-HUB-003).
CREATE TABLE "capability_contract_versions" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "scope"           TEXT NOT NULL,
    "major"           INTEGER NOT NULL,
    "minor"           INTEGER NOT NULL,
    "status"          TEXT NOT NULL,
    -- The reviewed JSON file, verbatim; the columns below are derived from it.
    "document"        JSONB NOT NULL,
    "inputSchema"     JSONB NOT NULL,
    "outputSchema"    JSONB NOT NULL,
    "errorCategories" TEXT[] NOT NULL,
    "requiredScope"   JSONB NOT NULL,
    "changesState"    BOOLEAN NOT NULL,
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    -- FR-HUB-015 (analysis C1): a seeded row names the Git-tracked file it came
    -- from; that file's history is the record of who changed it and how.
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capability_contract_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "capability_contract_versions_scope_vocabulary" CHECK ("scope" IN ('project', 'deployment')),
    CONSTRAINT "capability_contract_versions_status_vocabulary" CHECK ("status" IN ('draft', 'approved', 'retired')),
    CONSTRAINT "capability_contract_versions_version_range" CHECK ("major" >= 1 AND "minor" >= 0)
);
CREATE UNIQUE INDEX "capability_contract_versions_name_major_minor_key" ON "capability_contract_versions"("name", "major", "minor");

-- FR-HUB-012: an approved version is immutable; a change is a new row. The one
-- permitted transition is status approved -> retired, every other column equal.
-- The gate_outcomes_write_once() kind (EPIC-021), not reject_mutation(), because
-- retirement is a legitimate update.
CREATE OR REPLACE FUNCTION capability_contract_versions_write_once() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status" IN ('approved', 'retired') THEN
            RAISE EXCEPTION 'capability_contract_versions: an approved contract version is immutable (FR-HUB-012)';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD."status" IN ('approved', 'retired') THEN
        IF OLD."status" = 'approved' AND NEW."status" = 'retired'
           AND NEW."name" = OLD."name" AND NEW."major" = OLD."major" AND NEW."minor" = OLD."minor"
           AND NEW."scope" = OLD."scope" AND NEW."document" = OLD."document"
           AND NEW."inputSchema" = OLD."inputSchema" AND NEW."outputSchema" = OLD."outputSchema"
           AND NEW."errorCategories" = OLD."errorCategories" AND NEW."requiredScope" = OLD."requiredScope"
           AND NEW."changesState" = OLD."changesState" AND NEW."createdBy" = OLD."createdBy" THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'capability_contract_versions: an approved contract version is immutable; only approved -> retired is permitted (FR-HUB-012)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "capability_contract_versions_immutable"
    BEFORE UPDATE OR DELETE ON "capability_contract_versions"
    FOR EACH ROW EXECUTE FUNCTION capability_contract_versions_write_once();

-- §2 · integration_registry_entries — one adapter (outbound) or connector (inbound), listed (FR-HUB-020).
CREATE TABLE "integration_registry_entries" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "direction"    TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'active',
    "listedOrder"  INTEGER NOT NULL,
    "registeredBy" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "retiredBy"    TEXT,
    "retiredAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_registry_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_registry_entries_direction_vocabulary" CHECK ("direction" IN ('outbound', 'inbound')),
    CONSTRAINT "integration_registry_entries_status_vocabulary" CHECK ("status" IN ('active', 'retired')),
    CONSTRAINT "integration_registry_entries_retired_shape" CHECK (("status" = 'retired') = ("retiredAt" IS NOT NULL)),
    CONSTRAINT "integration_registry_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "integration_registry_entries_workspaceId_key_key" ON "integration_registry_entries"("workspaceId", "key");
CREATE INDEX "integration_registry_entries_workspaceId_listedOrder_idx" ON "integration_registry_entries"("workspaceId", "listedOrder");

-- §3 · project_capability_configurations — which adapters a project uses for a capability (FR-HUB-031, FR-HUB-032).
CREATE TABLE "project_capability_configurations" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "projectId"             TEXT NOT NULL,
    "capability"            TEXT NOT NULL,
    "adapters"              JSONB NOT NULL DEFAULT '[]',
    "permitDegraded"        BOOLEAN NOT NULL DEFAULT false,
    "permittedEnvironments" TEXT[] NOT NULL DEFAULT ARRAY['local','dev','stage','prod']::TEXT[],
    "onNotNarrowable"       TEXT NOT NULL,
    "healthIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "providerBinding"       JSONB NOT NULL DEFAULT '{}',
    "configVersion"         INTEGER NOT NULL DEFAULT 1,
    "decisionId"            TEXT,
    "updatedBy"             TEXT NOT NULL,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_capability_configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_capability_configurations_onNotNarrowable_vocabulary" CHECK ("onNotNarrowable" IN ('refuse', 'proceed-and-record')),
    CONSTRAINT "project_capability_configurations_interval_range" CHECK ("healthIntervalSeconds" BETWEEN 60 AND 3600),
    CONSTRAINT "project_capability_configurations_configVersion_range" CHECK ("configVersion" >= 1),
    CONSTRAINT "project_capability_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_capability_configurations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_capability_configurations_projectId_capability_key" ON "project_capability_configurations"("projectId", "capability");
CREATE INDEX "project_capability_configurations_workspaceId_idx" ON "project_capability_configurations"("workspaceId");

-- §4 · integration_credentials — ciphertext only (FR-HUB-040–046, R-039-10).
-- projectId is REQUIRED: v1 has no deployment-scope credential (analysis I1).
CREATE TABLE "integration_credentials" (
    "id"              TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    "registryEntryId" TEXT NOT NULL,
    "kind"            TEXT NOT NULL,
    "ciphertext"      BYTEA NOT NULL,
    "iv"              BYTEA NOT NULL,
    "authTag"         BYTEA NOT NULL,
    "keyId"           TEXT NOT NULL,
    "setBy"           TEXT NOT NULL,
    "setAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_credentials_iv_length" CHECK (octet_length("iv") = 12),
    CONSTRAINT "integration_credentials_authTag_length" CHECK (octet_length("authTag") = 16),
    CONSTRAINT "integration_credentials_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "integration_credentials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "integration_credentials_registryEntryId_fkey" FOREIGN KEY ("registryEntryId") REFERENCES "integration_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "integration_credentials_workspaceId_projectId_registryEntryId_key" ON "integration_credentials"("workspaceId", "projectId", "registryEntryId");
CREATE INDEX "integration_credentials_workspaceId_idx" ON "integration_credentials"("workspaceId");

-- §5 · integration_health_checks — append-only; unknown is never written (FR-HUB-026, FR-HUB-027).
CREATE TABLE "integration_health_checks" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "projectId"         TEXT NOT NULL,
    "registryEntryId"   TEXT NOT NULL,
    "state"             TEXT NOT NULL,
    "reason"            TEXT,
    "detail"            TEXT,
    "retryAfterSeconds" INTEGER,
    "adapterVersion"    TEXT NOT NULL,
    -- What the probe established about the credential's breadth (R-039-9: a
    -- Resend key is narrowed at issue or not at all).
    "narrowing"         TEXT,
    "source"            TEXT NOT NULL,
    -- Analysis U2: the lease. Scheduled rows only.
    "intervalBucket"    BIGINT,
    "checkedAt"         TIMESTAMP(3) NOT NULL,
    "durationMs"        INTEGER NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_health_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_health_checks_state_vocabulary" CHECK ("state" IN ('healthy', 'degraded', 'unhealthy')),
    CONSTRAINT "integration_health_checks_reason_required" CHECK ("state" = 'healthy' OR "reason" IS NOT NULL),
    CONSTRAINT "integration_health_checks_source_vocabulary" CHECK ("source" IN ('scheduled', 'request', 'credential-set')),
    CONSTRAINT "integration_health_checks_bucket_shape" CHECK (("source" = 'scheduled') = ("intervalBucket" IS NOT NULL)),
    CONSTRAINT "integration_health_checks_narrowing_vocabulary" CHECK ("narrowing" IS NULL OR "narrowing" IN ('exact', 'narrowed-at-issue', 'not-narrowable')),
    CONSTRAINT "integration_health_checks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "integration_health_checks_registryEntryId_fkey" FOREIGN KEY ("registryEntryId") REFERENCES "integration_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "integration_health_checks_projectId_registryEntryId_checkedAt_idx" ON "integration_health_checks"("projectId", "registryEntryId", "checkedAt" DESC);
CREATE INDEX "integration_health_checks_workspaceId_idx" ON "integration_health_checks"("workspaceId");
-- Analysis U2 — at most one RECORDED scheduled check per pair per interval,
-- inserted after the check with ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX "integration_health_checks_scheduled_lease" ON "integration_health_checks"("projectId", "registryEntryId", "intervalBucket") WHERE "source" = 'scheduled';
CREATE TRIGGER "integration_health_checks_immutable"
    BEFORE UPDATE OR DELETE ON "integration_health_checks"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- §6 · capability_resolutions — one row per resolver decision, written BEFORE any provider call (FR-HUB-036, FR-HUB-037).
CREATE TABLE "capability_resolutions" (
    "id"               TEXT NOT NULL,
    -- Null only for a deployment-scope resolution (Embed): EmbeddingPort carries no workspace.
    "workspaceId"      TEXT,
    "scope"            TEXT NOT NULL,
    "projectId"        TEXT,
    "caller"           TEXT NOT NULL,
    "actorPrincipalId" TEXT NOT NULL,
    "executionId"      TEXT,
    "capability"       TEXT NOT NULL,
    "requestedMajor"   INTEGER NOT NULL,
    "contractVersion"  TEXT,
    "outcome"          TEXT NOT NULL,
    "refusalCode"      TEXT,
    "registryEntryId"  TEXT,
    "adapterKey"       TEXT,
    "adapterVersion"   TEXT,
    "provider"         TEXT,
    "modelIdentity"    JSONB,
    "scopeGranted"     JSONB,
    "reasons"          JSONB NOT NULL,
    "decidedAt"        TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capability_resolutions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "capability_resolutions_scope_vocabulary" CHECK ("scope" IN ('project', 'deployment')),
    CONSTRAINT "capability_resolutions_project_scope" CHECK ("scope" <> 'project' OR ("workspaceId" IS NOT NULL AND "projectId" IS NOT NULL)),
    CONSTRAINT "capability_resolutions_outcome_vocabulary" CHECK ("outcome" IN ('resolved', 'refused')),
    CONSTRAINT "capability_resolutions_refusal_shape" CHECK (("outcome" = 'refused') = ("refusalCode" IS NOT NULL)),
    CONSTRAINT "capability_resolutions_refusalCode_vocabulary" CHECK ("refusalCode" IS NULL OR "refusalCode" IN (
        'unknown-capability', 'provider-pinned', 'caller-not-platform', 'no-compatible-adapter', 'no-eligible-adapter',
        'ambiguous', 'scope-not-narrowable', 'policy-seam-unbound', 'credential-material-in-content',
        'invalid-input', 'batch-too-large', 'text-too-long')),
    CONSTRAINT "capability_resolutions_resolved_shape" CHECK ("outcome" <> 'resolved' OR ("adapterKey" IS NOT NULL AND "contractVersion" IS NOT NULL))
);
CREATE INDEX "capability_resolutions_projectId_decidedAt_idx" ON "capability_resolutions"("projectId", "decidedAt" DESC);
CREATE INDEX "capability_resolutions_registryEntryId_decidedAt_idx" ON "capability_resolutions"("registryEntryId", "decidedAt" DESC);
CREATE INDEX "capability_resolutions_workspaceId_idx" ON "capability_resolutions"("workspaceId");
CREATE TRIGGER "capability_resolutions_immutable"
    BEFORE UPDATE OR DELETE ON "capability_resolutions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- §6a · capability_invocations — at most one per resolved resolution (FR-HUB-039).
-- A resolution with no invocation reads as OUTCOME UNKNOWN, never success.
CREATE TABLE "capability_invocations" (
    "resolutionId"      TEXT NOT NULL,
    "workspaceId"       TEXT,
    "projectId"         TEXT,
    "outcome"           TEXT NOT NULL,
    "errorCategory"     TEXT,
    "providerRequestId" TEXT,
    "retryAfterSeconds" INTEGER,
    "durationMs"        INTEGER NOT NULL,
    "endedAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capability_invocations_pkey" PRIMARY KEY ("resolutionId"),
    CONSTRAINT "capability_invocations_outcome_vocabulary" CHECK ("outcome" IN ('succeeded', 'failed', 'adapter-fault')),
    CONSTRAINT "capability_invocations_error_shape" CHECK ("outcome" = 'succeeded' OR "errorCategory" IS NOT NULL OR "outcome" = 'adapter-fault'),
    CONSTRAINT "capability_invocations_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "capability_resolutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "capability_invocations_workspaceId_idx" ON "capability_invocations"("workspaceId");
CREATE TRIGGER "capability_invocations_immutable"
    BEFORE UPDATE OR DELETE ON "capability_invocations"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- §7 · evidence_intake_attempts — the record of trying to obtain external evidence (FR-HUB-050–055).
-- Mutable: it is a work queue; its history is the resolutions it references.
CREATE TABLE "evidence_intake_attempts" (
    "id"               TEXT NOT NULL,
    "workspaceId"      TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "workRef"          JSONB NOT NULL,
    "contractItemId"   TEXT NOT NULL,
    "capability"       TEXT NOT NULL,
    "revision"         TEXT,
    "attestedArtifact" JSONB,
    "state"            TEXT NOT NULL,
    "reason"           TEXT,
    "resolutionIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "attestationId"    TEXT,
    "attempts"         INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt"    TIMESTAMP(3),
    "giveUpAt"         TIMESTAMP(3) NOT NULL,
    "requestedBy"      TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evidence_intake_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evidence_intake_attempts_capability_vocabulary" CHECK ("capability" IN ('ReadTestResults', 'ReadBuildStatus')),
    CONSTRAINT "evidence_intake_attempts_state_vocabulary" CHECK ("state" IN ('pending', 'contributed', 'not-contributed', 'gave-up', 'refused')),
    CONSTRAINT "evidence_intake_attempts_reason_required" CHECK ("state" IN ('pending', 'contributed') OR "reason" IS NOT NULL),
    CONSTRAINT "evidence_intake_attempts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "evidence_intake_attempts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "evidence_intake_attempts_workspaceId_idx" ON "evidence_intake_attempts"("workspaceId");
CREATE INDEX "evidence_intake_attempts_state_nextAttemptAt_idx" ON "evidence_intake_attempts"("state", "nextAttemptAt");

-- §8 · notification_deliveries — one SendNotification request and its outcome (US6). Immutable after insert.
CREATE TABLE "notification_deliveries" (
    "id"                TEXT NOT NULL,
    "workspaceId"       TEXT NOT NULL,
    "projectId"         TEXT NOT NULL,
    "cause"             JSONB NOT NULL,
    "recipients"        TEXT[] NOT NULL,
    "resolutionId"      TEXT,
    "outcome"           TEXT NOT NULL,
    "providerMessageId" TEXT,
    "failureReason"     TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_deliveries_outcome_vocabulary" CHECK ("outcome" IN ('delivered', 'failed', 'refused')),
    CONSTRAINT "notification_deliveries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "notification_deliveries_workspaceId_idx" ON "notification_deliveries"("workspaceId");
CREATE TRIGGER "notification_deliveries_immutable"
    BEFORE UPDATE OR DELETE ON "notification_deliveries"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- §8a · deployment_capability_bindings — the append-only record of what each boot
-- observed for the deployment's Embed binding (analysis I1, FR-HUB-084).
-- Not tenant-scoped: it belongs to the deployment, like engine_registrations.
CREATE TABLE "deployment_capability_bindings" (
    "id"              TEXT NOT NULL,
    "capability"      TEXT NOT NULL,
    "adapterKey"      TEXT,
    "providerBinding" JSONB NOT NULL DEFAULT '{}',
    "observedModel"   JSONB,
    "modelId"         TEXT,
    "previousModelId" TEXT,
    "reindexRequired" BOOLEAN NOT NULL DEFAULT false,
    "health"          TEXT NOT NULL,
    "reason"          TEXT,
    "observedBy"      TEXT NOT NULL,
    "observedAt"      TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_capability_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deployment_capability_bindings_health_vocabulary" CHECK ("health" IN ('healthy', 'degraded', 'unhealthy')),
    CONSTRAINT "deployment_capability_bindings_reason_required" CHECK ("health" = 'healthy' OR "reason" IS NOT NULL)
);
CREATE INDEX "deployment_capability_bindings_capability_observedAt_idx" ON "deployment_capability_bindings"("capability", "observedAt" DESC);
CREATE TRIGGER "deployment_capability_bindings_immutable"
    BEFORE UPDATE OR DELETE ON "deployment_capability_bindings"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Seed — the five approved v1 contract versions, from the reviewed JSON files
-- (R-039-3). Each document appears ONCE, between $contract$ markers, and every
-- column is derived from it; capabilities-conformance.spec.ts (T2126) asserts
-- each equals its file after normalisation. Generated, never hand-edited.
-- seed:Embed.v1.0.json
INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","approvedBy","approvedAt","createdBy")
SELECT gen_random_uuid()::text, d->>'name', d->>'scope', (d->>'major')::int, (d->>'minor')::int, 'approved', d, d->'inputSchema', d->'outputSchema',
       ARRAY(SELECT jsonb_array_elements_text(d->'errorCategories')), d->'requiredScope', (d->>'changesState')::boolean,
       'system:epic-039-seed', CURRENT_TIMESTAMP, 'git:packages/capability-contract/capabilities/Embed.v1.0.json'
FROM (SELECT $contract${"name":"Embed","major":1,"minor":0,"scope":"deployment","changesState":false,"description":"Turn an ordered batch of texts into one vector per text, of the dimension the bound adapter declares, with the model's id and version.","requiredScope":{"access":"read","resources":["model.embed"]},"errorCategories":["adapter-fault","provider-throttled","provider-unavailable","credential-rejected","not-found","timed-out","batch-too-large","text-too-long","model-not-present","credential-material-in-content"],"limits":{"maxTexts":64,"maxTextLength":8000},"inputSchema":{"type":"object","additionalProperties":false,"required":["texts"],"properties":{"texts":{"type":"array","minItems":1,"maxItems":64,"items":{"type":"string","minLength":1,"maxLength":8000}}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["model","vectors"],"properties":{"model":{"type":"object","additionalProperties":false,"required":["id","version","dimension"],"properties":{"id":{"type":"string","minLength":1},"version":{"type":"string","minLength":1},"dimension":{"type":"integer"}}},"vectors":{"type":"array","items":{"type":"array","items":{"type":"number"}}}}}}$contract$::jsonb AS d) AS s;
-- end-seed
-- seed:ReadBuildStatus.v1.0.json
INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","approvedBy","approvedAt","createdBy")
SELECT gen_random_uuid()::text, d->>'name', d->>'scope', (d->>'major')::int, (d->>'minor')::int, 'approved', d, d->'inputSchema', d->'outputSchema',
       ARRAY(SELECT jsonb_array_elements_text(d->'errorCategories')), d->'requiredScope', (d->>'changesState')::boolean,
       'system:epic-039-seed', CURRENT_TIMESTAMP, 'git:packages/capability-contract/capabilities/ReadBuildStatus.v1.0.json'
FROM (SELECT $contract${"name":"ReadBuildStatus","major":1,"minor":0,"scope":"project","changesState":false,"description":"The build outcome for a full commit id. A branch is refused: a status for a moving name attests nothing.","requiredScope":{"access":"read","resources":["ci.checks"]},"errorCategories":["adapter-fault","provider-throttled","provider-unavailable","credential-rejected","not-found","timed-out","revision-not-found"],"inputSchema":{"type":"object","additionalProperties":false,"required":["revision"],"properties":{"revision":{"type":"string","pattern":"^[0-9a-f]{40}([0-9a-f]{24})?$"}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["revision","state","final","checks","observedAt"],"properties":{"revision":{"type":"string","pattern":"^[0-9a-f]{40}([0-9a-f]{24})?$"},"state":{"type":"string","enum":["pending","success","failure","neutral","none"]},"final":{"type":"boolean"},"checks":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["name","state","final"],"properties":{"name":{"type":"string"},"state":{"type":"string","enum":["pending","success","failure","neutral"]},"final":{"type":"boolean"},"url":{"type":"string"},"completedAt":{"type":"string"}}}},"observedAt":{"type":"string"}}}}$contract$::jsonb AS d) AS s;
-- end-seed
-- seed:ReadRepository.v1.0.json
INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","approvedBy","approvedAt","createdBy")
SELECT gen_random_uuid()::text, d->>'name', d->>'scope', (d->>'major')::int, (d->>'minor')::int, 'approved', d, d->'inputSchema', d->'outputSchema',
       ARRAY(SELECT jsonb_array_elements_text(d->'errorCategories')), d->'requiredScope', (d->>'changesState')::boolean,
       'system:epic-039-seed', CURRENT_TIMESTAMP, 'git:packages/capability-contract/capabilities/ReadRepository.v1.0.json'
FROM (SELECT $contract${"name":"ReadRepository","major":1,"minor":0,"scope":"project","changesState":false,"description":"Read a hosted repository's content at a named revision. The repository is the project's binding, never an input.","requiredScope":{"access":"read","resources":["repository.contents"]},"errorCategories":["adapter-fault","provider-throttled","provider-unavailable","credential-rejected","not-found","timed-out","revision-not-found","content-too-large"],"limits":{"maxPaths":50,"maxFileBytes":1048576,"maxResponseBytes":5242880},"inputSchema":{"type":"object","additionalProperties":false,"required":["revision","mode"],"properties":{"revision":{"type":"string","minLength":1,"maxLength":255},"paths":{"type":"array","maxItems":50,"items":{"type":"string","minLength":1,"maxLength":1024}},"mode":{"type":"string","enum":["tree","files"]}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["revision"],"properties":{"revision":{"type":"object","additionalProperties":false,"required":["requested","resolvedCommit"],"properties":{"requested":{"type":"string","maxLength":255},"resolvedCommit":{"type":"string","pattern":"^[0-9a-f]{40}([0-9a-f]{24})?$"}}},"entries":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["path","kind"],"properties":{"path":{"type":"string"},"kind":{"type":"string","enum":["file","dir"]},"sizeBytes":{"type":"integer"}}}},"truncated":{"type":"boolean"},"files":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["path","encoding","content","sizeBytes"],"properties":{"path":{"type":"string"},"encoding":{"type":"string","enum":["utf8","base64"]},"content":{"type":"string"},"sizeBytes":{"type":"integer"}}}},"missing":{"type":"array","items":{"type":"string"}}}}}$contract$::jsonb AS d) AS s;
-- end-seed
-- seed:ReadTestResults.v1.0.json
INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","approvedBy","approvedAt","createdBy")
SELECT gen_random_uuid()::text, d->>'name', d->>'scope', (d->>'major')::int, (d->>'minor')::int, 'approved', d, d->'inputSchema', d->'outputSchema',
       ARRAY(SELECT jsonb_array_elements_text(d->'errorCategories')), d->'requiredScope', (d->>'changesState')::boolean,
       'system:epic-039-seed', CURRENT_TIMESTAMP, 'git:packages/capability-contract/capabilities/ReadTestResults.v1.0.json'
FROM (SELECT $contract${"name":"ReadTestResults","major":1,"minor":0,"scope":"project","changesState":false,"description":"Test results for a full commit id, shaped one-to-one onto the in-toto test-result predicate so intake does no interpretation.","requiredScope":{"access":"read","resources":["ci.artifacts"]},"errorCategories":["adapter-fault","provider-throttled","provider-unavailable","credential-rejected","not-found","timed-out","revision-not-found","results-not-found","results-malformed","result-too-large"],"limits":{"maxTestNames":20000},"inputSchema":{"type":"object","additionalProperties":false,"required":["revision"],"properties":{"revision":{"type":"string","pattern":"^[0-9a-f]{40}([0-9a-f]{24})?$"}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["revision","final","result","suites","passedTests","failedTests","skippedTests","source","observedAt"],"properties":{"revision":{"type":"string","pattern":"^[0-9a-f]{40}([0-9a-f]{24})?$"},"final":{"type":"boolean"},"result":{"type":"string","enum":["PASSED","FAILED","NONE"]},"suites":{"type":"integer"},"passedTests":{"type":"array","maxItems":20000,"items":{"type":"string"}},"failedTests":{"type":"array","maxItems":20000,"items":{"type":"string"}},"skippedTests":{"type":"array","maxItems":20000,"items":{"type":"string"}},"source":{"type":"object","additionalProperties":false,"required":["format"],"properties":{"runUrl":{"type":"string"},"artifactName":{"type":"string"},"format":{"type":"string","enum":["junit-xml"]}}},"observedAt":{"type":"string"}}}}$contract$::jsonb AS d) AS s;
-- end-seed
-- seed:SendNotification.v1.0.json
INSERT INTO "capability_contract_versions" ("id","name","scope","major","minor","status","document","inputSchema","outputSchema","errorCategories","requiredScope","changesState","approvedBy","approvedAt","createdBy")
SELECT gen_random_uuid()::text, d->>'name', d->>'scope', (d->>'major')::int, (d->>'minor')::int, 'approved', d, d->'inputSchema', d->'outputSchema',
       ARRAY(SELECT jsonb_array_elements_text(d->'errorCategories')), d->'requiredScope', (d->>'changesState')::boolean,
       'system:epic-039-seed', CURRENT_TIMESTAMP, 'git:packages/capability-contract/capabilities/SendNotification.v1.0.json'
FROM (SELECT $contract${"name":"SendNotification","major":1,"minor":0,"scope":"project","changesState":true,"description":"Deliver one message to named recipient addresses. The only v1 capability that changes state at a provider.","requiredScope":{"access":"write","resources":["notification.send"]},"errorCategories":["adapter-fault","provider-throttled","provider-unavailable","credential-rejected","not-found","timed-out","recipient-rejected","credential-material-in-content"],"limits":{"maxRecipients":20,"maxSubject":200,"maxBodyText":20000},"inputSchema":{"type":"object","additionalProperties":false,"required":["recipients","subject","body","idempotencyKey"],"properties":{"recipients":{"type":"array","minItems":1,"maxItems":20,"items":{"type":"object","additionalProperties":false,"required":["address"],"properties":{"address":{"type":"string","minLength":3,"maxLength":320,"pattern":"^[^@\\s]+@[^@\\s]+$"}}}},"subject":{"type":"string","minLength":1,"maxLength":200},"body":{"type":"object","additionalProperties":false,"required":["text"],"properties":{"text":{"type":"string","minLength":1,"maxLength":20000}}},"idempotencyKey":{"type":"string","minLength":1,"maxLength":256}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["delivered","acceptedAt"],"properties":{"delivered":{"type":"boolean"},"providerMessageId":{"type":"string"},"acceptedAt":{"type":"string"}}}}$contract$::jsonb AS d) AS s;
-- end-seed
