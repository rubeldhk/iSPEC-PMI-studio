/**
 * `T1643` (EPIC-045, `R-045-7`, data-model.md §5) — the tree, the content, the
 * unbound syncs and the reported-versus-synced findings.
 *
 * ## Everything here is a projection
 *
 * Nothing in this file is stored. The tree is the Epic's manifests grouped by
 * path; `current` is the version of the newest sync that included the path;
 * `notInLatestSync` is the absence of the path from the newest sync. Storing
 * any of the three would mean maintaining it, and a maintained projection over
 * an append-only table is a second source of truth waiting to disagree.
 *
 * ## `current` is decided by sync order, not by completion time
 *
 * A sync always precedes its execution's completion — the hook syncs, then
 * completes — so ordering by `syncedAt` (then sync id, for the same
 * millisecond) already answers the spec's edge case about two executions
 * touching one path within the same second, without reading completion times
 * at all (analysis `I1`).
 *
 * ## The tree never loads content
 *
 * `SC-ART-006`, data-model.md §8. An Epic with 50 files × 20 versions is a
 * thousand rows; dragging a megabyte of markdown per row across the wire to
 * render a size and a digest is the difference between a page and a timeout.
 * The store's `versionSummariesByIds` is the projection without `content`, and
 * a spy on `versionsByIds` in `artifact-read.service.spec.ts` is what keeps it
 * that way.
 */
import type { ArtifactKind, ArtifactStore, ArtifactSyncFileRecord, ArtifactSyncRecord, RefusalCode } from './artifact.store.js';
import type { ExecutionLookupRow, ExecutionReader } from './artifact-sync.service.js';

/** What one execution contributed, as the screens name it (`contracts/viewer-contract.md` §3). */
export interface DeliveredBy {
  readonly executionId: string;
  readonly command: string;
  readonly outcome: string;
  readonly at: string;
  readonly syncId: string;
}

export interface ArtifactVersionSummary {
  readonly versionId: string;
  readonly digest: string;
  readonly sizeBytes: number;
  readonly firstSyncedAt: string;
  /** Every execution whose sync delivered this digest, newest first. */
  readonly deliveredBy: readonly DeliveredBy[];
}

export interface ArtifactTreeEntry {
  readonly path: string;
  readonly kind: ArtifactKind;
  /** The version of the newest sync that included this path, or null when every mention was refused. */
  readonly current: { readonly versionId: string; readonly digest: string; readonly sizeBytes: number; readonly sync: DeliveredBy } | null;
  /** True when the Epic's newest sync did not include this path (`FR-ART-014`). */
  readonly notInLatestSync: boolean;
  /** Newest first. */
  readonly versions: readonly ArtifactVersionSummary[];
}

export interface ArtifactRefusal {
  readonly path: string;
  readonly code: RefusalCode;
  readonly detail: string | null;
  readonly executionId: string;
  readonly at: string;
}

export interface ArtifactFindings {
  /** Digests the completion's output binding named that no sync of this Epic stored (`FR-ART-009`). */
  readonly reportedNotSynced: readonly { readonly executionId: string; readonly digest: string }[];
  /** Digests a sync stored that the completion did not report. */
  readonly syncedNotReported: readonly { readonly executionId: string; readonly digest: string }[];
}

export interface ArtifactTree {
  readonly epicId: string;
  readonly files: readonly ArtifactTreeEntry[];
  readonly refusals: readonly ArtifactRefusal[];
  readonly findings: ArtifactFindings;
}

export interface ArtifactContent {
  readonly versionId: string;
  readonly path: string;
  readonly kind: ArtifactKind;
  readonly digest: string;
  readonly sizeBytes: number;
  readonly content: string;
  readonly firstSyncedAt: string;
  readonly deliveredBy: readonly DeliveredBy[];
}

export interface UnboundSyncEntry {
  readonly syncId: string;
  readonly executionId: string;
  readonly command: string;
  readonly outcome: string;
  readonly at: string;
  readonly created: number;
  readonly reused: number;
  readonly refused: number;
  readonly files: readonly { readonly path: string; readonly digest: string; readonly outcome: string; readonly versionId: string | null; readonly refusalCode: RefusalCode | null }[];
}

export interface UnboundArtifacts {
  readonly projectId: string;
  readonly syncs: readonly UnboundSyncEntry[];
}

export interface ArtifactReadDeps {
  readonly store: ArtifactStore;
  readonly executions: ExecutionReader;
}

/** Newest first, with the id as the tie-break inside one millisecond. */
function bySyncedAtDesc(a: ArtifactSyncRecord, b: ArtifactSyncRecord): number {
  const delta = b.syncedAt.getTime() - a.syncedAt.getTime();
  return delta !== 0 ? delta : b.id.localeCompare(a.id);
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class ArtifactReadService {
  constructor(private readonly deps: ArtifactReadDeps) {}

  /**
   * The Epic's files, grouped by path. One pass over the manifests of the
   * Epic's syncs — not one query per file, and no content anywhere.
   */
  async tree(workspaceId: string, projectId: string, epicId: string): Promise<ArtifactTree> {
    const syncs = [...(await this.deps.store.syncsForEpic(workspaceId, epicId))].sort(bySyncedAtDesc);
    const manifests = await this.deps.store.manifestsFor(syncs.map((s) => s.id));
    const executions = await this.executionsById(workspaceId, projectId);

    const summaries = await this.summaries(manifests);
    const bySync = new Map(syncs.map((s) => [s.id, s]));
    const delivered = (row: ArtifactSyncFileRecord): DeliveredBy | null => {
      const sync = bySync.get(row.syncId);
      if (sync === undefined) return null;
      return this.deliveredBy(sync, executions.get(sync.executionId));
    };

    // Newest sync first, so the first mention of a path is its current version.
    const order = new Map(syncs.map((s, i) => [s.id, i]));
    const accepted = manifests
      .filter((m) => m.outcome !== 'refused' && m.versionId !== null)
      .sort((a, b) => (order.get(a.syncId) ?? 0) - (order.get(b.syncId) ?? 0));

    const latestSyncId = syncs[0]?.id ?? null;
    const paths = new Map<string, ArtifactSyncFileRecord[]>();
    for (const row of accepted) {
      const list = paths.get(row.path) ?? [];
      list.push(row);
      paths.set(row.path, list);
    }

    const files: ArtifactTreeEntry[] = [];
    for (const [path, rows] of paths) {
      // One entry per distinct version, in the order its newest sync appeared.
      const versions: ArtifactVersionSummary[] = [];
      const seen = new Map<string, DeliveredBy[]>();
      for (const row of rows) {
        const by = delivered(row);
        const list = seen.get(row.versionId as string);
        if (list === undefined) seen.set(row.versionId as string, by === null ? [] : [by]);
        else if (by !== null) list.push(by);
      }
      for (const [versionId, by] of seen) {
        const summary = summaries.get(versionId);
        if (summary === undefined) continue;
        versions.push({ versionId, digest: summary.digest, sizeBytes: summary.sizeBytes, firstSyncedAt: iso(summary.firstSyncedAt), deliveredBy: by });
      }

      const head = rows[0];
      const headSummary = head ? summaries.get(head.versionId as string) : undefined;
      const headSync = head ? delivered(head) : null;
      files.push({
        path,
        kind: (headSummary?.kind ?? summaries.get(versions[0]?.versionId ?? '')?.kind ?? 'spec') as ArtifactKind,
        current: head && headSummary && headSync ? { versionId: head.versionId as string, digest: headSummary.digest, sizeBytes: headSummary.sizeBytes, sync: headSync } : null,
        notInLatestSync: latestSyncId !== null && !rows.some((r) => r.syncId === latestSyncId),
        versions,
      });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    const refusals: ArtifactRefusal[] = manifests
      .filter((m) => m.outcome === 'refused' && m.refusalCode !== null)
      .map((m) => {
        const sync = bySync.get(m.syncId);
        return { path: m.path, code: m.refusalCode as RefusalCode, detail: m.refusalDetail, executionId: sync?.executionId ?? '', at: sync ? iso(sync.syncedAt) : '' };
      })
      .sort((a, b) => b.at.localeCompare(a.at) || a.path.localeCompare(b.path));

    return { epicId, files, refusals, findings: this.findings(syncs, manifests, executions) };
  }

  /**
   * Which project a version belongs to, or null when it belongs to another
   * workspace. The route needs the project before it can check membership, and
   * a version of another workspace must be absent rather than forbidden.
   */
  async locate(workspaceId: string, versionId: string): Promise<{ projectId: string } | null> {
    const version = await this.deps.store.findVersion(versionId);
    return version === null || version.workspaceId !== workspaceId ? null : { projectId: version.projectId };
  }

  /** One version, content included — the only read that loads it. */
  async content(workspaceId: string, projectId: string, versionId: string): Promise<ArtifactContent | null> {
    const version = await this.deps.store.findVersion(versionId);
    if (version === null || version.workspaceId !== workspaceId || version.projectId !== projectId) return null;
    const executions = await this.executionsById(workspaceId, projectId);
    // Which syncs delivered this digest — across every Epic, since a version is
    // identified by its content and an execution may have delivered it unbound.
    const syncs = [...(await this.deps.store.unboundSyncs(workspaceId, projectId)), ...(await this.syncsOfProject(workspaceId, projectId))];
    const unique = new Map(syncs.map((s) => [s.id, s]));
    const manifests = await this.deps.store.manifestsFor([...unique.keys()]);
    const deliveredBy = manifests
      .filter((m) => m.versionId === versionId)
      .map((m) => {
        const sync = unique.get(m.syncId);
        return sync ? this.deliveredBy(sync, executions.get(sync.executionId)) : null;
      })
      .filter((d): d is DeliveredBy => d !== null)
      .sort((a, b) => b.at.localeCompare(a.at));

    return {
      versionId: version.id,
      path: version.path,
      kind: version.kind,
      digest: version.digest,
      sizeBytes: version.sizeBytes,
      content: version.content,
      firstSyncedAt: iso(version.firstSyncedAt),
      deliveredBy,
    };
  }

  /** The project's syncs bound to no Epic, and what each stored (`FR-ART-007`). */
  async unbound(workspaceId: string, projectId: string): Promise<UnboundArtifacts> {
    const syncs = [...(await this.deps.store.unboundSyncs(workspaceId, projectId))].sort(bySyncedAtDesc);
    const manifests = await this.deps.store.manifestsFor(syncs.map((s) => s.id));
    const executions = await this.executionsById(workspaceId, projectId);
    return {
      projectId,
      syncs: syncs.map((sync) => {
        const by = this.deliveredBy(sync, executions.get(sync.executionId));
        return {
          syncId: sync.id,
          executionId: sync.executionId,
          command: by.command,
          outcome: by.outcome,
          at: by.at,
          created: sync.createdCount,
          reused: sync.reusedCount,
          refused: sync.refusedCount,
          files: manifests
            .filter((m) => m.syncId === sync.id)
            .map((m) => ({ path: m.path, digest: m.digest, outcome: m.outcome, versionId: m.versionId, refusalCode: m.refusalCode })),
        };
      }),
    };
  }

  /**
   * What the completion CLAIMED against what the sync STORED (`FR-ART-009`).
   * Reported and never repaired: the two records disagreeing is itself the
   * finding, and a platform that silently reconciled them would destroy it.
   */
  private findings(syncs: readonly ArtifactSyncRecord[], manifests: readonly ArtifactSyncFileRecord[], executions: ReadonlyMap<string, ExecutionLookupRow>): ArtifactFindings {
    const reportedNotSynced: { executionId: string; digest: string }[] = [];
    const syncedNotReported: { executionId: string; digest: string }[] = [];
    const byExecution = new Map<string, Set<string>>();
    for (const sync of syncs) {
      const stored = byExecution.get(sync.executionId) ?? new Set<string>();
      for (const m of manifests) {
        if (m.syncId === sync.id && m.outcome !== 'refused') stored.add(m.digest);
      }
      byExecution.set(sync.executionId, stored);
    }
    for (const [executionId, stored] of byExecution) {
      const reported = new Set(executions.get(executionId)?.outputArtifactDigests ?? []);
      // An execution with no output binding reported nothing — a
      // partially-completed or failed run legitimately has none, so its stored
      // digests are not "unreported" (AC-EXR-17d).
      if (reported.size > 0) {
        for (const digest of reported) if (!stored.has(digest)) reportedNotSynced.push({ executionId, digest });
        for (const digest of stored) if (!reported.has(digest)) syncedNotReported.push({ executionId, digest });
      }
    }
    return { reportedNotSynced, syncedNotReported };
  }

  private deliveredBy(sync: ArtifactSyncRecord, execution: ExecutionLookupRow | undefined): DeliveredBy {
    return {
      executionId: sync.executionId,
      command: execution?.command ?? 'unknown',
      outcome: execution?.state ?? 'unknown',
      at: iso(sync.syncedAt),
      syncId: sync.id,
    };
  }

  private async executionsById(workspaceId: string, projectId: string): Promise<ReadonlyMap<string, ExecutionLookupRow>> {
    return new Map((await this.deps.executions.forProject(workspaceId, projectId)).map((e) => [e.executionId, e]));
  }

  /** Every sync of the project, bound and unbound, for the content read's `deliveredBy`. */
  private async syncsOfProject(workspaceId: string, projectId: string): Promise<ArtifactSyncRecord[]> {
    const executions = await this.deps.executions.forProject(workspaceId, projectId);
    const lists = await Promise.all(executions.map((e) => this.deps.store.syncsForExecution(workspaceId, e.executionId)));
    return lists.flat();
  }

  /** Version metadata — deliberately WITHOUT content (`SC-ART-006`). */
  private async summaries(manifests: readonly ArtifactSyncFileRecord[]): Promise<ReadonlyMap<string, { digest: string; sizeBytes: number; firstSyncedAt: Date; kind: ArtifactKind }>> {
    const ids = [...new Set(manifests.map((m) => m.versionId).filter((id): id is string => id !== null))];
    const rows = await this.deps.store.versionSummariesByIds(ids);
    return new Map(rows.map((r) => [r.id, { digest: r.digest, sizeBytes: r.sizeBytes, firstSyncedAt: r.firstSyncedAt, kind: r.kind }]));
  }
}
