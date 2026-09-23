/**
 * `T1634` (EPIC-045, data-model.md §6) — the sync, step by step.
 *
 * One governed command's finish hook calls this once, with the Epic's markdown
 * set and the digests it computed. What comes back is a manifest: what was
 * created, what already existed, and what was refused and why.
 *
 * ## The Epic comes from the execution, never from the path
 *
 * `FR-ART-003`, `R-045-2`. `specs/007-intake/spec.md` synced by an execution
 * bound to Epic 3 belongs to **Epic 3**. A directory name is a fact about a
 * developer's disk; the binding is a fact the platform recorded when the
 * command was registered. Trusting the path would let a mistyped directory
 * silently re-parent an Epic's whole history.
 *
 * ## Idempotence is the store's job, not a check here
 *
 * `FR-ART-006`, `R-045-8`. This service never asks "does this version exist?"
 * before inserting one — two syncs running at once would both be told *no*.
 * It calls `createVersion`, which inserts and reads back on the unique
 * violation. The same applies to the sync row: the derived key plus the unique
 * index is what makes a replay return the stored answer.
 *
 * ## A refusal costs one file
 *
 * `FR-ART-004`. Nothing here aborts a sync because one file was bad. The good
 * files are stored, the bad ones are recorded with a code, and one `system`
 * comment on the execution says which — so the developer sees it on the
 * timeline rather than in a log nobody reads.
 */
import { createHash } from 'node:crypto';
import { bindExecutions, type BindableEpic } from '@pmi/epic-stage';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { isUniqueViolation, type ArtifactStore, type NewArtifactSyncFile, type RefusalCode } from './artifact.store.js';
import { epicDirectoryOf } from './artifact-set.js';
import { artifactLimits, validateFile, type ArtifactLimits, type SyncedFile } from './artifact-validation.js';
import type { SpecificationSyncPort } from './specification-sync.port.js';

/** One execution, flattened — its binding, its outcome and its agent identity in one row (`R-045-6`). */
export interface ExecutionLookupRow {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly command: string;
  readonly initiatorId: string;
  readonly state: string;
  readonly registeredAt: string;
  readonly completedAt: string | null;
  readonly completionComment: string | null;
  /** The INPUT binding — `epic` and its number, or `project`. */
  readonly targetType: string | null;
  readonly targetId: string | null;
  /** The OUTPUT binding's digests, already split (`FR-ART-009`). */
  readonly outputArtifactDigests: readonly string[];
  readonly agentAdapter: string | null;
  readonly agentVersion: string | null;
  readonly agentModel: string | null;
}

export interface ExecutionReader {
  find(workspaceId: string, executionId: string): Promise<ExecutionLookupRow | null>;
  forProject(workspaceId: string, projectId: string): Promise<ExecutionLookupRow[]>;
}

export interface EpicLister {
  list(workspaceId: string, projectId: string): Promise<readonly (BindableEpic & { readonly slug: string })[]>;
}

export interface SyncCommentPort {
  add(input: {
    workspaceId: string;
    executionId: string;
    authorId: string;
    authorType: 'service';
    commentType: 'system';
    body: string;
    idempotencyKey: string;
  }): Promise<{ commentId: string }>;
}

export interface SyncAuditPort {
  record(row: { workspaceId: string; actorId: string | null; action: 'create'; targetType: string; targetId: string; outcome: 'success'; detail: Record<string, unknown> }): Promise<void>;
}

export interface ProjectOwnerPort {
  ownerOf(workspaceId: string, projectId: string): Promise<string | null>;
}

export interface ArtifactSyncDeps {
  readonly store: ArtifactStore;
  readonly executions: ExecutionReader;
  readonly epics: EpicLister;
  readonly specifications: SpecificationSyncPort;
  readonly comments: SyncCommentPort;
  readonly audit: SyncAuditPort;
  readonly owners?: ProjectOwnerPort | undefined;
  /** Overridden in tests; production reads the environment (`R-045-10`). */
  readonly limits?: (() => ArtifactLimits) | undefined;
  /** The output parser, when one is wired; absent means `{ parsed: false }`. */
  readonly parse?: ((contentRaw: string) => Record<string, unknown> | null) | undefined;
}

export interface SyncContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly credentialId: string;
}

export interface SyncRequest {
  readonly executionId: string;
  readonly files: readonly SyncedFile[];
  readonly idempotencyKey?: string | undefined;
}

export interface SyncAnswer {
  readonly syncId: string;
  readonly epicId: string | null;
  readonly created: number;
  readonly reused: number;
  readonly refused: readonly { readonly path: string; readonly code: RefusalCode }[];
}

/** `artifacts:<executionId>:<sha256 of sorted path=digest>` (`R-045-8`). */
export function deriveIdempotencyKey(executionId: string, files: readonly SyncedFile[]): string {
  // Sorted, so the same set in a different order is the same key — which is
  // what makes a retried hook recognisable as a replay rather than a new sync.
  const body = files
    .map((f) => `${f.path}=${f.digest}`)
    .sort()
    .join('\n');
  return `artifacts:${executionId}:${createHash('sha256').update(body, 'utf8').digest('hex')}`;
}

/** The `spec.md` of an Epic directory — the one file that becomes a specification (`FR-ART-030`). */
function isEpicSpec(path: string): boolean {
  return path.endsWith('/spec.md') && epicDirectoryOf(path) !== null;
}

function titleFrom(contentRaw: string, fallback: string): string {
  const heading = /^#\s+(.+?)\s*$/m.exec(contentRaw);
  return heading?.[1]?.trim() || fallback;
}

export class ArtifactSyncService {
  constructor(private readonly deps: ArtifactSyncDeps) {}

  async sync(ctx: SyncContext, request: SyncRequest): Promise<SyncAnswer> {
    // Step 2 — the execution is this workspace's and this project's, or it is
    // absent. Never "forbidden": existence is not disclosed (FR-ART-050).
    const execution = await this.deps.executions.find(ctx.workspaceId, request.executionId);
    if (execution === null || execution.projectId !== ctx.projectId) {
      throw new NotFoundError('Not found.', { code: 'execution_unknown' });
    }

    // Step 3 — the key. A replay is answered from the stored row before any
    // file is looked at, so a retry costs nothing and writes nothing.
    const idempotencyKey = request.idempotencyKey ?? deriveIdempotencyKey(request.executionId, request.files);
    const existing = await this.deps.store.findSyncByKey(ctx.workspaceId, idempotencyKey);
    if (existing !== null) {
      await this.assertSameSync(existing, request);
      return this.answerFrom(existing);
    }

    // Step 4 — the Epic, from the execution's binding.
    const epicId = await this.resolveEpic(ctx, execution);

    // Step 5 — per file, in the order sent.
    const limits = (this.deps.limits ?? artifactLimits)();
    const manifest: NewArtifactSyncFile[] = [];
    const refused: { path: string; code: RefusalCode }[] = [];
    const acceptedDigests: string[] = [];
    let created = 0;
    let reused = 0;
    /** The Epic's `spec.md`, if one was accepted — step 7 needs its content. */
    let epicSpec: { path: string; content: string } | null = null;

    for (const [index, file] of request.files.entries()) {
      const check = validateFile(file, { index, limits });
      if (!check.ok) {
        manifest.push({ path: file.path, digest: file.digest, outcome: 'refused', versionId: null, refusalCode: check.code, refusalDetail: check.detail });
        refused.push({ path: file.path, code: check.code });
        continue;
      }
      const outcome = await this.deps.store.createVersion({
        workspaceId: ctx.workspaceId,
        projectId: ctx.projectId,
        path: file.path,
        kind: check.kind,
        digest: check.digest,
        sizeBytes: check.sizeBytes,
        content: file.content,
        firstExecutionId: execution.executionId,
      });
      manifest.push({ path: file.path, digest: check.digest, outcome: outcome.created ? 'created' : 'reused', versionId: outcome.row.id, refusalCode: null, refusalDetail: null });
      acceptedDigests.push(check.digest);
      if (outcome.created) created += 1;
      else reused += 1;
      if (isEpicSpec(file.path)) epicSpec = { path: file.path, content: file.content };
    }

    // Step 6 — the Epic's spec.md is the Epic's specification. BEFORE the sync
    // row (DEF-045-002): a sync row is the mark of a finished sync, and a
    // replay returns early on it. If this step failed after the row existed,
    // the hook's retry would replay and the specification would never be
    // created. Ordered this way, a failure here leaves no row, and the retry
    // redoes the work — the versions are already stored and simply `reused`.
    if (epicSpec !== null && epicId !== null) {
      await this.syncSpecification(ctx, execution, epicId, epicSpec);
    }

    // Step 7 — the sync row and its manifest, in one transaction with the
    // version inserts the store already performed. A concurrent sync with the
    // same key loses the unique index and reads the winner's answer — after
    // checking it asked for the same thing (review finding 4).
    const recorded = await this.deps.store.recordSync(
      { workspaceId: ctx.workspaceId, projectId: ctx.projectId, executionId: execution.executionId, epicId, credentialId: ctx.credentialId, idempotencyKey, createdCount: created, reusedCount: reused, refusedCount: refused.length },
      manifest,
    );
    if (recorded.replayed) {
      await this.assertSameSync(recorded.row, request);
      return this.answerFrom(recorded.row);
    }

    // Step 8 — the refusals on the timeline, and the audit row.
    if (refused.length > 0) await this.comment(ctx, execution.executionId, recorded.row.id, manifest);
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: execution.initiatorId,
      action: 'create',
      targetType: 'artifact_sync',
      targetId: recorded.row.id,
      outcome: 'success',
      detail: {
        kind: 'artifacts.sync',
        executionId: execution.executionId,
        epicId,
        credentialId: ctx.credentialId,
        created,
        reused,
        refused: refused.map((r) => r.code),
        digests: acceptedDigests,
      },
    });

    return { syncId: recorded.row.id, epicId, created, reused, refused };
  }

  /**
   * A replayed key must be the same request (review finding 4). `EPIC-037`'s rule
   * for every mutating operation: the same key with a different payload is a
   * conflict, never somebody else's answer. The manifest carries every file the
   * request named — accepted and refused alike, with the digest as stated — so
   * comparing it to the request's files is comparing the whole payload.
   */
  private async assertSameSync(existing: { id: string; executionId: string }, request: SyncRequest): Promise<void> {
    const manifest = await this.deps.store.manifestFor(existing.id);
    const stored = manifest.map((m) => `${m.path}=${m.digest}`).sort().join('\n');
    const asked = request.files.map((f) => `${f.path}=${f.digest}`).sort().join('\n');
    if (existing.executionId !== request.executionId || stored !== asked) {
      throw new ConflictError('The idempotency key was already used for a different sync.', { code: 'idempotency_conflict' });
    }
  }

  /** The stored answer for a replayed key — the counts as they were, not as the replay claims. */
  private async answerFrom(row: { id: string; epicId: string | null; createdCount: number; reusedCount: number }): Promise<SyncAnswer> {
    const manifest = await this.deps.store.manifestFor(row.id);
    return {
      syncId: row.id,
      epicId: row.epicId,
      created: row.createdCount,
      reused: row.reusedCount,
      refused: manifest.filter((m) => m.outcome === 'refused' && m.refusalCode !== null).map((m) => ({ path: m.path, code: m.refusalCode as RefusalCode })),
    };
  }

  /**
   * `bindExecutions` decides, so the Epic a sync attaches to and the Epic the
   * Spec Journey Board attaches the same execution to cannot disagree
   * (`R-045-2`). Unresolvable is `null` — listed as unbound, never guessed.
   */
  private async resolveEpic(ctx: SyncContext, execution: ExecutionLookupRow): Promise<string | null> {
    if (execution.targetType !== 'epic' || execution.targetId === null) return null;
    const epics = await this.deps.epics.list(ctx.workspaceId, ctx.projectId);
    const row = {
      executionId: execution.executionId,
      command: execution.command,
      state: execution.state,
      registeredAt: execution.registeredAt,
      completedAt: execution.completedAt,
      completionComment: execution.completionComment,
      targetId: execution.targetId,
    };
    const { byEpic } = bindExecutions([row], epics);
    for (const [epicId, rows] of byEpic) {
      if (rows.some((r) => r.executionId === execution.executionId)) return epicId;
    }
    return null;
  }

  private async syncSpecification(ctx: SyncContext, execution: ExecutionLookupRow, epicId: string, spec: { path: string; content: string }): Promise<void> {
    const parsed = this.deps.parse?.(spec.content) ?? null;
    const contentParsed = parsed ?? { parsed: false };
    let found = await this.deps.specifications.findByEpicSource(ctx.workspaceId, epicId, spec.path);
    if (found === null) {
      const owner = (await this.deps.owners?.ownerOf(ctx.workspaceId, ctx.projectId)) ?? execution.initiatorId;
      try {
        await this.deps.specifications.createFromSync({
          workspaceId: ctx.workspaceId,
          projectId: ctx.projectId,
          epicId,
          sourcePath: spec.path,
          title: titleFrom(spec.content, spec.path),
          contentRaw: spec.content,
          contentParsed,
          createdById: execution.initiatorId,
          ownerUserId: owner,
          provenance: provenanceOf(execution),
        });
      } catch (err) {
        // DEF-045-002: another sync created the Epic's specification between
        // our read and our insert. The unique (epicId, sourcePath) index is the
        // arbiter, as the artifact store's indexes are; read the winner back and
        // append our content as a version, so both syncs succeed and both
        // contents are kept.
        if (!isUniqueViolation(err, 'sourcePath')) throw err;
        found = await this.deps.specifications.findByEpicSource(ctx.workspaceId, epicId, spec.path);
        if (found === null) throw err;
      }
    }
    if (found !== null) {
      await this.deps.specifications.appendVersionIfChanged({ workspaceId: ctx.workspaceId, specificationId: found.id, contentRaw: spec.content, contentParsed, authoredById: execution.initiatorId });
      return;
    }
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: execution.initiatorId,
      action: 'create',
      targetType: 'specification',
      targetId: epicId,
      outcome: 'success',
      detail: { kind: 'specification.create_from_sync', epicId, executionId: execution.executionId, path: spec.path, versionNumber: 1 },
    });
  }

  /**
   * ONE comment per sync, listing every refusal. The existing `system` type and
   * a `service` author — no new comment type in the registry (`R-045-3`), which
   * `DEF-044-002` showed is a migration nobody remembers to write.
   *
   * A failure here does not fail the sync: the content is already durable, and
   * losing it because a timeline write failed would be the worse trade.
   */
  private async comment(ctx: SyncContext, executionId: string, syncId: string, manifest: readonly NewArtifactSyncFile[]): Promise<void> {
    const lines = manifest
      .filter((m) => m.outcome === 'refused')
      .map((m) => `- ${m.path} — ${m.refusalCode}${m.refusalDetail ? `: ${m.refusalDetail}` : ''}`);
    const body = `Artifact sync refused ${lines.length} file${lines.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n\nThe remaining files were stored. The project directory is authoritative; PMI Studio is a mirror.`;
    try {
      await this.deps.comments.add({
        workspaceId: ctx.workspaceId,
        executionId,
        authorId: 'platform:artifacts',
        authorType: 'service',
        commentType: 'system',
        body,
        idempotencyKey: `artifacts-refusal-${syncId}`,
      });
    } catch {
      // Deliberately swallowed. The refusal is already in the manifest and in
      // the answer the hook printed; the comment is a convenience on top.
    }
  }
}

/**
 * The execution's agent identity, or the connector. `agentVersion` first, then
 * `model` — the snapshot records both and the version is the more specific
 * (`data-model.md` §4).
 */
export function provenanceOf(execution: ExecutionLookupRow): { engineName: string; engineVersion: string } {
  if (execution.agentAdapter !== null && execution.agentAdapter !== '') {
    return { engineName: execution.agentAdapter, engineVersion: execution.agentVersion ?? execution.agentModel ?? 'unknown' };
  }
  return { engineName: 'connector', engineVersion: CONNECTOR_PROVENANCE_VERSION };
}

/** The contract version stands in for an engine version when no agent ran (`data-model.md` §4). */
export const CONNECTOR_PROVENANCE_VERSION = '1.0.0';

/** The narrow slice of persistence the execution lookup needs. */
export interface ExecutionRawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

interface ExecutionRawRow {
  executionId: string;
  workspaceId: string;
  projectId: string | null;
  command: string;
  initiatorId: string;
  state: string | null;
  registeredAt: Date;
  completedAt: Date | null;
  completionComment: string | null;
  targetType: string | null;
  targetId: string | null;
  outputDigests: string | null;
  agentAdapter: string | null;
  agentVersion: string | null;
  agentModel: string | null;
}

/**
 * `R-045-6` — the execution, its input binding, its output digests and its
 * agent identity in **one** statement.
 *
 * The registry's own services are not used here for a reason: this module must
 * read execution rows without `ExecutionsModule` depending on it, and the
 * fields wanted span four tables that no existing projection joins in this
 * combination. Reading is a consumption, not a coupling — nothing here writes.
 *
 * `artifactDigest` is the binding's comma-joined list (`EPIC-037`'s shape), so
 * it is split here rather than by every caller.
 */
export class PrismaExecutionReader implements ExecutionReader {
  constructor(private readonly db: ExecutionRawDb) {}

  private static readonly SELECT = `
    SELECT e."id" AS "executionId", e."workspaceId", e."projectId", e."command", e."initiatorId",
           l."type" AS "state", e."registeredAt",
           c."occurredAt" AS "completedAt", c."payload"->>'comment' AS "completionComment",
           i."targetType", i."targetId", o."artifactDigest" AS "outputDigests",
           a."adapter" AS "agentAdapter", a."agentVersion", a."model" AS "agentModel"
      FROM "executions" e
      LEFT JOIN "execution_target_bindings" i ON i."executionId" = e."id" AND i."phase" = 'input'
      LEFT JOIN "execution_target_bindings" o ON o."executionId" = e."id" AND o."phase" = 'output'
      LEFT JOIN LATERAL (
        SELECT ev."type" FROM "execution_events" ev
         WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
         ORDER BY ev."sequence" DESC LIMIT 1
      ) l ON TRUE
      LEFT JOIN LATERAL (
        SELECT ev."occurredAt", ev."payload" FROM "execution_events" ev
         WHERE ev."executionId" = e."id" AND ev."class" = 'lifecycle'
           AND ev."type" IN ('completed','partially-completed','failed','cancelled','timed-out')
         ORDER BY ev."sequence" DESC LIMIT 1
      ) c ON TRUE
      LEFT JOIN LATERAL (
        SELECT s."adapter", s."agentVersion", s."model" FROM "agent_identity_snapshots" s
         WHERE s."executionId" = e."id" ORDER BY s."createdAt" DESC LIMIT 1
      ) a ON TRUE`;

  private static map(row: ExecutionRawRow): ExecutionLookupRow {
    return {
      executionId: row.executionId,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      command: row.command,
      initiatorId: row.initiatorId,
      state: row.state ?? 'registered',
      registeredAt: new Date(row.registeredAt).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      completionComment: row.completionComment,
      targetType: row.targetType,
      targetId: row.targetId,
      outputArtifactDigests: (row.outputDigests ?? '').split(',').map((d) => d.trim()).filter((d) => d.length > 0),
      agentAdapter: row.agentAdapter,
      agentVersion: row.agentVersion,
      agentModel: row.agentModel,
    };
  }

  async find(workspaceId: string, executionId: string): Promise<ExecutionLookupRow | null> {
    const rows = await this.db.$queryRawUnsafe<ExecutionRawRow[]>(`${PrismaExecutionReader.SELECT} WHERE e."workspaceId" = $1 AND e."id" = $2`, workspaceId, executionId);
    return rows.length === 0 ? null : PrismaExecutionReader.map(rows[0] as ExecutionRawRow);
  }

  async forProject(workspaceId: string, projectId: string): Promise<ExecutionLookupRow[]> {
    const rows = await this.db.$queryRawUnsafe<ExecutionRawRow[]>(
      `${PrismaExecutionReader.SELECT} WHERE e."workspaceId" = $1 AND e."projectId" = $2 ORDER BY e."registeredAt" ASC, e."id" ASC`,
      workspaceId,
      projectId,
    );
    return rows.map(PrismaExecutionReader.map);
  }
}

/** Database-less runs and unit suites: nothing to read, and nothing pretending otherwise. */
export class EmptyExecutionReader implements ExecutionReader {
  async find(): Promise<ExecutionLookupRow | null> {
    return null;
  }

  async forProject(): Promise<ExecutionLookupRow[]> {
    return [];
  }
}
