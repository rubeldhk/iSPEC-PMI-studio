/**
 * `T1286`, `T1288` (EPIC-038) — the two ports that **degrade**.
 *
 * `FR-CTX-015`, `FR-CTX-020`–`FR-CTX-023`, `R-038-8`.
 *
 * Live state and execution history are *additions* to a package. Missing them
 * makes the package smaller, not wrong — **provided the package says so**. So
 * each absence is written onto the package as `unavailable` with a reason,
 * and that record is what keeps *nobody could look* distinguishable from
 * *looked and found nothing*. Without it, degrading would be the silent
 * dropping this Epic exists to forbid.
 *
 * ## Execution history is read through projections
 *
 * `R-038-8`. `EPIC-037` makes its events authoritative and its projections the
 * surface for current state. This port asks a projection for its version and
 * nothing else; replaying the event stream would make this Epic a second
 * interpreter of semantics it does not own.
 *
 * Framework-free (PC-1).
 */

/** `FR-CTX-020` — the kinds of live state a package may carry. */
export const LIVE_STATE_KINDS = Object.freeze([
  'repository',
  'branch',
  'pull-request',
  'workflow',
  'build',
  'test',
  'deployment',
  'incident',
] as const);

export type LiveStateKind = (typeof LIVE_STATE_KINDS)[number];

/** One element as a reader returns it. A reference and a state, never a payload. */
export interface LiveStateReading {
  readonly kind: LiveStateKind;
  /** The system's own reference — `build#812`, `PR-77`. */
  readonly ref: string;
  /** A short state word — `failing`, `open`, `deployed`. */
  readonly state: string;
  /** `FR-CTX-021` — when it was read. Required; never stamped by this module. */
  readonly readAt: Date;
}

/** One element as a package retains it. */
export interface LiveStateElement extends LiveStateReading {
  readonly id: string;
  readonly workspaceId: string;
  readonly packageId: string;
}

/** `LiveStateReader` — the systems holding live state. Throws when it cannot read. */
export interface LiveStateReader {
  read(workspaceId: string, projectId: string): Promise<readonly LiveStateReading[]>;
}

/**
 * `ExecutionProjections` — `EPIC-037`'s current-state projections.
 *
 * The version of an execution's projection, or `null` when there is none.
 * That version is what an `execution-history` index entry was built from, so
 * comparing the two is staleness by version (`R-038-5`), here as everywhere.
 */
export interface ExecutionProjections {
  projectedVersion(workspaceId: string, executionId: string): Promise<string | null>;
}

/** `FR-CTX-022` — what the package records about each degrading port. */
export type LiveStateStatus = 'not-requested' | 'read' | 'unavailable';
export type ExecutionHistoryStatus = 'available' | 'unavailable';
