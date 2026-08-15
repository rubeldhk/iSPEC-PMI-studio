/**
 * Project Execution Environment Contract — EPIC-028 (T546, T547).
 *
 * Declared once here and NOWHERE else. `backend/` may import this package; it
 * may never import `execution-providers/*`. Providers are supplied at the
 * WORKER's composition root, exactly as engine adapters are.
 *
 * This widens `ContainerRuntime`, which was declared INSIDE
 * `engine-adapters/speckit/src/speckit.adapter.ts` — which is why nothing else
 * could use it and why implementing it there would have made Docker the
 * abstraction rather than a provider (Native §4, decision D-21).
 *
 * See specs/028-agent-execution-seam/contracts/execution-contract.md
 */

// ---------------------------------------------------------------- lifecycle

export type ExecutionLifecycle = 'ephemeral' | 'persistent';

export interface ExecutionEnvironmentDescriptor {
  readonly provider: string;
  readonly supportedLifecycles: readonly ExecutionLifecycle[];
  readonly supportsPersistentState: boolean;
  /** A provider declaring false cannot accept ANY egress profile. */
  readonly supportsNetworkPolicy: boolean;
  readonly maxWallClockMs: number;
}

// ---------------------------------------------------------------- workspace

/**
 * Native §5: *"No sandbox state may implicitly become authoritative project
 * state."*
 *
 * From inside a container an ephemeral scratch directory and a persistent
 * project checkout look identical. This union makes the dangerous state
 * **unrepresentable**: there is no binding that is persistent and unnamed, so
 * promotion always goes through git (decisions D-22, D-29).
 */
export type WorkspaceBinding =
  | { readonly kind: 'ephemeral'; readonly scratchPath: string }
  | {
      readonly kind: 'persistent';
      readonly projectRef: string;
      readonly mode: 'read-only' | 'read-write';
      readonly branch: string;
    };

// ---------------------------------------------------------------- egress

export type EgressEnforcement = 'network-policy' | 'proxy' | 'both';

export interface EgressProfile {
  readonly name: string;
  /** Never a wildcard. Never empty. Asserted by `assertEgressProfile`. */
  readonly allowedDestinations: readonly string[];
  readonly enforcement: EgressEnforcement;
}

// ---------------------------------------------------------------- credentials

/**
 * A ref, never a value.
 *
 * The type carries no secret, so a credential cannot leak through a logged
 * request object, a serialised error, or a test fixture. Resolution happens
 * inside the provider at container start and nowhere else (decision D-27).
 */
export interface ScopedCredentialRef {
  readonly id: string;
  readonly purpose: 'ai-provider' | 'repository';
  /** The single repository/branch or provider this is valid for. */
  readonly scope: string;
  /** Required. A ref without an expiry is not short-lived. */
  readonly expiresAt: string;
}

// ---------------------------------------------------------------- limits

export interface ResourceLimits {
  readonly cpus: number;
  readonly memoryMb: number;
  readonly pids: number;
  readonly wallClockMs: number;
}

// ---------------------------------------------------------------- failures

/**
 * As with `EngineFailureReason`, there is deliberately NO `unknown` member.
 * A generic failure is a defect, not a fallback.
 */
export const EXECUTION_FAILURE_REASONS = [
  'provider_unavailable',
  'provider_error',
  'image_unavailable',
  'policy_refused',
  'credential_unresolvable',
  'timeout',
  'cancelled',
] as const;

export type ExecutionFailureReason = (typeof EXECUTION_FAILURE_REASONS)[number];

export interface ExecutionFailure {
  readonly reason: ExecutionFailureReason;
  /** Safe to show a user. Never a raw stack trace. */
  readonly message: string;
  /** Operator-facing only. Never returned to a user, never logged (PC-3). */
  readonly diagnostics?: string;
}

export type ExecutionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ExecutionFailure };

export function executionOk<T>(value: T): ExecutionResult<T> {
  return { ok: true, value };
}

export function executionFail<T>(
  reason: ExecutionFailureReason,
  message: string,
  diagnostics?: string,
): ExecutionResult<T> {
  return {
    ok: false,
    failure: diagnostics ? { reason, message, diagnostics } : { reason, message },
  };
}

export function isExecutionFailure<T>(r: ExecutionResult<T>): r is Extract<ExecutionResult<T>, { ok: false }> {
  return r.ok === false;
}

// ---------------------------------------------------------------- the contract

export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  /** Operator-facing only. Never returned to a user, never logged (PC-3). */
  readonly stderr: string;
}

/** Unchanged from the `SandboxSession` this replaces — deliberately. */
export interface ExecutionSession {
  exec(command: readonly string[]): Promise<ExecResult>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

export interface ExecutionRequest {
  readonly lifecycle: ExecutionLifecycle;
  readonly image: string;
  /** Never a secret value — credentials are refs. */
  readonly env: Record<string, string>;
  readonly workspace: WorkspaceBinding;
  readonly egressProfile: EgressProfile;
  readonly credentials: readonly ScopedCredentialRef[];
  readonly resourceLimits: ResourceLimits;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface ProjectExecutionEnvironment {
  readonly descriptor: ExecutionEnvironmentDescriptor;
  start(request: ExecutionRequest): Promise<ExecutionSession>;
  /** Idempotent. Must never throw into a result. */
  stop(session: ExecutionSession): Promise<void>;
}
