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
  | 'forbidden'
  | 'review_incomplete'
  | 'invalid_lifecycle_transition'
  | 'specification_not_approved'
  | 'engine_unavailable'
  | 'provider_unavailable'
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

/**
 * EPIC-023 (FR-RUN-015a, FR-RUN-013a) — the ONE deliberate exception to the
 * absence rule above, written into `platform-api-epic-002.md`: a review
 * session's existence is not secret to someone who can already see it; what is
 * refused is the AUTHORITY to submit or resolve. Absence would be misleading —
 * the user can see the session and needs to know why they cannot act. Never
 * use this for artifact visibility; that stays 404.
 */
export class ForbiddenError extends PlatformError {
  readonly code = 'forbidden' as const;
}

/** FR-RUN-014: submission is refused naming the unanswered questions. */
export class ReviewIncompleteError extends PlatformError {
  readonly code = 'review_incomplete' as const;

  constructor(unansweredQuestionIds: readonly string[]) {
    super('Submission refused — unanswered questions remain.', {
      unansweredQuestionIds: [...unansweredQuestionIds],
    });
  }
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

/**
 * T841 (EPIC-008) — FR-018 / US3 scenario 4.
 *
 * The scenario is explicit: a user whose generation cannot start because no
 * engine is available is *"told the engine is unavailable rather than shown a
 * generic error"*. Without this code, `NoDefaultEngineError` and
 * `EngineSelectionUnavailableError` — neither of which is a `PlatformError` —
 * fell through `toErrorBody` to `internal_error` and the fixed text "An
 * unexpected error occurred.", which is the generic error the scenario forbids.
 *
 * The registered engine set is deliberately NOT carried into the message.
 * `EngineSelectionUnavailableError` names it for an operator; a user learning a
 * deployment's engine inventory from a refusal is an information leak (research
 * R-011, contract rule E9).
 */
export class EngineUnavailableError extends PlatformError {
  readonly code = 'engine_unavailable' as const;
}

/**
 * EPIC-025 (FR-PUB-031) — an unreachable storage provider, reported BEFORE
 * anything is sent. 502 per `platform-api-epic-002.md`: unlike an engine
 * refusal, this one names an upstream dependency failure, and the contract
 * documents the status explicitly — the DEF-008-001 rule is satisfied by the
 * owning contract, not violated around it.
 */
export class ProviderUnavailableError extends PlatformError {
  readonly code = 'provider_unavailable' as const;
}

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  review_incomplete: 422,
  invalid_lifecycle_transition: 422,
  specification_not_approved: 422,
  // 422, not 503. The contract's status table lists no 5xx for a refusal, and
  // defines 422 as "well-formed but semantically refused" — which this is. The
  // CODE carries the meaning; inventing an undocumented status from an epic
  // that does not own `platform-api.md` is the mistake DEF-008-001 records.
  engine_unavailable: 422,
  provider_unavailable: 502,
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
