-- =====================================================================
-- PMI Studio — Phase 1 Platform Core: Database Schema (design-level DDL)
-- Epic: EPIC-001 | Date: 2026-08-02 | Target: PostgreSQL 16
--
-- This is the DESIGN artifact, written for review. At implementation the
-- authoritative source becomes backend/prisma/schema.prisma, and Prisma
-- generates the migrations. Any divergence is a defect in the migration,
-- not a licence to edit this file quietly.
--
-- Entity semantics:  data-model.md
-- Architecture:      system-design.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------
CREATE TYPE project_status          AS ENUM ('active', 'archived');
CREATE TYPE requirement_type        AS ENUM ('business', 'functional', 'non_functional', 'constraint');
CREATE TYPE requirement_priority    AS ENUM ('p1', 'p2', 'p3');
CREATE TYPE requirement_status      AS ENUM ('active', 'retired');
-- Six states per SRS module specification M08 §8 (decision D-14).
-- Was 3 states (draft/in_review/approved) before the MPS drop of 2026-08-03.
CREATE TYPE spec_lifecycle_state    AS ENUM ('draft', 'review', 'approved', 'baselined', 'implemented', 'archived');
CREATE TYPE task_status             AS ENUM ('not_started', 'in_progress', 'done');
CREATE TYPE job_kind                AS ENUM ('generate_specification', 'generate_tasks', 'validate_specification');
CREATE TYPE job_state               AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out');
CREATE TYPE finding_severity        AS ENUM ('info', 'warning', 'error');
CREATE TYPE adr_status              AS ENUM ('proposed', 'accepted', 'superseded');
CREATE TYPE trace_relationship      AS ENUM ('generated_from', 'derived_from');
CREATE TYPE trace_artifact_type     AS ENUM ('requirement', 'specification', 'task');
CREATE TYPE audit_action            AS ENUM ('create', 'update', 'lifecycle_transition', 'engine_invocation', 'access_refused');
CREATE TYPE audit_outcome           AS ENUM ('success', 'refused', 'failed');

-- FR-026 / SC-005: every non-success terminal state names a specific reason.
-- There is deliberately no 'unknown' member — a generic failure is a defect.
CREATE TYPE job_failure_reason      AS ENUM (
    'engine_unavailable',
    'engine_error',
    'malformed_output',
    'empty_output',
    'timeout',
    'cancelled',
    'input_too_large',
    'empty_selection'
);

-- ---------------------------------------------------------------------
-- Workspace & identity  (FR-002)
-- Every table below carries workspace_id. Not a convention — the scoping
-- helper enforces it on every read, so a missing filter fails a test.
--
-- KNOWN DIVERGENCE — created_by / updated_by  (DEF-004-001, deferred to EPIC-005)
-- This file carries created_by / updated_by in 10 places. The implemented
-- schema (backend/prisma/schema.prisma and migration 20260814000000_init)
-- carries NONE of them, deliberately.
--
-- They are deferred to EPIC-005 (Identity), which supplies the actor that
-- gives them a value. Adding them now would mean nullable provenance on every
-- write path, revisited in full when identity lands — weak provenance recorded
-- as if it were strong. audit_entries already answers "who" via actor_id; a
-- created_by there would be a second answer to one question (PP-002).
--
-- This note exists so the next reader finds the decision instead of the gap,
-- and does not re-raise it. Do not "fix" the divergence by editing this file
-- alone: the columns land with EPIC-005's actor propagation or not at all.
-- ---------------------------------------------------------------------
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    email           TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    password_hash   TEXT NOT NULL,           -- Argon2id. Never selected by any read path.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);
CREATE INDEX idx_users_workspace ON users(workspace_id);

ALTER TABLE workspaces
    ADD COLUMN owner_user_id UUID REFERENCES users(id);   -- circular FK, set after seed

-- ---------------------------------------------------------------------
-- Engine registry  (FR-018, FR-019, FR-021)
-- ---------------------------------------------------------------------
CREATE TABLE engine_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    version         TEXT NOT NULL,           -- FR-022: identifies engine tool AND AI model
    capabilities    TEXT[] NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- FR-021: an engine lacking any Phase 1 capability cannot be registered
    CONSTRAINT engine_phase1_capabilities CHECK (
        capabilities @> ARRAY['generate_specification','generate_tasks','validate_specification']::TEXT[]
    )
);
-- Exactly one default engine
CREATE UNIQUE INDEX idx_engine_single_default ON engine_registrations(is_default) WHERE is_default;

-- ---------------------------------------------------------------------
-- Projects  (FR-001, FR-003)
-- ---------------------------------------------------------------------
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description     TEXT,
    status          project_status NOT NULL DEFAULT 'active',
    engine_id       UUID NOT NULL REFERENCES engine_registrations(id),
    owner_user_id   UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL REFERENCES users(id),
    CONSTRAINT projects_name_unique_per_workspace UNIQUE (workspace_id, name)
);
CREATE INDEX idx_projects_workspace_status ON projects(workspace_id, status);

-- ---------------------------------------------------------------------
-- Requirements  (FR-004 to FR-009)
-- ---------------------------------------------------------------------
CREATE TABLE requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    reference       TEXT NOT NULL,
    -- FR-007: refused with the field named if empty
    description     TEXT NOT NULL CHECK (char_length(trim(description)) > 0),
    type            requirement_type NOT NULL,
    priority        requirement_priority NOT NULL,
    status          requirement_status NOT NULL DEFAULT 'active',
    content_hash    TEXT NOT NULL,           -- FR-032: detects material change
    retired_at      TIMESTAMPTZ,             -- FR-006: soft retire, never delete
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL REFERENCES users(id),
    CONSTRAINT requirements_ref_unique_per_project UNIQUE (project_id, reference),
    CONSTRAINT requirements_retired_consistency CHECK (
        (status = 'retired' AND retired_at IS NOT NULL) OR
        (status = 'active'  AND retired_at IS NULL)
    )
);
-- FR-008: filter and sort by type, priority, status
CREATE INDEX idx_requirements_project_type     ON requirements(project_id, type);
CREATE INDEX idx_requirements_project_priority ON requirements(project_id, priority);
CREATE INDEX idx_requirements_project_status   ON requirements(project_id, status);

-- FR-009: append-only edit history
CREATE TABLE requirement_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    requirement_id  UUID NOT NULL REFERENCES requirements(id),
    description     TEXT NOT NULL,
    type            requirement_type NOT NULL,
    priority        requirement_priority NOT NULL,
    authored_by     UUID NOT NULL REFERENCES users(id),
    authored_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requirement_versions_req ON requirement_versions(requirement_id, authored_at DESC);

-- ---------------------------------------------------------------------
-- Specifications  (FR-010 to FR-015, FR-022, FR-032)
-- ---------------------------------------------------------------------
CREATE TABLE specifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id),
    project_id          UUID NOT NULL REFERENCES projects(id),   -- FR-010: exactly one project
    title               TEXT NOT NULL,
    lifecycle_state     spec_lifecycle_state NOT NULL DEFAULT 'draft',
    current_version_id  UUID,                                    -- FK added after versions table
    engine_id           UUID NOT NULL REFERENCES engine_registrations(id),
    engine_version      TEXT NOT NULL,                           -- FR-022: engine tool + AI model
    generated_at        TIMESTAMPTZ NOT NULL,
    is_out_of_date      BOOLEAN NOT NULL DEFAULT false,          -- FR-032: never auto-corrected
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          UUID NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_specifications_project ON specifications(project_id, lifecycle_state);

-- FR-013 / SC-007: immutable snapshots, append-only
CREATE TABLE specification_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id),
    specification_id    UUID NOT NULL REFERENCES specifications(id),
    version_number      INTEGER NOT NULL CHECK (version_number >= 1),
    content_raw         TEXT NOT NULL,       -- R-007: engine output verbatim, always kept
    content_parsed      JSONB NOT NULL,
    lifecycle_state_at_creation spec_lifecycle_state NOT NULL,
    authored_by         UUID NOT NULL REFERENCES users(id),
    authored_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT spec_version_unique UNIQUE (specification_id, version_number)
);
CREATE INDEX idx_spec_versions_spec ON specification_versions(specification_id, version_number DESC);

ALTER TABLE specifications
    ADD CONSTRAINT fk_spec_current_version
    FOREIGN KEY (current_version_id) REFERENCES specification_versions(id);

-- FR-014: who transitioned, and when
CREATE TABLE lifecycle_transitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id),
    specification_id    UUID NOT NULL REFERENCES specifications(id),
    from_state          spec_lifecycle_state NOT NULL,
    to_state            spec_lifecycle_state NOT NULL,
    actor_id            UUID NOT NULL REFERENCES users(id),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- FR-011 / M08 §8: only these transitions exist. approved -> draft is NOT permitted.
    -- 'baselined' is immutable (FR-011a) — editing forks a new version in 'draft'.
    -- 'archived' is reachable from approved, baselined, or implemented (FR-011b).
    CONSTRAINT lifecycle_permitted_transition CHECK (
        (from_state = 'draft'       AND to_state = 'review')      OR
        (from_state = 'review'      AND to_state = 'draft')       OR
        (from_state = 'review'      AND to_state = 'approved')    OR
        (from_state = 'approved'    AND to_state = 'baselined')   OR
        (from_state = 'baselined'   AND to_state = 'implemented') OR
        (from_state = 'approved'    AND to_state = 'archived')    OR
        (from_state = 'baselined'   AND to_state = 'archived')    OR
        (from_state = 'implemented' AND to_state = 'archived')
    )
);
CREATE INDEX idx_lifecycle_spec ON lifecycle_transitions(specification_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- Validation findings  (FR-023)
-- ---------------------------------------------------------------------
CREATE TABLE validation_findings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL REFERENCES workspaces(id),
    specification_id            UUID NOT NULL REFERENCES specifications(id),
    specification_version_id    UUID NOT NULL REFERENCES specification_versions(id),
    -- FR-023: a finding without a location is malformed engine output
    location                    TEXT NOT NULL CHECK (char_length(trim(location)) > 0),
    severity                    finding_severity NOT NULL,
    message                     TEXT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_spec_version ON validation_findings(specification_version_id);

-- ---------------------------------------------------------------------
-- Tasks  (FR-020)
-- ---------------------------------------------------------------------
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id),
    specification_id    UUID NOT NULL REFERENCES specifications(id),
    description         TEXT NOT NULL,
    status              task_status NOT NULL DEFAULT 'not_started',
    engine_id           UUID NOT NULL REFERENCES engine_registrations(id),
    engine_version      TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          UUID NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_tasks_spec_status ON tasks(specification_id, status);

-- ---------------------------------------------------------------------
-- Generation jobs  (FR-024 to FR-028)
-- ---------------------------------------------------------------------
CREATE TABLE generation_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    job_key         TEXT NOT NULL,           -- idempotency: duplicate submit joins existing job
    kind            job_kind NOT NULL,
    requested_by    UUID NOT NULL REFERENCES users(id),
    engine_id       UUID NOT NULL REFERENCES engine_registrations(id),
    input_refs      JSONB NOT NULL,
    state           job_state NOT NULL DEFAULT 'queued',
    failure_reason  job_failure_reason,
    access_snapshot JSONB,                   -- forward seam for EPIC-002
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- FR-026 / SC-005: a non-success terminal state MUST name its reason,
    -- and a successful job MUST NOT carry one.
    CONSTRAINT job_failure_reason_required CHECK (
        (state IN ('failed','cancelled','timed_out') AND failure_reason IS NOT NULL) OR
        (state NOT IN ('failed','cancelled','timed_out') AND failure_reason IS NULL)
    ),
    CONSTRAINT job_terminal_has_end CHECK (
        (state IN ('succeeded','failed','cancelled','timed_out') AND ended_at IS NOT NULL) OR
        (state IN ('queued','running'))
    )
);
-- Only one live job per idempotency key
CREATE UNIQUE INDEX idx_jobs_active_key ON generation_jobs(project_id, job_key)
    WHERE state IN ('queued','running');
CREATE INDEX idx_jobs_project_created ON generation_jobs(project_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Traceability  (FR-029 to FR-031)
-- Rows, not a view. Indexed BOTH ways because both traversals are
-- first-class (FR-030) and must stay fast at 500 specs/project (SC-009).
-- ---------------------------------------------------------------------
CREATE TABLE traceability_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    source_type     trace_artifact_type NOT NULL,
    source_id       UUID NOT NULL,
    target_type     trace_artifact_type NOT NULL,
    target_id       UUID NOT NULL,
    relationship    trace_relationship NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trace_unique UNIQUE (source_type, source_id, target_type, target_id, relationship),
    -- Only these edges exist in Phase 1
    CONSTRAINT trace_permitted_edges CHECK (
        (source_type = 'specification' AND target_type = 'requirement') OR
        (source_type = 'task'          AND target_type = 'specification')
    )
);
CREATE INDEX idx_trace_forward ON traceability_links(target_type, target_id);  -- requirement -> derived
CREATE INDEX idx_trace_reverse ON traceability_links(source_type, source_id);  -- task -> origins

-- ---------------------------------------------------------------------
-- Architecture Decision Records  (FR-034)
-- ---------------------------------------------------------------------
CREATE TABLE architecture_decision_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    reference       TEXT NOT NULL,
    title           TEXT NOT NULL,
    status          adr_status NOT NULL DEFAULT 'proposed',
    context         TEXT NOT NULL,
    decision        TEXT NOT NULL,
    consequences    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID NOT NULL REFERENCES users(id),
    CONSTRAINT adr_ref_unique_per_project UNIQUE (project_id, reference)
);

CREATE TABLE adr_specification_links (
    adr_id              UUID NOT NULL REFERENCES architecture_decision_records(id),
    specification_id    UUID NOT NULL REFERENCES specifications(id),
    PRIMARY KEY (adr_id, specification_id)
);

-- ---------------------------------------------------------------------
-- Audit  (FR-033, SC-012)
-- Immutable. Written in the SAME transaction as the action it records,
-- so an action cannot succeed without its audit entry.
-- ---------------------------------------------------------------------
CREATE TABLE audit_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    actor_id        UUID REFERENCES users(id),   -- NULL only for unauthenticated refusals
    action          audit_action NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       UUID,
    outcome         audit_outcome NOT NULL,
    detail          JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_workspace_time ON audit_entries(workspace_id, occurred_at DESC);
CREATE INDEX idx_audit_target ON audit_entries(target_type, target_id);

-- Enforce immutability at the database, not only in code.
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entries_immutable
    BEFORE UPDATE OR DELETE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER specification_versions_immutable
    BEFORE UPDATE OR DELETE ON specification_versions
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER requirement_versions_immutable
    BEFORE UPDATE OR DELETE ON requirement_versions
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER lifecycle_transitions_immutable
    BEFORE UPDATE OR DELETE ON lifecycle_transitions
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- =====================================================================
-- Phase 3 forward seam (NOT enabled in Phase 1)
--
-- Every table carries workspace_id, so tenant isolation becomes a switch
-- rather than a data migration. Phase 1 enforces isolation in the
-- application scoping helper; Phase 3 can additionally enable RLS:
--
--   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation ON projects
--     USING (workspace_id = current_setting('app.workspace_id')::UUID);
--
-- Deliberately NOT enabled now: it would add operational complexity
-- with no Phase 1 requirement depending on it.
-- =====================================================================
