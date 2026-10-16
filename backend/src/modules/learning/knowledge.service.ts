/**
 * `T2367` (EPIC-048, `FR-LRN-033`, `-035`, `-039`, `-073`; `SC-LRN-006`) —
 * approved knowledge, readable.
 *
 * - **browse** — versions, newest first, filtered by project, scope, category and
 *   status, each with its retrievability and open flags (`FR-LRN-073`, `-074`);
 * - **entry** — the current version and its provenance: *where did this come
 *   from, who approved it, and what does it replace?*, answered from the record
 *   alone (`SC-LRN-006`);
 * - **history** — every version, the candidate and decision behind each, every
 *   status event and flag, in order (`FR-LRN-035`). Nothing is deleted
 *   (`FR-LRN-039`): superseded and deprecated versions and cleared flags stay.
 *
 * Read-only. Another workspace's entry is `404`.
 *
 * Framework-free (PC-1).
 */
import { SCOPE_KINDS, VERSION_STATUSES, type ClaimedScope, type VersionStatus } from '@pmi/learning-contract';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { BrowseFilter, CandidateRecord, EntryRecord, FlagRecord, LearningReads, StatusEventRecord, VersionRecord } from './learning.store.js';
import { retrievabilityOf, type RetrievabilityView } from './review.service.js';
import type { EvidenceView, ShownCitation } from './evidence.view.js';

/** Who is reading — evidence is shown per reader (`FR-LRN-016`). */
export interface KnowledgeReader {
  readonly workspaceId: string;
  readonly userId: string;
}

export interface BrowseItem {
  readonly entryId: string;
  readonly category: string;
  readonly subjectKey: string;
  readonly originProjectId: string;
  readonly versionId: string;
  readonly version: number;
  readonly statement: string;
  readonly scope: ClaimedScope;
  readonly classification: string;
  readonly status: VersionStatus | null;
  readonly successorVersionId: string | null;
  readonly approvedByKind: 'human' | 'policy';
  readonly approvedBy: string;
  readonly approvedAt: Date;
  readonly retrievability: RetrievabilityView;
  readonly openFlags: readonly string[];
}

export interface FlagView extends FlagRecord {
  readonly open: boolean;
}

export interface HistoryVersion extends VersionRecord {
  readonly candidate: Pick<CandidateRecord, 'id' | 'kind' | 'sourceKind' | 'sourcePrincipalId' | 'executionId' | 'expertId' | 'statement' | 'claimedScope'>;
  readonly decision: { readonly decisionId: string; readonly resolvingDecisionId: string | null; readonly approvedByKind: 'human' | 'policy'; readonly approvedBy: string; readonly approvedAt: Date };
  readonly statusEvents: readonly StatusEventRecord[];
  readonly flags: readonly FlagView[];
  readonly retrievability: RetrievabilityView;
}

export interface HistoryEvent {
  readonly at: Date;
  readonly type: 'approved' | VersionStatus | 'flag';
  readonly versionId: string;
  readonly detail?: string;
}

export interface Provenance {
  readonly candidateId: string;
  readonly source:
    | { readonly kind: 'execution'; readonly executionId: string; readonly principalId: string; readonly expert?: { readonly id: string; readonly contractVersionId: string; readonly contractVersion: number } }
    | { readonly kind: 'person'; readonly userId: string };
  /**
   * `T2675`, `FR-LRN-016` — each citation as this reader may see it: a citation
   * whose attested target they may not read is `{state: 'withheld'}`, with no
   * id and no digest, and counted. The same rule as the candidate view.
   */
  readonly evidence: readonly ShownCitation[];
  readonly withheldEvidenceCount: number;
  readonly approvedByKind: 'human' | 'policy';
  readonly approvedBy: string;
  readonly approvedAt: Date;
  readonly decisionId: string;
  readonly resolvingDecisionId: string | null;
  readonly replaces?: { readonly versionId: string; readonly version: number; readonly statement: string };
}

export class KnowledgeService {
  constructor(private readonly deps: { readonly reads: LearningReads; readonly evidence: Pick<EvidenceView, 'forReader'> }) {}

  async browse(workspaceId: string, filter: BrowseFilter): Promise<{ items: BrowseItem[]; nextCursor: string | null }> {
    if (filter.status !== undefined && !(VERSION_STATUSES as readonly string[]).includes(filter.status)) {
      throw new ValidationFailedError(`status must be one of ${VERSION_STATUSES.join(', ')}.`, { field: 'status' });
    }
    if (filter.scopeKind !== undefined && !(SCOPE_KINDS as readonly string[]).includes(filter.scopeKind)) {
      throw new ValidationFailedError(`scope must be one of ${SCOPE_KINDS.join(', ')}.`, { field: 'scope' });
    }
    const page = await this.deps.reads.browse(workspaceId, filter);
    const items: BrowseItem[] = [];
    for (const row of page.items) {
      const flags = await this.flagViews(workspaceId, row.version.id);
      items.push({
        entryId: row.entry.id,
        category: row.entry.category,
        subjectKey: row.entry.subjectKey,
        originProjectId: row.entry.originProjectId,
        versionId: row.version.id,
        version: row.version.version,
        statement: row.version.statement,
        scope: row.version.scope,
        classification: row.version.classification,
        status: row.status?.status ?? null,
        successorVersionId: row.status?.successorVersionId ?? null,
        approvedByKind: row.version.approvedByKind,
        approvedBy: row.version.approvedBy,
        approvedAt: row.version.approvedAt,
        retrievability: await retrievabilityOf(this.deps.reads, workspaceId, row.version.id),
        openFlags: [...new Set(flags.filter((f) => f.open).map((f) => f.kind))],
      });
    }
    return { items, nextCursor: page.nextCursor };
  }

  async entry(workspaceId: string, entryId: string, reader: KnowledgeReader): Promise<{ entry: EntryRecord; current: VersionRecord | null; status: VersionStatus | null; provenance: Provenance | null; retrievability: RetrievabilityView | null; openFlags: readonly string[] }> {
    const { entry, versions } = await this.load(workspaceId, entryId);
    const latest = versions[versions.length - 1] ?? null;
    if (latest === null) return { entry, current: null, status: null, provenance: null, retrievability: null, openFlags: [] };
    const status = (await this.deps.reads.currentStatus(workspaceId, latest.id))?.status ?? null;
    const flags = await this.flagViews(workspaceId, latest.id);
    return {
      entry,
      current: latest,
      status,
      provenance: await this.provenance(workspaceId, latest, versions, reader),
      retrievability: await retrievabilityOf(this.deps.reads, workspaceId, latest.id),
      openFlags: [...new Set(flags.filter((f) => f.open).map((f) => f.kind))],
    };
  }

  async history(workspaceId: string, entryId: string): Promise<{ entry: EntryRecord; versions: HistoryVersion[]; events: HistoryEvent[] }> {
    const { entry, versions } = await this.load(workspaceId, entryId);
    const allStatus = await this.deps.reads.statusEvents(workspaceId, versions.map((v) => v.id));
    const out: HistoryVersion[] = [];
    // Events are grouped by the approval that caused them, then ordered by time;
    // within one approval: the version, its `current`, then what it ended.
    const groups = new Map<string, { at: Date; rank: number; events: HistoryEvent[] }>();
    const group = (candidateId: string, at: Date, rank: number): HistoryEvent[] => {
      if (!groups.has(candidateId)) groups.set(candidateId, { at, rank, events: [] });
      return groups.get(candidateId)!.events;
    };
    const flagEvents: HistoryEvent[] = [];
    // R-048-22 (history < 300 ms at 50 versions): each version's candidate, flags
    // and retrievability are read concurrently, not one round trip after another;
    // the history is then assembled in version order exactly as before.
    const reads = await Promise.all(
      versions.map(async (v) => {
        const [candidate, flags, retrievability] = await Promise.all([
          this.deps.reads.candidate(workspaceId, v.candidateId),
          this.flagViews(workspaceId, v.id),
          retrievabilityOf(this.deps.reads, workspaceId, v.id),
        ]);
        return { candidate, flags, retrievability };
      }),
    );
    for (const [i, v] of versions.entries()) {
      const { candidate, flags, retrievability } = reads[i]!;
      const statusEvents = allStatus.filter((s) => s.versionId === v.id);
      out.push({
        ...v,
        candidate: candidate === null
          ? { id: v.candidateId, kind: 'new', sourceKind: 'execution', sourcePrincipalId: 'unknown', executionId: null, expertId: null, statement: v.proposedStatement, claimedScope: v.proposedScope }
          : { id: candidate.id, kind: candidate.kind, sourceKind: candidate.sourceKind, sourcePrincipalId: candidate.sourcePrincipalId, executionId: candidate.executionId, expertId: candidate.expertId, statement: candidate.statement, claimedScope: candidate.claimedScope },
        decision: { decisionId: v.decisionId, resolvingDecisionId: v.resolvingDecisionId, approvedByKind: v.approvedByKind, approvedBy: v.approvedBy, approvedAt: v.approvedAt },
        statusEvents,
        flags,
        retrievability,
      });
      group(v.candidateId, v.approvedAt, v.version).push({ at: v.approvedAt, type: 'approved', versionId: v.id });
      for (const f of flags) flagEvents.push({ at: f.raisedAt, type: 'flag', versionId: v.id, detail: `${f.kind}: ${f.detail}` });
    }
    for (const s of allStatus) {
      group(s.candidateId ?? `status:${s.id}`, s.at, Number.MAX_SAFE_INTEGER).push({ at: s.at, type: s.status, versionId: s.versionId, ...(s.reason ? { detail: s.reason } : {}) });
    }
    const typeRank = (t: HistoryEvent['type']): number => (t === 'approved' ? 0 : t === 'current' ? 1 : 2);
    const ordered = [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime() || a.rank - b.rank);
    const events = ordered.flatMap((g) => [...g.events].sort((a, b) => typeRank(a.type) - typeRank(b.type)));
    // Flags interleave by time, after anything that happened at the same instant.
    for (const f of flagEvents.sort((a, b) => a.at.getTime() - b.at.getTime())) {
      const at = events.findIndex((e) => e.at.getTime() > f.at.getTime());
      if (at < 0) events.push(f);
      else events.splice(at, 0, f);
    }
    return { entry, versions: out, events };
  }

  private async load(workspaceId: string, entryId: string): Promise<{ entry: EntryRecord; versions: VersionRecord[] }> {
    const entry = await this.deps.reads.entry(workspaceId, entryId);
    if (entry === null) throw new NotFoundError('Not found.');
    return { entry, versions: await this.deps.reads.versionsOfEntry(workspaceId, entryId) };
  }

  private async flagViews(workspaceId: string, versionId: string): Promise<FlagView[]> {
    const flags = await this.deps.reads.flags(workspaceId, { versionId });
    const cleared = new Set(flags.map((f) => f.clearsFlagId).filter((id): id is string => id !== null));
    return flags.map((f) => ({ ...f, open: f.clearsFlagId === null && !cleared.has(f.id) }));
  }

  private async provenance(workspaceId: string, v: VersionRecord, versions: readonly VersionRecord[], reader: KnowledgeReader): Promise<Provenance> {
    const candidate = await this.deps.reads.candidate(workspaceId, v.candidateId);
    const citations = candidate === null ? [] : (await this.deps.reads.citations(workspaceId, candidate.id)).filter((c) => c.corroborationId === null);
    const previous = versions.find((p) => p.version === v.version - 1);
    const shown = await this.deps.evidence.forReader(workspaceId, reader, citations);
    return {
      candidateId: v.candidateId,
      source:
        candidate === null || candidate.sourceKind === 'person'
          ? { kind: 'person', userId: candidate?.sourcePrincipalId ?? 'unknown' }
          : {
              kind: 'execution',
              executionId: candidate.executionId!,
              principalId: candidate.sourcePrincipalId,
              ...(candidate.expertId !== null ? { expert: { id: candidate.expertId, contractVersionId: candidate.expertContractVersionId!, contractVersion: candidate.expertContractVersion! } } : {}),
            },
      evidence: shown.citations,
      withheldEvidenceCount: shown.withheldEvidenceCount,
      approvedByKind: v.approvedByKind,
      approvedBy: v.approvedBy,
      approvedAt: v.approvedAt,
      decisionId: v.decisionId,
      resolvingDecisionId: v.resolvingDecisionId,
      ...(previous !== undefined ? { replaces: { versionId: previous.id, version: previous.version, statement: previous.statement } } : {}),
    };
  }
}
