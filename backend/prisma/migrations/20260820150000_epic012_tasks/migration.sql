-- T100 (EPIC-012) — tasks generated from approved specifications (FR-020).
-- Design source: specs/_shared/schema.sql (Tasks).

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "engineName" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_workspaceId_idx" ON "tasks"("workspaceId");
CREATE INDEX "tasks_specificationId_status_idx" ON "tasks"("specificationId", "status");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "specifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
