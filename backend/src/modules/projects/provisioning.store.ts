/**
 * `T1341` (EPIC-041) — the provisioning record store.
 *
 * `data-model.md` §2. Append-only by interface — `append`, `latestForProject`,
 * `listForProject`, and nothing that mutates — and append-only in the database,
 * where `reject_mutation()` refuses UPDATE and DELETE. The project's state is a
 * projection of the latest record, never a field somebody sets.
 *
 * Framework-free (PC-1). Unit test: `backend/tests/unit/projects/provisioning-store.spec.ts`.
 */
import type { PrismaClient } from '@prisma/client';
import type { ProvisioningOutcome, ProvisioningRecord, ProvisioningStep } from './provisioning.types.js';

export interface ProvisioningRecordStore {
  append(record: ProvisioningRecord): Promise<ProvisioningRecord>;
  latestForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord | null>;
  listForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord[]>;
}

export class InMemoryProvisioningRecordStore implements ProvisioningRecordStore {
  private readonly rows: ProvisioningRecord[] = [];

  async append(record: ProvisioningRecord): Promise<ProvisioningRecord> {
    const frozen = Object.freeze({
      ...record,
      stepsCompleted: Object.freeze([...record.stepsCompleted]),
      filesWritten: Object.freeze([...record.filesWritten]),
    }) as ProvisioningRecord;
    this.rows.push(frozen);
    return frozen;
  }

  async latestForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord | null> {
    const list = await this.listForProject(workspaceId, projectId);
    return list[0] ?? null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord[]> {
    return this.rows
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || this.rows.indexOf(b) - this.rows.indexOf(a));
  }
}

type RecordDelegate = PrismaClient['provisioningRecord'];
type RecordRow = Awaited<ReturnType<RecordDelegate['findMany']>>[number];

const toRecord = (row: RecordRow): ProvisioningRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  projectId: row.projectId,
  actorId: row.actorId,
  correlationId: row.correlationId,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  outcome: row.outcome as ProvisioningOutcome,
  stepsCompleted: (row.stepsCompleted as ProvisioningStep[] | null) ?? [],
  failedStep: (row.failedStep as ProvisioningStep | null) ?? null,
  failureReason: row.failureReason,
  engineTag: row.engineTag,
  bundleVersion: row.bundleVersion,
  filesWritten: (row.filesWritten as string[] | null) ?? [],
  firstRunMarkerWritten: (row as { firstRunMarkerWritten?: boolean }).firstRunMarkerWritten ?? false,
});

export class PrismaProvisioningRecordStore implements ProvisioningRecordStore {
  constructor(private readonly record: RecordDelegate) {}

  async append(record: ProvisioningRecord): Promise<ProvisioningRecord> {
    const row = await this.record.create({
      data: {
        id: record.id,
        workspaceId: record.workspaceId,
        projectId: record.projectId,
        actorId: record.actorId,
        correlationId: record.correlationId,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        outcome: record.outcome,
        stepsCompleted: [...record.stepsCompleted],
        failedStep: record.failedStep,
        failureReason: record.failureReason,
        engineTag: record.engineTag,
        bundleVersion: record.bundleVersion,
        filesWritten: [...record.filesWritten],
        firstRunMarkerWritten: record.firstRunMarkerWritten,
      },
    });
    return toRecord(row);
  }

  async latestForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord | null> {
    const row = await this.record.findFirst({ where: { workspaceId, projectId }, orderBy: { startedAt: 'desc' } });
    return row === null ? null : toRecord(row);
  }

  async listForProject(workspaceId: string, projectId: string): Promise<ProvisioningRecord[]> {
    const rows = await this.record.findMany({ where: { workspaceId, projectId }, orderBy: { startedAt: 'desc' } });
    return rows.map(toRecord);
  }
}
