-- EPIC-023 — unattended runs and team review (FR-RUN-001..020).
--
-- T343: runs, recorded questions, provisional markings.
-- T350: provisional approval overrides (append-only).
-- T357 + T802: review sessions and answers, with conflict-resolution columns.
--
-- Retention rules at the database, not only in code:
--   provisional_approval_overrides  — append-only (FR-RUN-005a..c, SC-005a)
--   review_sessions                 — never deleted (FR-RUN-020)
--   answers                         — never deleted: competing answers stay
--                                     retrievable after resolution (SC-015)

-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('interactive', 'unattended');
CREATE TYPE "RunStopRange" AS ENUM ('after_specification', 'through_tasks');
CREATE TYPE "RunState" AS ENUM ('running', 'reached_stop_point', 'failed', 'cancelled');
CREATE TYPE "ReviewSessionState" AS ENUM ('open', 'submitted');
CREATE TYPE "AnswerState" AS ENUM ('draft', 'committed');

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" "RunMode" NOT NULL,
    "stopRange" "RunStopRange" NOT NULL,
    "state" "RunState" NOT NULL DEFAULT 'running',
    "accessSnapshot" JSONB,
    "initiatedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "outcomeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recorded_questions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "optionsConsidered" JSONB NOT NULL,
    "suggestedAnswer" TEXT NOT NULL,
    "provisionalAnswerApplied" TEXT,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorded_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provisional_markings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provisional_markings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provisional_approval_overrides" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "approvalRef" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemsAccepted" JSONB NOT NULL,

    CONSTRAINT "provisional_approval_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "state" "ReviewSessionState" NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "state" "AnswerState" NOT NULL DEFAULT 'draft',
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "selectedAsWinner" BOOLEAN NOT NULL DEFAULT false,
    "conflictResolvedById" TEXT,
    "conflictResolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_workspaceId_idx" ON "runs"("workspaceId");
CREATE INDEX "runs_projectId_state_idx" ON "runs"("projectId", "state");
CREATE INDEX "recorded_questions_workspaceId_idx" ON "recorded_questions"("workspaceId");
CREATE INDEX "recorded_questions_runId_idx" ON "recorded_questions"("runId");
CREATE INDEX "provisional_markings_workspaceId_idx" ON "provisional_markings"("workspaceId");
CREATE INDEX "provisional_markings_artifactType_artifactId_idx" ON "provisional_markings"("artifactType", "artifactId");
CREATE INDEX "provisional_markings_questionId_idx" ON "provisional_markings"("questionId");
CREATE INDEX "provisional_approval_overrides_workspaceId_idx" ON "provisional_approval_overrides"("workspaceId");
CREATE INDEX "provisional_approval_overrides_approvalRef_idx" ON "provisional_approval_overrides"("approvalRef");
CREATE UNIQUE INDEX "review_sessions_runId_key" ON "review_sessions"("runId");
CREATE INDEX "review_sessions_workspaceId_idx" ON "review_sessions"("workspaceId");
CREATE INDEX "answers_workspaceId_idx" ON "answers"("workspaceId");
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recorded_questions" ADD CONSTRAINT "recorded_questions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recorded_questions" ADD CONSTRAINT "recorded_questions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provisional_markings" ADD CONSTRAINT "provisional_markings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provisional_markings" ADD CONSTRAINT "provisional_markings_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "recorded_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provisional_approval_overrides" ADD CONSTRAINT "provisional_approval_overrides_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "recorded_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-RUN-005a..c — an override that can be edited is not an override record.
-- Attached to (never redefining) EPIC-004's shared reject_mutation().
CREATE TRIGGER "provisional_approval_overrides_immutable"
    BEFORE UPDATE OR DELETE ON "provisional_approval_overrides"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- FR-RUN-020 — a submitted session is retained permanently. DELETE is blocked
-- for every session; UPDATE stays open because `open → submitted` is a
-- legitimate transition (the one-way rule lives in code).
CREATE TRIGGER "review_sessions_no_delete"
    BEFORE DELETE ON "review_sessions"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- SC-015 / FR-RUN-020 — competing answers stay retrievable with their author;
-- a submitted session keeps every answer intact. Resolution selects a winner,
-- it never deletes the answers not chosen.
CREATE TRIGGER "answers_no_delete"
    BEFORE DELETE ON "answers"
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();
