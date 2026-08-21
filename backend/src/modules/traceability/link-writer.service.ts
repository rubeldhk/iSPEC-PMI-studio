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

/**
 * EPIC-022 T301 (R-017-7) — the twelve chain STAGES, vision → operations.
 * The chain IS derivation, extended: TraceabilityLink widens rather than
 * gaining a sibling table (the opposite conclusion to DependencyEdge, and
 * deliberately so).
 */
export const CHAIN_STAGES = [
  'vision',
  'goal',
  'capability',
  'requirement',
  'specification',
  'architecture',
  'plan',
  'task',
  'code',
  'test',
  'release',
  'operation',
] as const;

export type TraceArtifactType = (typeof CHAIN_STAGES)[number];

/** Kept for callers that predate the widening. */
export const TRACE_ARTIFACT_TYPES = CHAIN_STAGES;

/** The twelve chain link types of FR-ENH-021, the source document's names. */
export const CHAIN_LINK_TYPES = [
  'vision',
  'goals',
  'capabilities',
  'requirements',
  'specifications',
  'architecture',
  'planning',
  'tasks',
  'code',
  'tests',
  'release',
  'operations',
] as const;

export type TraceRelationship =
  | 'generated_from'
  | 'derived_from'
  | (typeof CHAIN_LINK_TYPES)[number];

export function stageIndex(stage: TraceArtifactType): number {
  const index = CHAIN_STAGES.indexOf(stage);
  if (index === -1) {
    throw new ValidationFailedError(
      `Unknown chain stage "${stage}". Stages: ${CHAIN_STAGES.join(' → ')}.`,
    );
  }
  return index;
}

/**
 * The permitted edges: the two Phase 1 pairs, plus the chain-adjacent pairs
 * (child stage → parent stage). Every chain edge points UP-CHAIN — from a
 * later stage to an earlier one — which is what keeps the chain acyclic by
 * construction; everything else is refused naming this set.
 */
export const PERMITTED_EDGES: readonly { sourceType: TraceArtifactType; targetType: TraceArtifactType }[] = [
  // Phase 1 (FR-029) — unchanged.
  { sourceType: 'specification', targetType: 'requirement' },
  { sourceType: 'task', targetType: 'specification' },
  // The chain's adjacent segments (FR-ENH-021).
  { sourceType: 'goal', targetType: 'vision' },
  { sourceType: 'capability', targetType: 'goal' },
  { sourceType: 'requirement', targetType: 'capability' },
  { sourceType: 'architecture', targetType: 'specification' },
  { sourceType: 'plan', targetType: 'architecture' },
  { sourceType: 'task', targetType: 'plan' },
  { sourceType: 'code', targetType: 'task' },
  { sourceType: 'test', targetType: 'code' },
  { sourceType: 'release', targetType: 'test' },
  { sourceType: 'operation', targetType: 'release' },
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
  /** EPIC-022 T304 — the chain traversal reads the whole workspace graph. */
  linksForWorkspace(workspaceId: string): Promise<TraceabilityLinkRecord[]>;
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

  async linksForWorkspace(workspaceId: string): Promise<TraceabilityLinkRecord[]> {
    return this.rows.filter((r) => r.workspaceId === workspaceId).map((r) => ({ ...r }));
  }
}

// ------------------------------------------------------- the generation seam

/**
 * T858 — the adapter that makes generation and traversal share ONE link store.
 *
 * `T081` calls for link creation "on successful generation". Convergence found
 * the writer built and called by nothing: EPIC-008's generation path wrote
 * links into its own `SpecificationStore`, so a generated specification was
 * invisible to `/trace` and `/coverage`.
 *
 * This is the seam. It satisfies the port EPIC-008's store writes through, and
 * it routes every link via `LinkWriterService` — so the permitted-edge rule
 * (FR-029) and the idempotent re-write apply to generation exactly as they
 * apply to anything else. Neither module imports the other's service: EPIC-008
 * declares the port, EPIC-011 implements it, and they meet at the composition
 * root.
 */
export interface SpecificationTraceLinkShape {
  workspaceId: string;
  sourceType: 'specification';
  sourceId: string;
  targetType: 'requirement';
  targetId: string;
  relationship: 'generated_from';
}

export class TraceabilityLinkAdapter {
  constructor(
    private readonly writer: LinkWriterService,
    private readonly store: TraceabilityLinkStore,
  ) {}

  /**
   * Write a generation's links.
   *
   * Grouped by specification so the writer's own API is used rather than a
   * row-by-row bypass of it. In the in-memory posture this is the same
   * unit-of-work as the surrounding commit; the Prisma path passes its
   * transaction-scoped delegate instead.
   */
  async writeAll(links: SpecificationTraceLinkShape[]): Promise<void> {
    const bySpecification = new Map<string, { workspaceId: string; requirementIds: string[] }>();
    for (const link of links) {
      const entry = bySpecification.get(link.sourceId) ?? {
        workspaceId: link.workspaceId,
        requirementIds: [],
      };
      entry.requirementIds.push(link.targetId);
      bySpecification.set(link.sourceId, entry);
    }
    for (const [specificationId, entry] of bySpecification) {
      await this.writer.linkSpecificationToRequirements({
        workspaceId: entry.workspaceId,
        specificationId,
        requirementIds: entry.requirementIds,
      });
    }
  }

  /** FR-032's reverse lookup: which specifications derive from a requirement. */
  async sourceIdsForTarget(workspaceId: string, requirementId: string): Promise<string[]> {
    const rows = await this.store.byTarget(workspaceId, 'requirement', requirementId);
    return rows.filter((r) => r.sourceType === 'specification').map((r) => r.sourceId);
  }

  /** The links a specification owns — SC-002's orphan check reads this. */
  async forSource(workspaceId: string, specificationId: string): Promise<SpecificationTraceLinkShape[]> {
    const rows = await this.store.bySource(workspaceId, 'specification', specificationId);
    return rows.map((r) => ({
      workspaceId: r.workspaceId,
      sourceType: 'specification' as const,
      sourceId: r.sourceId,
      targetType: 'requirement' as const,
      targetId: r.targetId,
      relationship: 'generated_from' as const,
    }));
  }
}
