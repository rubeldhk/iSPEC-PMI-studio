/**
 * `T2345` (EPIC-048, `FR-LRN-071`, `FR-LRN-072`, `SC-LRN-006`) — one candidate,
 * everything a reviewer needs, in one response.
 *
 * This is what the Decision Inbox detail renderer shows (`LearningCandidateDetail`,
 * `T2379`): statement, category, source session, evidence with its state,
 * confidence and basis, claimed scope, corroborations, and any entry it
 * supersedes (side by side) or conflicts with — without opening another screen.
 *
 * The decision's content is **read from `EPIC-031`** on demand, never copied
 * (`FR-LRN-021`). While that port is unbound the view says so rather than
 * inventing an outcome.
 *
 * Framework-free (PC-1).
 */
import { NotFoundError } from '../../core/errors.js';
import { EvidenceView, type ShownCitation } from './evidence.view.js';
import type { CandidateRecord, CorroborationRecord, LearningReads, TransitionRecord } from './learning.store.js';
import type { LearningPorts } from './learning.tokens.js';
import { findConflict, type Eligibility } from './submission.service.js';

export interface CandidateDecisionView {
  readonly decisionId: string;
  readonly outcome?: string;
  readonly effectiveClass?: string;
  readonly explanation?: unknown;
  readonly unavailable?: string;
}

export interface CandidateViewBody {
  readonly candidate: CandidateRecord & { readonly state: string; readonly transitions: readonly TransitionRecord[] };
  readonly evidence: readonly ShownCitation[];
  readonly withheldEvidenceCount: number;
  readonly corroborations: readonly (CorroborationRecord & { readonly evidence: readonly ShownCitation[] })[];
  readonly source:
    | { readonly kind: 'execution'; readonly executionId: string; readonly principalId: string; readonly expert?: { readonly id: string; readonly contractVersionId: string; readonly contractVersion: number } }
    | { readonly kind: 'person'; readonly userId: string };
  readonly conflictsWith?: { readonly entryId: string; readonly versionId: string; readonly version: number; readonly statement: string };
  readonly supersedes?: { readonly entryId: string; readonly versionId: string; readonly version: number; readonly statement: string; readonly scope: unknown; readonly classification: string; readonly status: string };
  readonly decision?: CandidateDecisionView;
  readonly eligibility?: Eligibility;
  readonly flags: readonly { readonly kind: string; readonly detail: string; readonly raisedAt: Date; readonly open: boolean }[];
}

export interface CandidateViewDeps {
  readonly reads: LearningReads;
  readonly ports: Pick<LearningPorts, 'evidence' | 'readerAccess' | 'decisions'>;
  /** Wired by the module once eligibility exists (`T2347`); absent ⇒ omitted. */
  readonly eligibilityOf?: (candidate: CandidateRecord) => Promise<Eligibility>;
}

export class CandidateViewService {
  private readonly evidence: EvidenceView;

  constructor(private readonly deps: CandidateViewDeps) {
    this.evidence = new EvidenceView(deps.ports);
  }

  async view(workspaceId: string, reader: { workspaceId: string; userId: string }, candidateId: string): Promise<CandidateViewBody> {
    const { reads } = this.deps;
    const candidate = await reads.candidate(workspaceId, candidateId);
    // Another workspace's candidate is absent, not forbidden (FR-LRN-008).
    if (candidate === null) throw new NotFoundError('Not found.');

    const transitions = await reads.transitions(workspaceId, candidateId);
    const current = transitions[transitions.length - 1];
    const citations = await reads.citations(workspaceId, candidateId);
    const own = citations.filter((c) => c.corroborationId === null);
    const shown = await this.evidence.forReader(workspaceId, reader, own);

    let withheld = shown.withheldEvidenceCount;
    const corroborations = [];
    for (const co of await reads.corroborations(workspaceId, candidateId)) {
      const theirs = await this.evidence.forReader(workspaceId, reader, citations.filter((c) => c.corroborationId === co.id));
      withheld += theirs.withheldEvidenceCount;
      corroborations.push({ ...co, evidence: theirs.citations });
    }

    const conflict = await findConflict(reads, candidate);
    const supersedes = await this.target(workspaceId, candidate);
    const decisionId = [...transitions].reverse().find((t) => t.decisionId !== null)?.decisionId ?? null;
    const flags = await reads.flags(workspaceId, { candidateId });
    const cleared = new Set(flags.map((f) => f.clearsFlagId).filter((id): id is string => id !== null));

    return {
      candidate: { ...candidate, state: current?.state ?? 'proposed', transitions },
      evidence: shown.citations,
      withheldEvidenceCount: withheld,
      corroborations,
      source:
        candidate.sourceKind === 'person'
          ? { kind: 'person', userId: candidate.sourcePrincipalId }
          : {
              kind: 'execution',
              executionId: candidate.executionId!,
              principalId: candidate.sourcePrincipalId,
              ...(candidate.expertId !== null
                ? { expert: { id: candidate.expertId, contractVersionId: candidate.expertContractVersionId!, contractVersion: candidate.expertContractVersion! } }
                : {}),
            },
      ...(conflict !== null ? { conflictsWith: conflict } : {}),
      ...(supersedes !== null ? { supersedes } : {}),
      ...(decisionId !== null ? { decision: await this.decision(workspaceId, decisionId) } : {}),
      ...(this.deps.eligibilityOf !== undefined ? { eligibility: await this.deps.eligibilityOf(candidate) } : {}),
      flags: flags.filter((f) => f.clearsFlagId === null).map((f) => ({ kind: f.kind, detail: f.detail, raisedAt: f.raisedAt, open: !cleared.has(f.id) })),
    };
  }

  /** `FR-LRN-072` — the version a supersede, deprecate or widen-scope candidate acts on. */
  private async target(workspaceId: string, candidate: CandidateRecord): Promise<CandidateViewBody['supersedes'] | null> {
    if (candidate.targetVersionId === null) return null;
    const version = await this.deps.reads.version(workspaceId, candidate.targetVersionId);
    if (version === null) return null;
    const status = await this.deps.reads.currentStatus(workspaceId, version.id);
    return {
      entryId: version.entryId,
      versionId: version.id,
      version: version.version,
      statement: version.statement,
      scope: version.scope,
      classification: version.classification,
      status: status?.status ?? 'current',
    };
  }

  /** Read from `EPIC-031` (`FR-LRN-021`, `FR-LRN-024`); never copied. */
  private async decision(workspaceId: string, decisionId: string): Promise<CandidateDecisionView> {
    try {
      const resolution = await this.deps.ports.decisions.resolutionOf(workspaceId, decisionId);
      if (resolution === null) return { decisionId, outcome: 'pending' };
      return { decisionId, outcome: resolution.outcome, effectiveClass: resolution.effectiveClass, explanation: resolution.explanation };
    } catch (err) {
      return { decisionId, unavailable: err instanceof Error ? err.message : 'the decision path is unavailable' };
    }
  }
}
