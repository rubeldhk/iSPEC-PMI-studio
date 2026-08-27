/**
 * T1023 (EPIC-037 Band A) — the 29-event vocabulary, in four classes.
 *
 * ## Why the classes are not cosmetic
 *
 * Terminality is **class-aware** (`FR-EXR-018`). A completed execution accepts
 * no further **lifecycle** event — but comments, redactions, reconciliation and
 * status governance all continue afterwards, because an execution finishing is
 * not the same as everything about it being settled. A single flat list could
 * not express that: it would force either "nothing after terminal", which loses
 * the governance trail, or "anything after terminal", which lets a finished run
 * claim to start again.
 *
 * ## The three withdrawn names
 *
 * `validation-completed`, `status-proposed` and `reconciled` are **absent on
 * purpose** and are listed in {@link WITHDRAWN_EVENT_TYPES} so their absence is
 * assertable rather than accidental. Each was ambiguous in the way that costs
 * most later: `validation-completed` could not distinguish pass from fail —
 * which is the distinction the whole adjudication turns on — and `reconciled`
 * could not distinguish accepted from conflicted.
 */

/** Class 1 — the execution's own progress. Terminality applies to these only. */
export const LIFECYCLE_EVENTS = Object.freeze([
  'registered',
  'started',
  'progress-reported',
  'completed',
  'partially-completed',
  'failed',
  'cancelled',
  'timed-out',
  'blocked',
] as const);

/** Class 2 — what the execution produced or what was said about it. */
export const CONTENT_EVENTS = Object.freeze([
  'artifact-produced',
  'evidence-attached',
  'comment-added',
  'comment-redacted',
] as const);

/** Class 3 — an execution recorded offline catching up with the registry. */
export const REGISTRATION_EVENTS = Object.freeze([
  'execution-sync-queued',
  'execution-reconciliation-requested',
  'execution-reconciliation-accepted',
  'execution-reconciliation-conflicted',
] as const);

/** Class 4 — EPIC-030's verdicts, recorded here as events. */
export const GOVERNANCE_EVENTS = Object.freeze([
  'status-transition-proposed',
  'validation-passed',
  'validation-failed',
  'approval-requested',
  'approval-granted',
  'approval-refused',
  'transition-applied',
  'transition-refused',
  'transition-inconsistent',
  'transition-reconciliation-requested',
  'transition-reconciliation-resolved',
  'transition-reconciliation-refused',
] as const);

export type LifecycleEventType = (typeof LIFECYCLE_EVENTS)[number];
export type ContentEventType = (typeof CONTENT_EVENTS)[number];
export type RegistrationEventType = (typeof REGISTRATION_EVENTS)[number];
export type GovernanceEventType = (typeof GOVERNANCE_EVENTS)[number];

export type ExecutionEventType =
  | LifecycleEventType
  | ContentEventType
  | RegistrationEventType
  | GovernanceEventType;

export const EVENT_CLASSES = Object.freeze([
  'lifecycle',
  'content',
  'registration',
  'governance',
] as const);
export type EventClass = (typeof EVENT_CLASSES)[number];

/** Every type, in declaration order. Exactly 29. */
export const ALL_EVENT_TYPES: readonly ExecutionEventType[] = Object.freeze([
  ...LIFECYCLE_EVENTS,
  ...CONTENT_EVENTS,
  ...REGISTRATION_EVENTS,
  ...GOVERNANCE_EVENTS,
]);

/**
 * Names deliberately NOT in the vocabulary.
 *
 * Exported so a test can assert their absence. An ambiguous name that nobody
 * wrote down as forbidden comes back the first time someone needs "a general
 * validation event".
 */
export const WITHDRAWN_EVENT_TYPES = Object.freeze([
  /** Could not distinguish pass from fail. */
  'validation-completed',
  /** Ambiguous with `status-transition-proposed`; dropped the object it acts on. */
  'status-proposed',
  /** Could not distinguish accepted from conflicted. */
  'reconciled',
] as const);

const CLASS_OF = new Map<ExecutionEventType, EventClass>([
  ...LIFECYCLE_EVENTS.map((t) => [t, 'lifecycle'] as const),
  ...CONTENT_EVENTS.map((t) => [t, 'content'] as const),
  ...REGISTRATION_EVENTS.map((t) => [t, 'registration'] as const),
  ...GOVERNANCE_EVENTS.map((t) => [t, 'governance'] as const),
]);

export function isExecutionEventType(value: string): value is ExecutionEventType {
  return CLASS_OF.has(value as ExecutionEventType);
}

/** Every event has exactly one class — the map is total and unambiguous. */
export function classOf(type: ExecutionEventType): EventClass {
  const found = CLASS_OF.get(type);
  if (found === undefined) {
    throw new Error(`"${type}" is not in the event vocabulary.`);
  }
  return found;
}

/**
 * The lifecycle events after which no further **lifecycle** event may be
 * recorded (`FR-EXR-018`).
 *
 * `blocked` is deliberately absent: a blocked execution is waiting, not
 * finished, and must be able to resume. `partially-completed` is deliberately
 * present: it is an outcome, not a pause.
 */
export const TERMINAL_LIFECYCLE_EVENTS = Object.freeze([
  'completed',
  'partially-completed',
  'failed',
  'cancelled',
  'timed-out',
] as const);

export type TerminalLifecycleEventType = (typeof TERMINAL_LIFECYCLE_EVENTS)[number];

export function isTerminalLifecycleEvent(type: ExecutionEventType): boolean {
  return (TERMINAL_LIFECYCLE_EVENTS as readonly string[]).includes(type);
}

/**
 * Whether `type` may be appended once a terminal lifecycle event exists.
 *
 * The whole of class-aware terminality, in one function: only lifecycle events
 * are blocked. Governance, comments, redactions and reconciliation continue,
 * because a finished execution can still be argued about.
 */
export function permittedAfterTerminal(type: ExecutionEventType): boolean {
  return classOf(type) !== 'lifecycle';
}
