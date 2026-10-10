/**
 * `T2333` (EPIC-048) — what `EPIC-038` reads (`FR-LRN-002`, `FR-LRN-050`,
 * `R-048-11`).
 *
 * **Versions only.** This file is handed `KnowledgeReads` — a narrowing of the
 * store with no candidate read in it — so a candidate cannot be supplied as
 * knowledge in any state, whatever someone later asks of this file. `T2332`
 * asserts that no candidate read is even named here.
 *
 * `KnowledgeSourceReader` is served for source type `knowledge-entry` by
 * `EPIC-038`'s sources adapter and provenance service. `KnowledgeAdmission`
 * (`T2373`) is the other half.
 *
 * Framework-free (PC-1).
 */
import type { KnowledgeSourceReader } from '@pmi/learning-contract';
import type { LearningReads, StatusEventRecord, VersionRecord } from './learning.store.js';

/** The store, narrowed to knowledge. */
export type KnowledgeReads = Pick<LearningReads, 'entry' | 'version' | 'versionsOfEntry' | 'versionsByIds' | 'currentStatus' | 'statusEvents'>;

export class KnowledgeReader implements KnowledgeSourceReader {
  constructor(private readonly reads: KnowledgeReads) {}

  /** The entry's current version, or why it does not resolve (deprecated, absent). */
  async currentVersion(workspaceId: string, entryId: string): Promise<{ resolves: true; version: string } | { resolves: false; reason: string }> {
    const entry = await this.reads.entry(workspaceId, entryId);
    if (entry === null) return { resolves: false, reason: 'no such knowledge entry in this workspace' };
    const versions = await this.reads.versionsOfEntry(workspaceId, entryId);
    const statuses = await this.latestStatuses(workspaceId, versions);
    const current = versions.find((v) => statuses.get(v.id)?.status === 'current');
    if (current !== undefined) return { resolves: true, version: current.id };
    const latest = versions[versions.length - 1];
    const status = latest ? statuses.get(latest.id) : undefined;
    if (status?.status === 'deprecated') return { resolves: false, reason: `deprecated: ${status.reason ?? 'no reason recorded'}` };
    return { resolves: false, reason: 'no current version' };
  }

  /** The statement as approved. `projectId: null` — scope is admission's job, not the index partition's. */
  async read(workspaceId: string, entryId: string, versionId: string): Promise<{ text: string; projectId: null } | null> {
    const version = await this.reads.version(workspaceId, versionId);
    if (version === null || version.entryId !== entryId) return null;
    return { text: version.statement, projectId: null };
  }

  async status(
    workspaceId: string,
    entryId: string,
    versionId: string,
  ): Promise<{ status: 'current' } | { status: 'superseded'; supersededBy: string } | { status: 'deprecated'; reason: string }> {
    const version = await this.reads.version(workspaceId, versionId);
    const status = version === null || version.entryId !== entryId ? null : await this.reads.currentStatus(workspaceId, versionId);
    if (status === null) return { status: 'deprecated', reason: 'no such knowledge version in this workspace' };
    if (status.status === 'superseded') return { status: 'superseded', supersededBy: status.successorVersionId ?? 'unknown' };
    if (status.status === 'deprecated') return { status: 'deprecated', reason: status.reason ?? 'no reason recorded' };
    return { status: 'current' };
  }

  private async latestStatuses(workspaceId: string, versions: readonly VersionRecord[]): Promise<Map<string, StatusEventRecord>> {
    const out = new Map<string, StatusEventRecord>();
    for (const v of versions) {
      const s = await this.reads.currentStatus(workspaceId, v.id);
      if (s !== null) out.set(v.id, s);
    }
    return out;
  }
}
