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
  | 'governance_seam_unbound'
  // EPIC-041 T1334 — the platform exists and cannot currently write a project directory (503).
  | 'projects_root_unavailable'
  // EPIC-043 T1421 (R-043-5) — the connector-facing refusals, one vocabulary
  // with the MCP binding (`REGISTRY_REFUSALS` in @pmi/execution-registry-contract).
  | 'invalid_connector_credential'
  | 'scope_required'
  | 'identity_not_accepted'
  | 'surface_not_accepted'
  | 'unsupported_contract_version'
  | 'not_available_until'
  // EPIC-045 DEF-045-001 — a request body above the configured limit (413), reported as a code
  // rather than escaping the body parser as a 500.
  | 'payload_too_large'
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

// ---------------------------------------------------------------- EPIC-043

/**
 * The ONE refusal for every credential failure — absent, malformed, unknown,
 * revoked, another project's (`FR-PIC-021`). 401. The message is fixed and
 * compared verbatim by the tests; nothing about the reason is disclosed.
 */
export class InvalidConnectorCredentialError extends PlatformError {
  readonly code = 'invalid_connector_credential' as const;
  constructor() {
    super('Invalid connector credential.');
  }
}

/** 403 — a valid credential reaching an operation outside its scopes; names the scope required. */
export class ScopeRequiredError extends PlatformError {
  readonly code = 'scope_required' as const;
  constructor(scope: string) {
    super(`This operation requires the connector scope "${scope}".`, { scope });
  }
}

/** 400 — a body asserted something the platform derives (`FR-PIC-024`, `R-043-4`). */
export class IdentityNotAcceptedError extends PlatformError {
  readonly code = 'identity_not_accepted' as const;
  constructor(field: string) {
    super(`The request may not carry "${field}"; the platform derives it from the credential.`, { field });
  }
}

export class SurfaceNotAcceptedError extends PlatformError {
  readonly code = 'surface_not_accepted' as const;
  constructor(field: string) {
    super(`The request may not carry "${field}"; the platform derives it from the transport.`, { field });
  }
}

/** 400 — the contract version negotiated, never best-guessed (`R-043-6`). */
export class UnsupportedContractVersionError extends PlatformError {
  readonly code = 'unsupported_contract_version' as const;
  constructor(supported: string, received: string | null) {
    super(`Contract version ${received ?? '(none)'} is not supported; this platform speaks ${supported}.`, { supported, received });
  }
}

/** 501 — a reserved operation whose content a later Epic supplies (`FR-PIC-002`, `FR-PIC-034`). */
export class NotAvailableUntilError extends PlatformError {
  readonly code = 'not_available_until' as const;
  constructor(epic: string, what: string) {
    super(`${what} is not available until ${epic} is delivered.`, { epic });
  }
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

/**
 * `T1195` (EPIC-001) — a **declared** governance seam has no implementation
 * bound, so the request is refused rather than defaulted.
 *
 * Added because `DEF-033-002` found two of them reaching users as
 * *"An unexpected error occurred."* — `EPIC-031`'s `PolicyProvider` and
 * `EPIC-032`'s `EvidenceContractSource`, both declared `absent: 'refuse'` by
 * `ROOM_PORTS`.
 *
 * **The consuming Epics were right not to invent this.** `PolicyUnavailableError`
 * records the reasoning: no documented status meant *"a seam is unbound"*, and
 * `DEF-008-001` is what happens when an Epic that does not own
 * `platform-api.md` invents one. So it is added here, by the owning Epic, with
 * the status table amended in the same change.
 *
 * **Why 503 and not 422 or 502.** Not 422: the request is well formed and the
 * refusal is not about its content, so a caller correcting the body would learn
 * nothing. Not 502: that is `provider_unavailable`, documented for an
 * unreachable **storage** provider (`EPIC-025`), and a seam that was never
 * configured is a different fact from one that cannot be reached.
 *
 * **The message must name the seam.** A 503 saying nothing is the same defect
 * with a better number.
 */
export class GovernanceSeamUnboundError extends PlatformError {
  readonly code = 'governance_seam_unbound' as const;
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
  governance_seam_unbound: 503,
  projects_root_unavailable: 503,
  // EPIC-043 (contracts/mounted-registry-api.md, data-model.md §7).
  invalid_connector_credential: 401,
  scope_required: 403,
  identity_not_accepted: 400,
  surface_not_accepted: 400,
  unsupported_contract_version: 400,
  not_available_until: 501,
  payload_too_large: 413,
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
/**
 * EPIC-043 T1440 (`FR-PIC-026`, `SC-PIC-003`) — the shapes that are credentials
 * wherever they appear: this platform's connector credential, and the common
 * API-key forms. A refusal that echoed one would put a secret in a log, a
 * screen and an agent transcript at once.
 */
const CREDENTIAL_SHAPES: readonly RegExp[] = [
  // The bearer form first, so "Bearer pmi_ct_…" collapses to one placeholder.
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g,
  /pmi_ct_[A-Za-z0-9_-]{20,}/g,
  /\bsk-ant-[A-Za-z0-9-]{16,}\b/g,
  /\bsk-[A-Za-z0-9-]{16,}\b/g,
];

export function scrubCredentials(text: string): string {
  let out = text;
  for (const shape of CREDENTIAL_SHAPES) out = out.replace(shape, '<credential>');
  return out;
}

/** The same scrub, applied to every string at any depth of a value. */
export function scrubCredentialsDeep<T>(value: T): T {
  if (typeof value === 'string') return scrubCredentials(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubCredentialsDeep(v)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubCredentialsDeep(v);
    return out as T;
  }
  return value;
}

export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof PlatformError) {
    const body: ErrorBody = { error: { code: err.code, message: scrubCredentials(err.message) } };
    if (err.details !== undefined) body.error.details = scrubCredentialsDeep(err.details);
    return body;
  }
  return { error: { code: 'internal_error', message: 'An unexpected error occurred.' } };
}
