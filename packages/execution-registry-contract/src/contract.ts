/**
 * T1022 (EPIC-037 Band A) — the provider-neutral semantic contract.
 *
 * One surface, several bindings. A connector running in a managed sandbox, an
 * IDE extension, a CI job and the fixture all speak *this*; REST and MCP are
 * transports over it rather than separate contracts. That is what makes
 * "semantic equivalence across surfaces" testable instead of aspirational.
 *
 * ## What a connector may say, and what it may never decide
 *
 * A connector **reports** and **proposes**. It does not adjudicate, apply a
 * lifecycle transition, approve anything, or interpret policy — and it cannot,
 * because none of those verbs exist here. The omission is the enforcement: a
 * contract that offered `applyTransition` would make "connectors must not apply
 * transitions" a rule somebody has to remember.
 *
 * ## Identity is referenced, never asserted
 *
 * Every operation carries identity as **snapshot references** minted
 * server-side by EPIC-028 (`C3B`). A connector cannot construct one, cannot
 * submit another principal's, and cannot collapse the eight concepts into a
 * single `actorId` — they are separate fields precisely so that collapsing them
 * is not expressible.
 */
import type { ExecutionEventType } from './events.js';

/** Where an execution ran. A surface, not an actor. */
export const EXECUTION_SURFACES = Object.freeze([
  'managed-sandbox',
  'mcp-client',
  'ide-extension',
  'local-cli',
  'ci-cd',
  'fixture',
] as const);
export type ExecutionSurface = (typeof EXECUTION_SURFACES)[number];

/** The governed Spec Kit commands this registry records. */
export const GOVERNED_COMMANDS = Object.freeze([
  'specify',
  'clarify',
  'plan',
  'tasks',
  'analyze',
  'implement',
  'converge',
  'constitution',
  'checklist',
] as const);
export type GovernedCommand = (typeof GOVERNED_COMMANDS)[number];

/**
 * How much an execution's evidence rests on (EPIC-041 `T1315`, `FR-LPW-034`,
 * `R-041-5`, `ADR-0030`). Two values, not three: customer cloud has no owner and
 * no Epic, and a value nothing produces is decoration (PMI-DOC-007 `D-9`).
 *
 * **Recorded, never consulted by policy** (`FR-LPW-031`, `BR-0133`). Assurance
 * is the honest label on the evidence, not a switch that relaxes a rule.
 */
export const EXECUTION_ASSURANCES = Object.freeze(['managed', 'local'] as const);
export type ExecutionAssurance = (typeof EXECUTION_ASSURANCES)[number];

/**
 * Derived from the surface at registration — **never supplied by the caller**.
 * A connector asserting its own assurance is the same shape as the request-body
 * `authenticatedPrincipalId` that got the executions controller unmounted
 * (`DEF-037-001`).
 *
 * Total over `EXECUTION_SURFACES`: a `switch` with no `default` arm, so adding
 * a surface without a mapping fails to compile before it fails a test.
 */
export function assuranceFor(surface: ExecutionSurface): ExecutionAssurance {
  switch (surface) {
    case 'managed-sandbox':
    case 'ci-cd':
      return 'managed';
    case 'local-cli':
    case 'mcp-client':
    case 'ide-extension':
      return 'local';
    case 'fixture':
      // A fixture proves the contract; it should never make evidence look
      // stronger than a real local run would.
      return 'local';
  }
}

/**
 * Who is acting, as **references** to server-minted frozen identities.
 *
 * Eight concepts, kept apart. A connector is the surface an execution arrived
 * through; it is not automatically the agent, the sponsor, the proposer or the
 * approver, and the C3B authorisation is explicit that they must never collapse
 * into `actorId`.
 */
export interface ExecutionIdentityRefs {
  /** Resolved server-side from a trusted context. Never taken from the request. */
  readonly authenticatedPrincipalId: string;
  /** The agent or service that executed. */
  readonly agentSnapshotId: string;
  /** The surface it arrived through. */
  readonly connectorRegistrationId: string;
  /** The human accountable for the agent. */
  readonly sponsorUserId: string;
  /** The scoped authority relied on, and the identity version it was pinned to. */
  readonly delegationId: string;
  readonly delegationIdentityVersion: number;
}

/**
 * Input identity, required at **registration** (`FR-EXR-016`).
 *
 * `commitAfter` is deliberately absent. Requiring an output commit before the
 * work has run is not caution, it is a contradiction — `AC-EXR-17b` records
 * that asking for it here is itself a defect.
 */
export interface InputBinding {
  readonly targetType: string;
  readonly targetId: string;
  readonly targetVersion?: number;
  readonly baselineId?: string;
  readonly repositoryId?: string;
  readonly branch?: string;
  readonly worktree?: string;
  readonly commitBefore?: string;
  readonly inputArtifactDigests?: readonly string[];
}

/**
 * Output identity, required at **successful completion**.
 *
 * A failed, cancelled or timed-out execution legitimately has none
 * (`AC-EXR-17d`): there is no resulting version because nothing resulted.
 */
export interface OutputBinding {
  readonly commitAfter?: string;
  readonly resultingVersion?: number;
  readonly resultingBaselineId?: string;
  readonly generatedArtifactDigests?: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface RegisterExecutionRequest {
  readonly executionId?: string;
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly command: GovernedCommand;
  /** Secrets redacted at the connector before they ever reach the wire. */
  readonly argsSanitized: Readonly<Record<string, unknown>>;
  readonly surface: ExecutionSurface;
  readonly environment?: string;
  readonly identity: ExecutionIdentityRefs;
  readonly input: InputBinding;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey: string;
  readonly contractVersion: string;
  /** Set on a re-run. The parent is never reopened (`FR-EXR-018`). */
  readonly parentExecutionId?: string;
}

export interface AppendEventRequest {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly type: ExecutionEventType;
  readonly payload: Readonly<Record<string, unknown>>;
  /** Source clock. Evidence, never the sequencing key (`R-037-3`). */
  readonly occurredAt: string;
  readonly identity: ExecutionIdentityRefs;
  readonly idempotencyKey: string;
  /**
   * Optimistic concurrency for a connected append. The sequence the connector
   * believes it is writing after; a mismatch appends nothing.
   */
  readonly expectedSequence?: number;
  /** Connector-local causal order, retained after reconciliation. */
  readonly localSequence?: number;
}

export interface CompleteExecutionRequest {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly outcome: 'completed' | 'partially-completed' | 'failed' | 'cancelled' | 'timed-out';
  readonly identity: ExecutionIdentityRefs;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  /** Required for `completed`; legitimately absent for the failure outcomes. */
  readonly output?: OutputBinding;
  /** Mandatory on completion (`FR-EXR-013`). */
  readonly completionComment: string;
  readonly expectedSequence?: number;
}

export interface ProposeTransitionRequest {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly targetRef: string;
  readonly targetVersion: number;
  readonly expectedCurrentStatus: string;
  readonly proposedState: string;
  readonly rationale: string;
  readonly identity: ExecutionIdentityRefs;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

/** What an append returns: the authoritative sequence the server assigned. */
export interface AppendedEvent {
  readonly eventId: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly type: ExecutionEventType;
  readonly recordedAt: string;
  /** True when this was a replay of an already-recorded idempotency key. */
  readonly replayed: boolean;
}

export interface ExecutionSnapshot {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly command: GovernedCommand;
  readonly surface: ExecutionSurface;
  /** Derived from the surface by the registry (FR-LPW-034, SC-LPW-009); the projection carries it. */
  readonly assurance: ExecutionAssurance;
  readonly lifecycleState: string;
  readonly governanceState: 'provisional' | 'pending_sync' | 'governed';
  /** Makes projection staleness visible rather than invisible. */
  readonly projectedThroughSequence: number;
  readonly parentExecutionId: string | null;
}

/**
 * The operations every surface exposes.
 *
 * Note what is missing: no `applyTransition`, no `approve`, no `setStatus`, no
 * `patch`. A connector reports and proposes; the platform decides.
 */
export interface ExecutionRegistry {
  register(request: RegisterExecutionRequest): Promise<ExecutionSnapshot>;
  appendEvent(request: AppendEventRequest): Promise<AppendedEvent>;
  complete(request: CompleteExecutionRequest): Promise<AppendedEvent>;
  proposeTransition(request: ProposeTransitionRequest): Promise<AppendedEvent>;
  history(workspaceId: string, executionId: string): Promise<readonly AppendedEvent[]>;
  snapshot(workspaceId: string, executionId: string): Promise<ExecutionSnapshot | null>;
}

/** Refusals a connector must be able to distinguish. */
export const REGISTRY_REFUSALS = Object.freeze([
  'unsupported_contract_version',
  'identity_not_resolvable',
  'delegation_missing',
  'input_binding_incomplete',
  'output_binding_required',
  'output_binding_not_permitted',
  'lifecycle_terminal',
  'sequence_conflict',
  'idempotency_conflict',
  'completion_comment_required',
  'credential_detected',
  // EPIC-041 FR-LPW-034: assurance is derived by the registry, never accepted.
  'assurance_not_accepted',
] as const);
export type RegistryRefusal = (typeof REGISTRY_REFUSALS)[number];

export class RegistryRefusedError extends Error {
  constructor(
    readonly refusal: RegistryRefusal,
    message: string,
  ) {
    super(message);
    this.name = 'RegistryRefusedError';
  }
}
