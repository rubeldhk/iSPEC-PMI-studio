/**
 * `T2312` (EPIC-048) — the eleven ports, and what each absence does
 * (`contracts/learning-contract.md` §5, `R-048-20`).
 *
 * Four of the owners are unmerged branches (`EPIC-031`, `EPIC-032`, `EPIC-038`,
 * `EPIC-047`). Their ports are bound **refusing** here and their adapters are one
 * task phase, last, blocked on merge. Route tests that need a decision or
 * evidence override the ports with in-test bindings that record every call,
 * visibly in the test; the module default stays refusing.
 *
 * **Every absent port fails closed.** None of them makes something approved,
 * supplied or trusted (`FR-GEL-062`: a default that permits is invisible).
 *
 * Framework-free (PC-1).
 */
import { GovernanceSeamUnboundError } from '../../core/errors.js';
import type {
  ClaimedScope,
  KnowledgeAdmission,
  LearningCandidateRecorded,
  RiskBand,
} from '@pmi/learning-contract';
import { UNBOUND_ADMISSION_VERDICT } from '@pmi/learning-contract';

// ------------------------------------------------------------------ shapes

/** `EPIC-037` — what this Epic needs to know about a source execution. */
export interface ExecutionFacts {
  readonly executionId: string;
  readonly workspaceId: string;
  /** The project the execution is bound to; `null` when the registry holds none. */
  readonly projectId: string | null;
  readonly governanceState: 'provisional' | 'pending_sync' | 'governed';
  /** The first terminal lifecycle event, when there is one (`FR-LRN-005`). */
  readonly terminal: { readonly type: string; readonly at: string } | null;
  /** Governance events that mark the execution invalid (`R-048-17`); empty when none. */
  readonly invalidatedBy: readonly string[];
}

export interface ExecutionsPort {
  describe(workspaceId: string, executionId: string): Promise<ExecutionFacts | null>;
  appendLearningEvent(input: {
    readonly workspaceId: string;
    readonly executionId: string;
    readonly payload: LearningCandidateRecorded;
    readonly idempotencyKey: string;
    readonly emittedBy: string;
  }): Promise<void>;
}

/** `EPIC-037` `secretRuleMatching` (`R-048-18`) — the rule and the field, never the value. */
export interface SecretScreenPort {
  screen(fields: Readonly<Record<string, string>>): Promise<{ readonly rule: string; readonly field: string } | null>;
}

/** `EPIC-028` — `human` only when the id resolves to a `User` and to no `NonHumanPrincipal`. */
export type PrincipalKind = 'human' | 'agent' | 'service' | 'connector';
export interface PrincipalsPort {
  kindOf(workspaceId: string, principalOrUserId: string): Promise<PrincipalKind | null>;
}

/** `EPIC-024` through `EPIC-032`'s `AccessControlEvidencePolicy` (`R-048-9`). */
export interface ReaderAccessPort {
  canRead(reader: { readonly workspaceId: string; readonly userId: string }, target: { readonly type: string; readonly id: string }): Promise<boolean>;
}

/** `EPIC-019` steering, subject `learning_policy` (`R-048-3`). */
export interface LearningPolicyDocument {
  readonly documentId: string;
  readonly version: number;
  readonly content: string;
  readonly actorId: string;
  readonly at: string;
}
export interface LearningPolicySourcePort {
  current(workspaceId: string): Promise<LearningPolicyDocument | null>;
}

/** `EPIC-004` `AuditService.record` — `tx` lets a writer commit the entry with the action. */
export interface AuditEntry {
  readonly workspaceId: string;
  readonly actorId: string | null;
  readonly action: 'create' | 'update' | 'lifecycle_transition' | 'access_refused';
  readonly targetType: string;
  readonly targetId?: string;
  readonly outcome: 'success' | 'refused' | 'failed';
  readonly detail?: Record<string, unknown>;
}
export interface AuditPort {
  record(entry: AuditEntry, tx?: unknown): Promise<void>;
}

/** `EPIC-031` — the decision path (`R-048-5`). Shapes mirror `packages/decision-contract`. */
export interface LearningDecisionRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly actionType: string;
  readonly target: { readonly type: 'learning-candidate'; readonly id: string };
  readonly objectVersion: string;
  readonly actor: { readonly kind: 'automation'; readonly id: 'learning-intake' };
  readonly proposedClass?: RiskBand;
  readonly requiredGates: readonly [];
  readonly requestedBy: string;
  readonly triggeredBy: { readonly ruleId: 'learning.candidate-submitted'; readonly eventId: string };
}

export type DecisionOutcome = 'pending' | 'auto-executed' | 'approved' | 'refused' | 'exception';

export interface DecisionExplanation {
  readonly policyVersion: string;
  readonly matchedRule: string | null;
  readonly riskClass: RiskBand;
  readonly authorityApplied: string;
  readonly summary?: string;
}

/** The decision as requested — and, when it was settled on the spot, as resolved. */
export interface DecisionView {
  readonly decisionId: string;
  readonly outcome: DecisionOutcome;
  readonly effectiveClass: RiskBand;
  readonly actionType: string;
  readonly explanation: DecisionExplanation;
}

/** How a requested decision was resolved — by itself (automatic) or by a resolving row. */
export interface ResolutionView {
  /** The decision this Epic requested. */
  readonly decisionId: string;
  /** The row that resolved it; `null` when the request itself was decided on the spot. */
  readonly resolvingDecisionId: string | null;
  readonly outcome: Exclude<DecisionOutcome, 'pending'>;
  readonly actorKind: 'human' | 'automation';
  readonly decidedBy: string;
  readonly actionType: string;
  readonly requestedBy: string | null;
  /** `A-031-1` — present when a pending decision was closed without approval. */
  readonly closure?: { readonly kind: 'rejected' | 'withdrawn' | 'expired'; readonly reason: string };
  readonly effectiveClass: RiskBand;
  readonly explanation: DecisionExplanation;
}

export interface LearningDecisionsPort {
  decide(request: LearningDecisionRequest): Promise<DecisionView>;
  approve(input: { readonly workspaceId: string; readonly decisionId: string; readonly approver: { readonly kind: 'human'; readonly id: string } }): Promise<ResolutionView>;
  refuse(input: {
    readonly workspaceId: string;
    readonly decisionId: string;
    readonly by: { readonly kind: 'human' | 'automation'; readonly id: string };
    readonly kind: 'rejected' | 'withdrawn' | 'expired';
    readonly reason: string;
  }): Promise<ResolutionView>;
  /** `A-031-3` — `null` while the decision is pending. */
  resolutionOf(workspaceId: string, decisionId: string): Promise<ResolutionView | null>;
}

/** `EPIC-032` `EvidenceService.resolve` (`A-032-1`, `R-048-8`). Absent id ⇒ absent from the map. */
export interface ResolvedEvidence {
  readonly evidenceId: string;
  readonly integrity: 'valid' | 'failed';
  readonly resolution: 'resolved' | 'unresolvable';
  /** The stored subject digest the citation is compared to. */
  readonly subjectDigest: string;
  readonly predicateType: string;
  readonly attestedArtifact: { readonly id: string; readonly version?: string | number } | null;
  readonly attestedTarget: { readonly type: string; readonly id: string };
}
export interface EvidenceReadsPort {
  resolve(workspaceId: string, evidenceIds: readonly string[]): Promise<ReadonlyMap<string, ResolvedEvidence>>;
}

/** `EPIC-032` `EvidenceService.contribute` with the `approval/v1` predicate (`R-048-19`). */
export interface ApprovalAttestationInput {
  readonly workspaceId: string;
  /** `https://pmi.studio/attestation/approval/v1` — no new predicate type (spec Assumption 4). */
  readonly predicateType: string;
  /** The platform-source branch of `EPIC-032`'s contribute. */
  readonly sourceUri: 'pmi:learning';
  readonly attachedTo: { readonly type: 'decision'; readonly id: string };
  readonly attestedArtifact: { readonly id: string; readonly version: number };
  readonly decisionId: string;
  readonly resolvingDecisionId: string | null;
  readonly candidateId: string;
  readonly entryId: string;
  readonly entryVersionId: string;
  readonly versionNumber: number;
  readonly outcome: 'approved' | 'auto-executed';
  readonly approvedByKind: 'human' | 'policy';
  readonly approvedBy: string;
  readonly policyVersion: string;
  readonly matchedRule: string | null;
  readonly effectiveClass: RiskBand;
  readonly subjectDigest: string;
}
export interface ApprovalAttestationsPort {
  contribute(input: ApprovalAttestationInput): Promise<{ readonly evidenceId: string }>;
}

/** `EPIC-038` `IndexService.reindex` (`R-048-13`). */
export interface KnowledgeIndexPort {
  reindex(input: { readonly workspaceId: string; readonly entryId: string; readonly versionId: string }): Promise<{ readonly outcome: 'indexed' | 'current' | 'not-resolvable' }>;
}

/** `EPIC-047` (`A-047-2`) — `null` when the execution is not an Expert session. */
export interface ExpertFacts {
  readonly expertId: string;
  readonly contractVersionId: string;
  readonly contractVersion: number;
  readonly memoryPolicy: string;
}
export interface ExpertProvenancePort {
  forExecution(workspaceId: string, executionId: string): Promise<ExpertFacts | null>;
}

/**
 * `EPIC-006` — a project's existence and status. Not one of the contract's eleven:
 * added because `FR-LRN-014` (`projects` names projects of the workspace) and
 * `FR-LRN-046` (archived projects) need it, and `ProjectsService` is on `main`.
 */
export interface ProjectsPort {
  find(workspaceId: string, projectId: string): Promise<{ readonly id: string; readonly status: 'active' | 'archived' } | null>;
}

/**
 * Mutable on purpose: a route test rebinds one member to an in-test recorder,
 * visibly, and every service reads the member at call time (`R-048-20`).
 */
export interface LearningPorts {
  executions: ExecutionsPort;
  secrets: SecretScreenPort;
  principals: PrincipalsPort;
  readerAccess: ReaderAccessPort;
  policy: LearningPolicySourcePort;
  audit: AuditPort;
  decisions: LearningDecisionsPort;
  evidence: EvidenceReadsPort;
  attestations: ApprovalAttestationsPort;
  index: KnowledgeIndexPort;
  experts: ExpertProvenancePort;
  projects: ProjectsPort;
}

// --------------------------------------------------------------- the table

export type AbsentBehaviour = 'refuse' | 'withhold' | 'stay-proposed' | 'flag' | 'not-yet-retrievable';

export interface LearningPortDescriptor {
  readonly name: string;
  readonly filledBy: string;
  readonly absent: AbsentBehaviour;
  readonly because: string;
}

export const LEARNING_PORTS: readonly LearningPortDescriptor[] = Object.freeze([
  { name: 'Executions', filledBy: 'EPIC-037 ExecutionRegistryFacade (snapshot, history, appendEvent)', absent: 'refuse', because: 'an unverifiable source is no source (FR-LRN-005); a candidate whose execution cannot be checked is refused' },
  { name: 'SecretScreen', filledBy: 'EPIC-037 secretRuleMatching (R-048-18)', absent: 'refuse', because: 'an unscreened submission is not stored (FR-LRN-018): a secret written to an append-only table cannot be removed' },
  { name: 'Principals', filledBy: 'EPIC-028 principal registry and the users directory', absent: 'refuse', because: 'an approver whose kind is unknown is not a human (FR-LRN-027); review is refused rather than assumed human' },
  { name: 'ReaderAccess', filledBy: 'EPIC-024 through EPIC-032 AccessControlEvidencePolicy', absent: 'withhold', because: 'unreadable is the safe reading (FR-LRN-016); every citation is withheld rather than shown to someone who may not see it' },
  { name: 'LearningPolicySource', filledBy: 'EPIC-019 steering, subject learning_policy', absent: 'refuse', because: 'no policy means no categories, so no candidate can name one (FR-LRN-003); nothing is low-risk by default (FR-LRN-026)' },
  { name: 'Audit', filledBy: 'EPIC-004 AuditService.record', absent: 'refuse', because: 'a decision, supersession, deprecation or scope change that cannot be audited is not made (FR-LRN-062)' },
  { name: 'LearningDecisions', filledBy: 'EPIC-031 DecisionEngine decide/approve/refuse/resolutionOf', absent: 'stay-proposed', because: 'an unreachable decision path is never an approval (FR-LRN-030); the candidate stays proposed and the review route answers 503' },
  { name: 'EvidenceReads', filledBy: 'EPIC-032 EvidenceService.resolve (A-032-1)', absent: 'refuse', because: 'evidence is mandatory (FR-LRN-012) and unresolvable evidence is ineligible, so a submission is refused 503 rather than recorded unverified' },
  { name: 'ApprovalAttestations', filledBy: 'EPIC-032 EvidenceService.contribute', absent: 'flag', because: 'the approval is decided and audited by EPIC-031; a missing attestation is flagged attestation-missing and retried (R-048-19)' },
  { name: 'KnowledgeIndex', filledBy: 'EPIC-038 IndexService.reindex', absent: 'not-yet-retrievable', because: 'an entry not indexed is recorded not yet retrievable with the reason, never reported available (FR-LRN-053)' },
  { name: 'ExpertProvenance', filledBy: 'EPIC-047 ExpertProvenance.forExecution (A-047-2)', absent: 'refuse', because: 'an execution that may be an Expert session cannot be judged against its memory policy (FR-LRN-055); its submission is refused 503 and no knowledge is admitted to its package' },
].map((p) => Object.freeze(p as LearningPortDescriptor)));

// ------------------------------------------------------ refusing bindings

function unbound(port: string, owner: string): GovernanceSeamUnboundError {
  return new GovernanceSeamUnboundError(
    `${port} is not bound: ${owner} supplies it, and EPIC-048 binds it in its adapter phase (R-048-20). ` +
      'Refusing rather than answering permissively.',
  );
}

/** Every port bound to its refusal. The module default for the unmerged four; tests start here. */
export function refusingPorts(): LearningPorts {
  return {
    executions: {
      describe: async () => { throw unbound('Executions', 'EPIC-037'); },
      appendLearningEvent: async () => { throw unbound('Executions', 'EPIC-037'); },
    },
    secrets: { screen: async () => { throw unbound('SecretScreen', 'EPIC-037'); } },
    principals: { kindOf: async () => { throw unbound('Principals', 'EPIC-028'); } },
    readerAccess: { canRead: async () => false },
    policy: { current: async () => null },
    audit: { record: async () => { throw unbound('Audit', 'EPIC-004'); } },
    decisions: {
      decide: async () => { throw unbound('LearningDecisions', 'EPIC-031'); },
      approve: async () => { throw unbound('LearningDecisions', 'EPIC-031'); },
      refuse: async () => { throw unbound('LearningDecisions', 'EPIC-031 (A-031-1)'); },
      resolutionOf: async () => { throw unbound('LearningDecisions', 'EPIC-031 (A-031-3)'); },
    },
    evidence: { resolve: async () => { throw unbound('EvidenceReads', 'EPIC-032 (A-032-1)'); } },
    attestations: { contribute: async () => { throw unbound('ApprovalAttestations', 'EPIC-032'); } },
    index: { reindex: async () => { throw unbound('KnowledgeIndex', 'EPIC-038 (no embedding provider is bound either, R-048-13)'); } },
    experts: { forExecution: async () => { throw unbound('ExpertProvenance', 'EPIC-047 (A-047-1, A-047-2)'); } },
    projects: { find: async () => { throw unbound('Projects', 'EPIC-006'); } },
  };
}

/** `contracts/learning-contract.md` §3 — the admission answer when none is bound. */
export const unboundAdmission: KnowledgeAdmission = {
  async admit(candidates) {
    return candidates.map(() => UNBOUND_ADMISSION_VERDICT);
  },
};

// ------------------------------------------------------------ DI tokens

export const LEARNING_PORTS_TOKEN = Symbol('LEARNING_PORTS');
export const LEARNING_STORE = Symbol('LEARNING_STORE');
export const KNOWLEDGE_WRITER = Symbol('KNOWLEDGE_WRITER');

/** The scope helper is re-exported here so services import one place. */
export type { ClaimedScope };
