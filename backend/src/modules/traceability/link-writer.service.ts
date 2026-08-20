/**
 * T081 — traceability link creation on successful generation (FR-029).
 *
 * The graph that makes the artifacts a system. Two Phase 1 edges exist:
 * specification → requirement and task → specification, both
 * `generated_from` — the schema CHECK enforces the same set at the database.
 * Links are the audit trail of derivation: the store exposes NO delete.
 *
 * Idempotent by design: generation retries re-write the same links, and a
 * duplicate five-tuple is skipped rather than doubled or failed — the caller
 * is a job runner, not a user who can act on a conflict.
 *
 * Framework-free (PC-1). Wired in `traceability.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationFailedError } from '../../core/errors.js';

export const TRACE_ARTIFACT_TYPES = ['requirement', 'specification', 'task'] as const;
export type TraceArtifactType = (typeof TRACE_ARTIFACT_TYPES)[number];

export type TraceRelationship = 'generated_from' | 'derived_from';

/** The two Phase 1 edges — everything else is refused naming this set. */
export const PERMITTED_EDGES: readonly { sourceType: TraceArtifactType; targetType: TraceArtifactType }[] = [
  { sourceType: 'specification', targetType: 'requirement' },
  { sourceType: 'task', targetType: 'specification' },
];

export function assertPermittedEdge(sourceType: TraceArtifactType, targetType: TraceArtifactType): void {
  const permitted = PERMITTED_EDGES.some(
    (e) => e.sourceType === sourceType && e.targetType === targetType,
  );
  if (!permitted) {
    throw new ValidationFailedError('Traceability link cannot be created.', {
      fields: [
        {
          field: 'sourceType/targetType',
          reason: `permitted edges: ${PERMITTED_EDGES.map((e) => `${e.sourceType}→${e.targetType}`).join(', ')}`,
        },
      ],
    });
  }
}

export interface TraceabilityLinkRecord {
  id: string;
  workspaceId: string;
  sourceType: TraceArtifactType;
  sourceId: string;
  targetType: TraceArtifactType;
  targetId: string;
  relationship: TraceRelationship;
  createdAt: Date;
}

/** Append and traverse. No delete exists (FR-029). */
export interface TraceabilityLinkStore {
  append(link: TraceabilityLinkRecord): Promise<TraceabilityLinkRecord>;
  bySource(
    workspaceId: string,
    sourceType: TraceArtifactType,
    sourceId: string,
  ): Promise<TraceabilityLinkRecord[]>;
  byTarget(
    workspaceId: string,
    targetType: TraceArtifactType,
    targetId: string,
  ): Promise<TraceabilityLinkRecord[]>;
  exists(link: Omit<TraceabilityLinkRecord, 'id' | 'createdAt'>): Promise<boolean>;
}

export class LinkWriterService {
  constructor(private readonly store: TraceabilityLinkStore) {}

  /** FR-029: every specification links to ≥1 originating requirement. */
  async linkSpecificationToRequirements(input: {
    workspaceId: string;
    specificationId: string;
    requirementIds: string[];
  }): Promise<TraceabilityLinkRecord[]> {
    return this.writeAll(
      input.requirementIds.map((requirementId) => ({
        workspaceId: input.workspaceId,
        sourceType: 'specification' as const,
        sourceId: input.specificationId,
        targetType: 'requirement' as const,
        targetId: requirementId,
        relationship: 'generated_from' as const,
      })),
    );
  }

  /** SC-003: every task resolves back through its specification. */
  async linkTasksToSpecification(input: {
    workspaceId: string;
    specificationId: string;
    taskIds: string[];
  }): Promise<TraceabilityLinkRecord[]> {
    return this.writeAll(
      input.taskIds.map((taskId) => ({
        workspaceId: input.workspaceId,
        sourceType: 'task' as const,
        sourceId: taskId,
        targetType: 'specification' as const,
        targetId: input.specificationId,
        relationship: 'generated_from' as const,
      })),
    );
  }

  private async writeAll(
    links: Omit<TraceabilityLinkRecord, 'id' | 'createdAt'>[],
  ): Promise<TraceabilityLinkRecord[]> {
    const written: TraceabilityLinkRecord[] = [];
    for (const link of links) {
      assertPermittedEdge(link.sourceType, link.targetType);
      // Idempotent: a retry re-writing the same derivation is a no-op.
      if (await this.store.exists(link)) continue;
      written.push(await this.store.append({ ...link, id: randomUUID(), createdAt: new Date() }));
    }
    return written;
  }
}

/** In-memory store for tests and database-less runs. Rows frozen, no delete. */
export class InMemoryTraceabilityLinkStore implements TraceabilityLinkStore {
  private readonly rows: TraceabilityLinkRecord[] = [];

  private key(link: Omit<TraceabilityLinkRecord, 'id' | 'createdAt'>): string {
    return [link.sourceType, link.sourceId, link.targetType, link.targetId, link.relationship].join('|');
  }

  async append(link: TraceabilityLinkRecord): Promise<TraceabilityLinkRecord> {
    if (await this.exists(link)) {
      throw new ConflictError('An identical traceability link already exists.');
    }
    const frozen = Object.freeze({ ...link }) as TraceabilityLinkRecord;
    this.rows.push(frozen);
    return frozen;
  }

  async bySource(
    workspaceId: string,
    sourceType: TraceArtifactType,
    sourceId: string,
  ): Promise<TraceabilityLinkRecord[]> {
    return this.rows.filter(
      (r) => r.workspaceId === workspaceId && r.sourceType === sourceType && r.sourceId === sourceId,
    );
  }

  async byTarget(
    workspaceId: string,
    targetType: TraceArtifactType,
    targetId: string,
  ): Promise<TraceabilityLinkRecord[]> {
    return this.rows.filter(
      (r) => r.workspaceId === workspaceId && r.targetType === targetType && r.targetId === targetId,
    );
  }

  async exists(link: Omit<TraceabilityLinkRecord, 'id' | 'createdAt'>): Promise<boolean> {
    return this.rows.some((r) => this.key(r) === this.key(link));
  }
}
