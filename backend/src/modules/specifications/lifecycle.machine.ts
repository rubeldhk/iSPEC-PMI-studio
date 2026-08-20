/**
 * T099 + T111 — the specification lifecycle state machine (FR-011, FR-014).
 *
 * The six states and eight permitted transitions of SRS M08 §8 (decision
 * D-14). The permitted set is exactly the one the database CHECK constraint
 * enforces (specs/_shared/schema.sql `lifecycle_permitted_transition`) — the
 * code half of a two-layer rule, pinned to the DDL by T106.
 *
 * T111: every performed transition records WHO and WHEN through an
 * append-only recorder port. A refused transition records nothing here —
 * refusals are audit events (FR-033), not lifecycle history.
 *
 * T095 rides along: FR-020's task-generation gate is a property of this
 * machine, so the rule cannot fork between orchestrators.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import {
  InvalidLifecycleTransitionError,
  SpecificationNotApprovedError,
} from '../../core/errors.js';

export const SPEC_LIFECYCLE_STATES = [
  'draft',
  'review',
  'approved',
  'baselined',
  'implemented',
  'archived',
] as const;

export type SpecLifecycleState = (typeof SPEC_LIFECYCLE_STATES)[number];

/** The eight permitted transitions — anything else is refused naming this set. */
export const PERMITTED_TRANSITIONS: readonly { from: SpecLifecycleState; to: SpecLifecycleState }[] = [
  { from: 'draft', to: 'review' },
  // Rejection returns it for rework. approved → draft does NOT exist (US5/4).
  { from: 'review', to: 'draft' },
  { from: 'review', to: 'approved' },
  { from: 'approved', to: 'baselined' },
  { from: 'baselined', to: 'implemented' },
  // FR-011b: approved, baselined, and implemented may all be archived.
  { from: 'approved', to: 'archived' },
  { from: 'baselined', to: 'archived' },
  { from: 'implemented', to: 'archived' },
];

export function permittedFrom(state: SpecLifecycleState): SpecLifecycleState[] {
  return PERMITTED_TRANSITIONS.filter((t) => t.from === state).map((t) => t.to);
}

/** FR-011: refuse anything outside the permitted set, naming what IS permitted. */
export function assertTransition(from: SpecLifecycleState, to: SpecLifecycleState): void {
  const permitted = PERMITTED_TRANSITIONS.some((t) => t.from === from && t.to === to);
  if (!permitted) throw new InvalidLifecycleTransitionError(from, to, permittedFrom(from));
}

/** FR-020 / US4 scenario 2: tasks are generated from approved, and only approved. */
export function assertTaskGenerationPermitted(state: SpecLifecycleState): void {
  if (state !== 'approved') throw new SpecificationNotApprovedError(state);
}

// ---------------------------------------------------------------- recording

export interface TransitionRecord {
  id: string;
  workspaceId: string;
  specificationId: string;
  fromState: SpecLifecycleState;
  toState: SpecLifecycleState;
  actorId: string;
  occurredAt: Date;
}

/** Append and nothing else — lifecycle history is history (FR-014). */
export interface TransitionRecorder {
  append(record: TransitionRecord): Promise<void>;
}

export interface TransitionRequest {
  workspaceId: string;
  specificationId: string;
  from: SpecLifecycleState;
  to: SpecLifecycleState;
  actorId: string;
}

export interface MachineOptions {
  now?: () => Date;
}

export class LifecycleMachine {
  private readonly now: () => Date;

  constructor(
    private readonly recorder: TransitionRecorder,
    options: MachineOptions = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
  }

  /** Validate, then record who moved it and when — in that order (T111). */
  async transition(request: TransitionRequest): Promise<TransitionRecord> {
    assertTransition(request.from, request.to);
    const record: TransitionRecord = {
      id: randomUUID(),
      workspaceId: request.workspaceId,
      specificationId: request.specificationId,
      fromState: request.from,
      toState: request.to,
      actorId: request.actorId,
      occurredAt: this.now(),
    };
    await this.recorder.append(record);
    return record;
  }
}

/** In-memory recorder for tests and database-less runs. Append-only. */
export class InMemoryTransitionRecorder implements TransitionRecorder {
  readonly records: TransitionRecord[] = [];

  async append(record: TransitionRecord): Promise<void> {
    this.records.push(Object.freeze({ ...record }));
  }
}
