/**
 * `T2353` (EPIC-048, `FR-LRN-031`, `-032`, `-033`, `-038`, `-062`; `R-048-4`,
 * `R-048-6`) — **the only knowledge write.** `MP-1a` and `MP-1b`'s target.
 *
 * Every resolution of a candidate's decision comes here, whichever path found it
 * (the review route, the resolve sweep, an automatic decision settled on the
 * spot). What it does depends on the resolution, and on nothing the caller says:
 *
 * - **pending** — nothing;
 * - **refused** — a closure (`A-031-1`) is `rejected`, `expired` or `withdrawn`;
 *   a policy refusal returns the candidate to `proposed`;
 * - **approved / auto-executed** — judged by the approver guard. Not accepted:
 *   back to `proposed` with the reason, a flag and an audit record (analysis
 *   finding `I1` — never stranded in `pending-review` behind a decision
 *   `EPIC-031` has already closed). Accepted: the knowledge is written by
 *   `KnowledgeWriter.insertVersion` — version, status events, the `approved`
 *   transition and the audit entries in one transaction.
 *
 * This is the only file that receives a `KnowledgeWriter`; `T2332` asserts it.
 *
 * Framework-free (PC-1).
 */
import { createHash } from 'node:crypto';
import { ConflictError } from '../../core/errors.js';
import type { ApproverGuard, Verdict } from './approver.guard.js';
import type { KnowledgeWriter, Materialisation } from './knowledge.writer.js';
import type { LearningPolicyReader } from './learning-policy.js';
import {
  isTerminal,
  newLearningId,
  type CandidateRecord,
  type EntryRecord,
  type LearningStore,
  type StatusEventRecord,
  type VersionRecord,
} from './learning.store.js';
import type { AuditEntry, LearningPorts, ResolutionView } from './learning.tokens.js';

export interface ApplyResult {
  readonly state: string;
  readonly reason?: string;
  readonly entryId?: string;
  readonly versionId?: string;
  readonly version?: number;
}

/** What happens after knowledge commits — the attestation (`T2357`) and the reindex (`T2377`). */
export interface AfterMaterialise {
  (input: { candidate: CandidateRecord; version: VersionRecord | null; deprecated: VersionRecord | null; resolution: ResolutionView; verdict: Verdict & { accepted: true } }): Promise<void>;
}

export interface MaterialiserDeps {
  readonly store: LearningStore;
  readonly writer: KnowledgeWriter;
  readonly ports: Pick<LearningPorts, 'audit'>;
  readonly policy: LearningPolicyReader;
  readonly guard: ApproverGuard;
  readonly now?: () => Date;
  readonly after?: readonly AfterMaterialise[];
}

/** sha256 of the canonical approved version — the attested subject (`R-048-19`). */
export function versionDigest(v: Pick<VersionRecord, 'entryId' | 'version' | 'statement' | 'scope' | 'classification'>): string {
  const scope = { kind: v.scope.kind, projectIds: [...v.scope.projectIds].sort() };
  return createHash('sha256').update(JSON.stringify([v.entryId, v.version, v.statement, scope, v.classification])).digest('hex');
}

export class Materialiser {
  private readonly now: () => Date;

  constructor(private readonly deps: MaterialiserDeps) {
    this.now = deps.now ?? ((): Date => new Date());
  }

  async applyResolution(workspaceId: string, candidateId: string, resolution: ResolutionView | null): Promise<ApplyResult> {
    const { store } = this.deps;
    const candidate = await store.candidate(workspaceId, candidateId);
    if (candidate === null) throw new ConflictError(`No candidate ${candidateId} in this workspace.`);
    const current = await store.currentTransition(workspaceId, candidateId);
    if (current !== null && isTerminal(current.state)) return this.terminal(candidate, current.state);
    if (resolution === null) return { state: current?.state ?? 'proposed' };

    if (resolution.outcome === 'refused' || resolution.outcome === 'exception') return this.close(candidate, resolution);

    const corroborations = await store.corroborations(workspaceId, candidateId);
    const verdict = await this.deps.guard.judge({ candidate, corroborations, resolution });
    if (!verdict.accepted) return this.returnToProposed(candidate, resolution, verdict);

    return this.write(candidate, resolution, verdict);
  }

  private async terminal(candidate: CandidateRecord, state: string): Promise<ApplyResult> {
    if (state !== 'approved') return { state };
    const v = await this.deps.store.versionForCandidate(candidate.workspaceId, candidate.id);
    return v === null ? { state } : { state, entryId: v.entryId, versionId: v.id, version: v.version };
  }

  /** `A-031-1` closures, and a policy refusal. */
  private async close(candidate: CandidateRecord, resolution: ResolutionView): Promise<ApplyResult> {
    const closure = resolution.closure;
    const at = this.now();
    if (closure === undefined) {
      await this.append(candidate, 'proposed', resolution.outcome === 'refused' ? 'decision-refused-by-policy' : 'decision-exception', resolution.decisionId, 'platform', 'learning-intake', at);
      return { state: 'proposed', reason: 'decision-refused-by-policy' };
    }
    if (closure.kind === 'rejected') {
      // FR-LRN-029 — retained with its reviewer and reason; never deleted.
      await this.append(candidate, 'rejected', closure.reason, resolution.decisionId, 'human', resolution.decidedBy, at);
      return { state: 'rejected', reason: closure.reason };
    }
    await this.append(candidate, closure.kind, closure.reason, resolution.decisionId, 'platform', 'learning-intake', at);
    return { state: closure.kind, reason: closure.reason };
  }

  /** `R-048-6` as amended for `I1`: not accepted ⇒ back to `proposed`, flagged, audited. */
  private async returnToProposed(candidate: CandidateRecord, resolution: ResolutionView, verdict: Verdict & { accepted: false }): Promise<ApplyResult> {
    const at = this.now();
    await this.deps.ports.audit.record({
      workspaceId: candidate.workspaceId,
      actorId: null,
      action: 'access_refused',
      targetType: 'learning_candidate',
      targetId: candidate.id,
      outcome: 'refused',
      detail: { decisionId: resolution.decisionId, resolvingDecisionId: resolution.resolvingDecisionId, decidedBy: resolution.decidedBy, reason: verdict.reason, detail: verdict.detail },
    });
    await this.deps.store.transaction(async (tx) => {
      await tx.appendTransition({ workspaceId: candidate.workspaceId, candidateId: candidate.id, state: 'proposed', reason: verdict.reason, decisionId: resolution.decisionId, actorKind: 'platform', actorId: 'learning-intake', at });
      await tx.appendFlag({ id: newLearningId('kf'), workspaceId: candidate.workspaceId, versionId: null, candidateId: candidate.id, kind: verdict.reason, detail: verdict.detail, raisedAt: at, clearsFlagId: null });
    });
    return { state: 'proposed', reason: verdict.reason };
  }

  private async write(candidate: CandidateRecord, resolution: ResolutionView, verdict: Verdict & { accepted: true }): Promise<ApplyResult> {
    const { store } = this.deps;
    const ws = candidate.workspaceId;
    const at = this.now();
    const terms = await store.reviewTerms(ws, candidate.id, resolution.decisionId);
    const policyState = await this.deps.policy.current(ws);
    const categoryDefault = policyState.state === 'ok' ? policyState.policy.category(candidate.category)?.defaultClassification : undefined;
    const target = candidate.targetVersionId === null ? null : await store.version(ws, candidate.targetVersionId);
    if (candidate.kind !== 'new' && target === null) throw new ConflictError(`Candidate ${candidate.id} targets a version that does not exist.`);

    const audit: AuditEntry[] = [];
    const auditOf = (targetId: string, action: AuditEntry['action'], change: string): AuditEntry => ({
      workspaceId: ws,
      // A policy approval is the intake automation's act on EPIC-031's decision.
      actorId: verdict.approvedByKind === 'human' ? verdict.approvedBy : 'learning-intake',
      action,
      targetType: 'knowledge_entry_version',
      targetId,
      outcome: 'success',
      detail: { change, candidateId: candidate.id, kind: candidate.kind, decisionId: resolution.decisionId, resolvingDecisionId: resolution.resolvingDecisionId, approvedByKind: verdict.approvedByKind },
    });

    let entry: EntryRecord | null = null;
    let version: VersionRecord | null = null;
    const statusEvents: StatusEventRecord[] = [];
    const status = (versionId: string, s: StatusEventRecord['status'], extra: Partial<StatusEventRecord> = {}): StatusEventRecord => ({
      id: newLearningId('kse'),
      workspaceId: ws,
      versionId,
      status: s,
      successorVersionId: null,
      reason: null,
      actorId: verdict.approvedBy,
      decisionId: resolution.decisionId,
      candidateId: candidate.id,
      at,
      ...extra,
    });

    if (candidate.kind === 'deprecate') {
      // FR-LRN-033 — reason, actor and instant; no new version.
      statusEvents.push(status(target!.id, 'deprecated', { reason: candidate.statement }));
      audit.push(auditOf(target!.id, 'update', 'deprecated'));
    } else {
      let entryId: string;
      let number = 1;
      if (candidate.kind === 'new') {
        entry = { id: newLearningId('ke'), workspaceId: ws, category: candidate.category, subjectKey: candidate.subjectKey, originProjectId: candidate.projectId, createdAt: at };
        entryId = entry.id;
      } else {
        entryId = target!.entryId;
        number = Math.max(...(await store.versionsOfEntry(ws, entryId)).map((v) => v.version)) + 1;
      }
      const widening = candidate.kind === 'widen-scope';
      version = {
        id: newLearningId('kv'),
        workspaceId: ws,
        entryId,
        version: number,
        // A widening changes scope, not content: the entry's statement carries over.
        statement: terms?.approvedStatement ?? (widening ? target!.statement : candidate.statement),
        proposedStatement: widening ? target!.statement : candidate.statement,
        scope: terms?.approvedScope ?? candidate.claimedScope,
        proposedScope: candidate.claimedScope,
        classification: terms?.classification ?? (widening ? target!.classification : undefined) ?? categoryDefault ?? 'undetermined',
        candidateId: candidate.id,
        decisionId: resolution.decisionId,
        resolvingDecisionId: resolution.resolvingDecisionId,
        approvedByKind: verdict.approvedByKind,
        approvedBy: verdict.approvedBy,
        approvedAt: at,
      };
      statusEvents.push(status(version.id, 'current'));
      audit.push(auditOf(version.id, 'create', 'materialised'));
      if (target !== null) {
        // FR-LRN-032 — the predecessor names its successor, in the same transaction.
        statusEvents.push(status(target.id, 'superseded', { successorVersionId: version.id }));
        audit.push(auditOf(target.id, 'update', widening ? 'scope-widened' : 'superseded'));
      }
    }

    const m: Materialisation = {
      workspaceId: ws,
      candidateId: candidate.id,
      entry,
      version,
      statusEvents,
      transition: { decisionId: resolution.decisionId, actorKind: verdict.approvedByKind, actorId: verdict.approvedBy, reason: null, at },
      audit,
    };
    let outcome;
    try {
      outcome = await this.deps.writer.insertVersion(m);
    } catch (err) {
      if (err instanceof ConflictError && /not current/.test(err.message)) {
        // Another decision superseded or deprecated the target first. The
        // candidate waits as proposed, saying why, rather than acting on history.
        await this.append(candidate, 'proposed', 'target-not-current', resolution.decisionId, 'platform', 'learning-intake', at);
        return { state: 'proposed', reason: 'target-not-current' };
      }
      throw err;
    }
    if (outcome === 'already-terminal') {
      const now = await store.currentTransition(ws, candidate.id);
      return this.terminal(candidate, now?.state ?? 'approved');
    }

    for (const after of this.deps.after ?? []) {
      await after({ candidate, version, deprecated: candidate.kind === 'deprecate' ? target : null, resolution, verdict });
    }
    const result = version ?? target!;
    return { state: 'approved', entryId: result.entryId, versionId: result.id, version: result.version };
  }

  private async append(candidate: CandidateRecord, state: 'proposed' | 'rejected' | 'expired' | 'withdrawn', reason: string | null, decisionId: string | null, actorKind: 'human' | 'platform', actorId: string, at: Date): Promise<void> {
    await this.deps.store.transaction((tx) => tx.appendTransition({ workspaceId: candidate.workspaceId, candidateId: candidate.id, state, reason, decisionId, actorKind, actorId, at }));
  }
}
