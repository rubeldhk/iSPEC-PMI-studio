/**
 * Specification Engine Contract — Phase 1.
 *
 * Declared once here and NOWHERE else. `backend/` may import this package;
 * it may never import `engine-adapters/*`. Enforced by the architecture test
 * (T047) and the ESLint dependency-boundary rule (T008).
 *
 * See specs/_shared/contracts/specification-engine.md
 */

// ---------------------------------------------------------------- capabilities

export const PHASE_1_CAPABILITIES = [
  'generate_specification',
  'generate_tasks',
  'validate_specification',
] as const;

export type EngineCapability = (typeof PHASE_1_CAPABILITIES)[number];

export interface EngineDescriptor {
  name: string;
  /**
   * Identifies BOTH the engine tool version AND the AI agent/model (FR-022).
   * Same Spec Kit release + different model = a different engine version,
   * because the output differs. See research R-001.
   */
  version: string;
  capabilities: EngineCapability[];
}

// ---------------------------------------------------------------- failures

/**
 * FR-026 / SC-005: every non-success terminal state names a specific reason.
 * There is deliberately NO `unknown` member — a generic failure is a defect,
 * not a fallback.
 */
export const ENGINE_FAILURE_REASONS = [
  'engine_unavailable',
  'engine_error',
  'malformed_output',
  'empty_output',
  'timeout',
  'cancelled',
  'input_too_large',
  'empty_selection',
] as const;

export type EngineFailureReason = (typeof ENGINE_FAILURE_REASONS)[number];

export interface EngineFailure {
  reason: EngineFailureReason;
  /** Safe to show a user. Never a raw stack trace. */
  message: string;
  /** Operator-facing only. Never returned to a user, never logged (R-011). */
  diagnostics?: string;
}

export type EngineResult<T> =
  | { ok: true; value: T; producedBy: EngineDescriptor }
  | { ok: false; failure: EngineFailure };

export function engineOk<T>(value: T, producedBy: EngineDescriptor): EngineResult<T> {
  return { ok: true, value, producedBy };
}

export function engineFail<T>(
  reason: EngineFailureReason,
  message: string,
  diagnostics?: string,
): EngineResult<T> {
  return { ok: false, failure: diagnostics ? { reason, message, diagnostics } : { reason, message } };
}

export function isEngineFailure<T>(
  r: EngineResult<T>,
): r is { ok: false; failure: EngineFailure } {
  return r.ok === false;
}

// ---------------------------------------------------------------- inputs

export type RequirementType = 'business' | 'functional' | 'non_functional' | 'constraint';
export type RequirementPriority = 'p1' | 'p2' | 'p3';

export interface RequirementInput {
  reference: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
}

export interface GenerateSpecificationInput {
  projectName: string;
  /** Never empty — an empty selection is refused before a job starts. */
  requirements: RequirementInput[];
}

export interface GenerateTasksInput {
  projectName: string;
  specificationTitle: string;
  specificationContent: string;
}

export interface ValidateSpecificationInput {
  specificationTitle: string;
  specificationContent: string;
}

// ---------------------------------------------------------------- outputs

export interface GeneratedSpecification {
  title: string;
  /** Engine output verbatim, always persisted (R-007). */
  contentRaw: string;
  contentParsed: Record<string, unknown>;
}

export interface GeneratedTask {
  description: string;
}

export interface ValidationFinding {
  /** REQUIRED (FR-023). A finding without a location is malformed output. */
  location: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

// ---------------------------------------------------------------- the contract

export interface EngineContext {
  /** Cooperative cancellation — FR-024. */
  signal: AbortSignal;
  /** Hard wall-clock ceiling — FR-025. */
  timeoutMs: number;
  /** Correlation identifier passed INTO the sandbox (PC-3). */
  correlationId: string;
  /** Progress for FR-028; must never block the caller. */
  onProgress?: (note: string) => void;
}

export interface SpecificationEngine {
  readonly descriptor: EngineDescriptor;

  generateSpecification(
    input: GenerateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedSpecification>>;

  generateTasks(
    input: GenerateTasksInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedTask[]>>;

  validateSpecification(
    input: ValidateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<ValidationFinding[]>>;
}

// ---------------------------------------------------------------- registry

export class MissingCapabilityError extends Error {
  constructor(
    readonly engineName: string,
    readonly missing: EngineCapability[],
  ) {
    super(
      `Engine "${engineName}" cannot be registered: missing required capability ` +
        `${missing.join(', ')}.`,
    );
    this.name = 'MissingCapabilityError';
  }
}

/** FR-021: refuse registration, naming the missing capability. */
export function assertPhase1Capabilities(descriptor: EngineDescriptor): void {
  const missing = PHASE_1_CAPABILITIES.filter((c) => !descriptor.capabilities.includes(c));
  if (missing.length > 0) {
    throw new MissingCapabilityError(descriptor.name, [...missing]);
  }
}
