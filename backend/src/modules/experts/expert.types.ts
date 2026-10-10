/**
 * `T1904` (EPIC-047) — the Engineering Expert vocabulary.
 *
 * Every constant here encodes a decision, so that widening it is an edit
 * somebody makes on purpose:
 *
 * - `RISK_BANDS` is `EPIC-031`'s band (`R-047-6`). Declared locally only until
 *   `packages/decision-contract` is on `main`; `T1977` asserts the two agree.
 * - `MEMORY_POLICIES` admits `none` (`FR-EXP-020`, clarified 2026-10-09) and
 *   `governed-knowledge` (amendment `A-047-1`). Cross-session memory belongs to
 *   Governed Learning (`EPIC-048`), never to a private store here.
 * - `ContractVersion` has **no status**. Approval is `EPIC-031`'s decision,
 *   read when needed (`R-047-5`); a cached *approved* that was later refused is
 *   the divergence this programme keeps finding.
 */
import type { AgentCapability } from '@pmi/agent-contract';

export const RISK_BANDS = ['low', 'medium', 'high'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const LIMIT_KINDS = ['time', 'resource', 'tokens', 'cost'] as const;
export type LimitKind = (typeof LIMIT_KINDS)[number];

export const UNENFORCEABLE_POSTURES = ['refuse', 'proceed'] as const;
export type UnenforceablePosture = (typeof UNENFORCEABLE_POSTURES)[number];

/**
 * `FR-EXP-020` — `none`, and by amendment `A-047-1` (2026-10-09, for `EPIC-048`)
 * `governed-knowledge`: learning candidates go to Governed Learning, approved
 * knowledge comes back only through context, and no private memory is granted.
 * This Epic does no learning for either value.
 */
export const MEMORY_POLICIES = ['none', 'governed-knowledge'] as const;
export type MemoryPolicy = (typeof MEMORY_POLICIES)[number];

/**
 * `FR-EXP-043` — the clarified default where a contract states no posture:
 * money fails safe, time and resource proceed and record the gap.
 */
export function defaultPosture(limit: LimitKind): UnenforceablePosture {
  return limit === 'tokens' || limit === 'cost' ? 'refuse' : 'proceed';
}

export interface ModelChoice {
  readonly preferred: string;
  readonly fallbacks: readonly string[];
}

/** `R-047-10` — the subset of `EPIC-038`'s assembly input an Expert fixes. */
export interface ContextPolicy {
  readonly budgetTokens: number;
  readonly budgetCost: number;
  readonly includeLiveState: boolean;
  readonly essentialSources?: readonly { readonly sourceType: string; readonly sourceId: string }[];
}

export interface WorkspaceRequirements {
  readonly executionType?: 'headless' | 'interactive';
  readonly repositoryAccess?: readonly ('read' | 'commit' | 'push' | 'pull-request')[];
  readonly supportsUnattended?: boolean;
}

/** `R-047-9` — what the Expert may touch, before the actor's own grants are intersected. */
export interface PermissionGrant {
  readonly artifactType: string;
  readonly action: 'read' | 'edit';
}

export interface LimitSetting {
  readonly value: number;
  /** Absent → `defaultPosture(limit)`. */
  readonly onUnenforceable?: UnenforceablePosture;
}

/** `FR-EXP-040` — `resource` is the maximum number of tool calls in a session. */
export interface Budget {
  readonly time: LimitSetting;
  readonly resource?: LimitSetting;
  readonly tokens?: LimitSetting;
  readonly cost?: LimitSetting;
}

export interface ExpectedOutput {
  readonly kind: string;
  readonly required: boolean;
}

/** `R-047-11` — `EPIC-032`'s package identity, referenced, never restated. */
export interface EvidenceContractRef {
  readonly workClass: string;
  readonly contractVersion: number;
}

/** `BR-0102` — the contract. Every field required; `delegatesTo` empty means "may not delegate". */
export interface ExpertContract {
  readonly rolePurpose: string;
  readonly models: ModelChoice;
  readonly capabilities: readonly AgentCapability[];
  readonly allowedTools: readonly string[];
  readonly contextPolicy: ContextPolicy;
  readonly workspaceRequirements: WorkspaceRequirements;
  readonly permissions: readonly PermissionGrant[];
  readonly prohibitedActions: readonly string[];
  readonly riskClass: RiskBand;
  readonly budget: Budget;
  readonly memoryPolicy: MemoryPolicy;
  readonly expectedOutputs: readonly ExpectedOutput[];
  readonly evidenceContract: EvidenceContractRef;
  readonly delegatesTo: readonly string[];
}

/**
 * `BR-0102`'s twelve elements, each mapped to the contract fields that carry it.
 * "Allowed tools and capabilities" is one element and two fields.
 */
export const CONTRACT_ELEMENTS: readonly { readonly element: string; readonly fields: readonly (keyof ExpertContract)[] }[] =
  Object.freeze([
    { element: 'role and purpose', fields: ['rolePurpose'] },
    { element: 'preferred and fallback models', fields: ['models'] },
    { element: 'allowed tools and capabilities', fields: ['allowedTools', 'capabilities'] },
    { element: 'context policy', fields: ['contextPolicy'] },
    { element: 'workspace requirements', fields: ['workspaceRequirements'] },
    { element: 'permissions', fields: ['permissions'] },
    { element: 'prohibited actions', fields: ['prohibitedActions'] },
    { element: 'risk class', fields: ['riskClass'] },
    { element: 'budget', fields: ['budget'] },
    { element: 'memory policy', fields: ['memoryPolicy'] },
    { element: 'expected outputs', fields: ['expectedOutputs'] },
    { element: 'Evidence Contract', fields: ['evidenceContract'] },
  ]);

export type ExpertStatus = 'active' | 'retired';

export interface EngineeringExpert {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly name: string;
  readonly status: ExpertStatus;
  readonly registeredBy: string;
  readonly registeredAt: string;
  readonly retiredBy: string | null;
  readonly retiredAt: string | null;
}

/** Immutable after insert, except `decisionId`, written once (`R-047-14`). No status: see the header. */
export interface ContractVersion {
  readonly id: string;
  readonly workspaceId: string;
  readonly expertId: string;
  readonly version: number;
  readonly contract: ExpertContract;
  readonly decisionId: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

/** Derived at read (`R-047-5`), never stored. */
export type VersionStatus = 'draft' | 'submitted' | 'approved' | 'refused';

export interface DelegationPolicy {
  readonly workspaceId: string;
  readonly maxDepth: number;
  readonly maxFanOut: number;
  /** Expert keys; `to: '*'` permits any delegate. */
  readonly allowedPairs: readonly { readonly from: string; readonly to: string }[];
  readonly maxUnattendedBand: RiskBand;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export type AssigneeKind = 'person' | 'expert';

/**
 * `R-047-12` — stored state is `standing` or `pending-decision`; whether a
 * pending assignment came to stand or was refused is read from its decision.
 */
export interface Assignment {
  readonly id: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly assigneeKind: AssigneeKind;
  readonly assigneeId: string;
  readonly rule: string;
  readonly state: 'standing' | 'pending-decision';
  readonly decisionId: string | null;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly supersededAt: string | null;
  readonly supersededBy: string | null;
}

export type SessionOutcome = 'succeeded' | 'incomplete' | 'failed' | 'stopped-by-limit' | 'stopped-by-parent';

export interface EffectiveAuthority {
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  readonly permissions: readonly PermissionGrant[];
  readonly prohibitedActions: readonly string[];
}

/** One Expert run, keyed by its `EPIC-037` execution (`R-047-3`). */
export interface ExpertSession {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly expertId: string;
  readonly contractVersionId: string;
  /** The delegation parent — **not** `EPIC-037`'s re-run parent. */
  readonly delegatedFromExecutionId: string | null;
  /**
   * `FR-EXP-034` — the actor who started this session's **root** run. A delegate
   * inherits it; its targets are checked against this actor, and nobody else may
   * delegate under the session (`T2005`).
   */
  readonly actorId: string;
  readonly depth: number;
  readonly model: string;
  readonly usedFallback: boolean;
  readonly fallbackReason: string | null;
  readonly effectiveAuthority: EffectiveAuthority;
  readonly toolObservation: 'observed' | 'unobserved';
  readonly unattended: boolean;
  readonly reviewRequired: boolean;
  readonly outcome: SessionOutcome | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface SessionLimit {
  readonly executionId: string;
  readonly limit: LimitKind;
  readonly value: number;
  readonly requested: number | null;
  readonly enforcement: 'enforced' | 'unenforceable';
  readonly consumed: number | null;
  readonly consumedReason: string | null;
  readonly reached: 'no' | 'stopped' | 'detected-late';
  readonly detectedAt: string | null;
}
