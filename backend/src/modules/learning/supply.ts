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
import {
  describeScope,
  scopeIncludesProject,
  type AdmissionTarget,
  type AdmissionVerdict,
  type KnowledgeAdmission,
  type KnowledgeSourceReader,
} from '@pmi/learning-contract';
import type { LearningPolicy, LearningPolicyReader } from './learning-policy.js';
import type { AdmissionFact, LearningReads, StatusEventRecord, VersionRecord } from './learning.store.js';
import type { LearningPorts } from './learning.tokens.js';

/** The store, narrowed to knowledge. */
export type KnowledgeReads = Pick<LearningReads, 'entry' | 'version' | 'versionsOfEntry' | 'versionsByIds' | 'currentStatus' | 'statusEvents' | 'admissionFacts'>;

const GOVERNED_KNOWLEDGE = 'governed-knowledge';

/**
 * `T2373` (EPIC-048, `FR-LRN-040`…`046`, `FR-LRN-055`; `R-048-11`) — the
 * `KnowledgeAdmission` half: may this approved version be supplied to this
 * package? `EPIC-038` consults it after `judgeBoundary` and before
 * `access.mayRead`, and records every refusal as an exclusion with one of its
 * **existing** reason codes, the rule named at the start of `detail`.
 *
 * One store read for the whole batch (`R-048-22`): versions, entries and latest
 * statuses together.
 */
export class KnowledgeGate implements KnowledgeAdmission {
  constructor(
    private readonly deps: {
      readonly reads: Pick<LearningReads, 'admissionFacts'>;
      readonly ports: Pick<LearningPorts, 'experts' | 'projects'>;
      readonly policy: Pick<LearningPolicyReader, 'current'>;
    },
  ) {}

  async admit(candidates: readonly { readonly sourceId: string; readonly sourceVersion: string }[], target: AdmissionTarget): Promise<readonly AdmissionVerdict[]> {
    if (candidates.length === 0) return [];
    const facts = await this.deps.reads.admissionFacts(target.workspaceId, [...new Set(candidates.map((c) => c.sourceVersion))]);
    const byVersion = new Map<string, AdmissionFact>(facts.map((f) => [f.version.id, f]));

    // FR-LRN-055 — the package's Expert, if any, must declare governed-knowledge.
    const memory = await this.memoryVerdict(target);
    const policyState = await this.deps.policy.current(target.workspaceId);
    const policy = policyState.state === 'ok' ? policyState.policy : null;
    const archived = new Map<string, boolean>();
    const isArchived = async (projectId: string): Promise<boolean> => {
      if (!archived.has(projectId)) archived.set(projectId, (await this.deps.ports.projects.find(target.workspaceId, projectId))?.status === 'archived');
      return archived.get(projectId)!;
    };

    const out: AdmissionVerdict[] = [];
    for (const c of candidates) {
      const fact = byVersion.get(c.sourceVersion);
      out.push(await this.judge(c.sourceId, fact, target, memory, policy, isArchived));
    }
    return out;
  }

  private async memoryVerdict(target: AdmissionTarget): Promise<AdmissionVerdict | null> {
    if (target.executionId === undefined) return null;
    try {
      const expert = await this.deps.ports.experts.forExecution(target.workspaceId, target.executionId);
      if (expert === null || expert.memoryPolicy === GOVERNED_KNOWLEDGE) return null;
      return { admitted: false, reason: 'permission', detail: `memory-policy: Expert ${expert.expertId} contract v${expert.contractVersion} declares "${expert.memoryPolicy}"; only "${GOVERNED_KNOWLEDGE}" receives knowledge` };
    } catch (err) {
      return { admitted: false, reason: 'permission', detail: `memory-policy: the execution's Expert cannot be determined (${err instanceof Error ? err.message : 'ExpertProvenance failed'}); no knowledge is supplied` };
    }
  }

  private async judge(
    entryId: string,
    fact: AdmissionFact | undefined,
    target: AdmissionTarget,
    memory: AdmissionVerdict | null,
    policy: LearningPolicy | null,
    isArchived: (projectId: string) => Promise<boolean>,
  ): Promise<AdmissionVerdict> {
    // FR-LRN-043 — never outside the workspace it was approved in.
    if (fact === undefined || fact.entry.id !== entryId) {
      return { admitted: false, reason: 'boundary', detail: `workspace: entry ${entryId} is not approved knowledge of workspace ${target.workspaceId}` };
    }
    const { version, entry, status } = fact;
    // FR-LRN-033 — superseded and deprecated versions are not supplied as current.
    if (status?.status === 'superseded') return { admitted: false, reason: 'stale', detail: `superseded: by ${status.successorVersionId}` };
    if (status?.status === 'deprecated') return { admitted: false, reason: 'stale', detail: `deprecated: ${status.reason ?? 'no reason recorded'}` };
    if (status === null) return { admitted: false, reason: 'stale', detail: `deprecated: version ${version.id} has no status` };
    if (memory !== null) return memory;
    // FR-LRN-041 — the approved scope must include the project.
    if (!scopeIncludesProject(version.scope, target.projectId)) {
      return { admitted: false, reason: 'boundary', detail: `scope: approved for ${describeScope(version.scope)}, not project ${target.projectId}` };
    }
    // FR-LRN-046 — an entry scoped only to an archived project stops being supplied.
    if (version.scope.kind === 'project' && (await isArchived(version.scope.projectIds[0]))) {
      return { admitted: false, reason: 'boundary', detail: `archived: project ${version.scope.projectIds[0]} is archived` };
    }
    const elsewhere = target.projectId !== entry.originProjectId;
    if (elsewhere) {
      // FR-LRN-040, FR-LRN-047 — reuse beyond the origin is what the workspace allows.
      const reuse = policy?.reuse;
      if (version.scope.kind === 'workspace' && reuse?.workspaceScopeAllowed !== true) {
        return { admitted: false, reason: 'boundary', detail: `reuse-policy: workspace-wide reuse is not allowed${policy === null ? ' (no learning policy)' : ` by learning policy v${policy.version}`}` };
      }
      if (version.scope.kind === 'projects' && reuse?.namedSetsAllowed !== true) {
        return { admitted: false, reason: 'boundary', detail: `reuse-policy: reuse across a named set is not allowed${policy === null ? ' (no learning policy)' : ` by learning policy v${policy.version}`}` };
      }
      // FR-LRN-044 — undetermined never leaves its origin.
      if (version.classification === 'undetermined') {
        return { admitted: false, reason: 'classification', detail: `classification: undetermined, not reusable outside project ${entry.originProjectId}` };
      }
      const permitted = policy?.permittedClassificationsFor(target.projectId) ?? [];
      if (!permitted.includes(version.classification)) {
        return { admitted: false, reason: 'classification', detail: `classification: ${version.classification} is not permitted in project ${target.projectId}` };
      }
    }
    return { admitted: true, inclusionNote: `approved knowledge — entry ${entry.id} v${version.version}, scope ${describeScope(version.scope)}` };
  }
}

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
