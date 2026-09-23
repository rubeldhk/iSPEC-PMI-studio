/**
 * `T1325` (EPIC-041) — traceability links on PostgreSQL.
 *
 * `FR-LPW-041`, `R-041-7`. PMI-DOC-004B §2.1 named tasks, runs and jobs as the
 * in-memory stores of the composed application. `T1383` found a fourth: the
 * `traceability_links` table has existed since EPIC-011 and `commitGeneration`
 * writes to it inside its transaction — but `TRACEABILITY_LINK_STORE` was bound
 * to `InMemoryTraceabilityLinkStore` unconditionally, so `/trace` and
 * `/coverage` read a store nothing wrote to and answered `requirementIds: []`
 * for a specification linked to every requirement it was generated from.
 * SC-002 was true in the database and false on every screen.
 *
 * Framework-free (PC-1). Append and traverse; no delete exists (FR-029).
 *
 * Integration test: `backend/tests/integration/traceability-link-store.spec.ts`.
 */
import type { $Enums, PrismaClient } from '@prisma/client';
import { ConflictError } from '../../core/errors.js';
import type { TraceabilityLinkRecord, TraceabilityLinkStore } from './link-writer.service.js';

/** The application's vocabulary and Prisma's enum are the same words; the compiler cannot see it. */
const artifact = (t: TraceabilityLinkRecord['sourceType']): $Enums.TraceArtifactType => t as $Enums.TraceArtifactType;

type LinkDelegate = PrismaClient['traceabilityLink'];
type LinkRow = Awaited<ReturnType<LinkDelegate['findMany']>>[number];

const toRecord = (row: LinkRow): TraceabilityLinkRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  sourceType: row.sourceType as TraceabilityLinkRecord['sourceType'],
  sourceId: row.sourceId,
  targetType: row.targetType as TraceabilityLinkRecord['targetType'],
  targetId: row.targetId,
  relationship: row.relationship as TraceabilityLinkRecord['relationship'],
  createdAt: row.createdAt,
});

export class PrismaTraceabilityLinkStore implements TraceabilityLinkStore {
  constructor(private readonly link: LinkDelegate) {}

  async append(link: TraceabilityLinkRecord): Promise<TraceabilityLinkRecord> {
    if (await this.exists(link)) {
      throw new ConflictError('An identical traceability link already exists.');
    }
    const row = await this.link.create({
      data: {
        id: link.id,
        workspaceId: link.workspaceId,
        sourceType: artifact(link.sourceType),
        sourceId: link.sourceId,
        targetType: artifact(link.targetType),
        targetId: link.targetId,
        relationship: link.relationship,
        createdAt: link.createdAt,
      },
    });
    return toRecord(row);
  }

  async bySource(
    workspaceId: string,
    sourceType: TraceabilityLinkRecord['sourceType'],
    sourceId: string,
  ): Promise<TraceabilityLinkRecord[]> {
    const rows = await this.link.findMany({ where: { workspaceId, sourceType: artifact(sourceType), sourceId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toRecord);
  }

  async byTarget(
    workspaceId: string,
    targetType: TraceabilityLinkRecord['targetType'],
    targetId: string,
  ): Promise<TraceabilityLinkRecord[]> {
    const rows = await this.link.findMany({ where: { workspaceId, targetType: artifact(targetType), targetId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toRecord);
  }

  async exists(link: Omit<TraceabilityLinkRecord, 'id' | 'createdAt'>): Promise<boolean> {
    const row = await this.link.findFirst({
      where: {
        sourceType: artifact(link.sourceType),
        sourceId: link.sourceId,
        targetType: artifact(link.targetType),
        targetId: link.targetId,
        relationship: link.relationship,
      },
      select: { id: true },
    });
    return row !== null;
  }

  async linksForWorkspace(workspaceId: string): Promise<TraceabilityLinkRecord[]> {
    const rows = await this.link.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toRecord);
  }
}
