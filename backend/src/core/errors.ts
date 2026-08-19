/**
 * T018 — typed platform errors and the API error shape.
 *
 * Framework-free by design (PC-1): services throw these; the transport layer
 * translates them. Nothing here imports an HTTP type.
 *
 * Contract: specs/_shared/contracts/platform-api.md
 */

export type ErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'invalid_lifecycle_transition'
  | 'specification_not_approved'
  | 'internal_error';

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export abstract class PlatformError extends Error {
  abstract readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) this.details = details;
  }
}

export class ValidationFailedError extends PlatformError {
  readonly code = 'validation_failed' as const;
}

export class UnauthenticatedError extends PlatformError {
  readonly code = 'unauthenticated' as const;
}

/**
 * FR-002 / SC-004. There is deliberately **no ForbiddenError** in this
 * taxonomy: a resource in another workspace must be indistinguishable from one
 * that does not exist, because 403 confirms existence.
 */
export class NotFoundError extends PlatformError {
  readonly code = 'not_found' as const;
}

export class ConflictError extends PlatformError {
  readonly code = 'conflict' as const;
}

/** FR-011: refuse the transition and name the permitted set. */
export class InvalidLifecycleTransitionError extends PlatformError {
  readonly code = 'invalid_lifecycle_transition' as const;

  constructor(from: string, to: string, permitted: readonly string[]) {
    super(`Cannot move a specification from "${from}" to "${to}".`, {
      from,
      to,
      permitted: [...permitted],
    });
  }
}

/** FR-020: task generation requires an approved specification. */
export class SpecificationNotApprovedError extends PlatformError {
  readonly code = 'specification_not_approved' as const;

  constructor(currentState: string) {
    super('Tasks can only be generated from an approved specification.', {
      currentState,
      requiredState: 'approved',
    });
  }
}

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  not_found: 404,
  conflict: 409,
  invalid_lifecycle_transition: 422,
  specification_not_approved: 422,
  internal_error: 500,
};

export function toHttpStatus(err: unknown): number {
  return err instanceof PlatformError ? STATUS[err.code] : STATUS.internal_error;
}

/**
 * Serialise for the wire. An unrecognised error becomes `internal_error` with a
 * fixed message — its own text is never exposed, because it may carry a
 * connection string, a token, or engine output.
 */
export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof PlatformError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return body;
  }
  return { error: { code: 'internal_error', message: 'An unexpected error occurred.' } };
}
