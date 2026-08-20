/**
 * T099b — baseline immutability and archive behaviour (FR-011a, FR-011b).
 *
 * Editing a baselined specification is NOT a lifecycle transition: it forks a
 * new version whose `lifecycleStateAtCreation` is `draft` and moves the
 * specification to `draft`, leaving the baselined version retrievable
 * unchanged. `baselined → draft` is absent from the permitted set on purpose
 * — the database CHECK would refuse recording it — so no transition row is
 * written for a fork.
 *
 * Archiving IS a transition (FR-011b: from approved, baselined, or
 * implemented), recorded with actor and time, and it touches neither versions
 * nor traceability links — nothing destructive exists on any port used here.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { ConflictError } from '../../core/errors.js';
import {
  assertTransition,
  type SpecLifecycleState,
  type TransitionRecord,
  type TransitionRecorder,
} from './lifecycle.machine.js';
import type {
  SpecificationVersionRecord,
  SpecificationVersionService,
} from './version.service.js';
import { randomUUID } from 'node:crypto';

/** The one state write this service needs — implemented over the spec store. */
export interface SpecificationStatePort {
  get(specificationId: string): SpecLifecycleState | undefined;
  set(specificationId: string, state: SpecLifecycleState): void;
}

export interface EditBaselinedInput {
  id: string;
  workspaceId: string;
  contentRaw: string;
  contentParsed: Record<string, unknown>;
  authoredById: string;
}

export interface ArchiveInput {
  id: string;
  workspaceId: string;
  actorId: string;
}

export interface BaselineServiceOptions {
  now?: () => Date;
}

export class BaselineService {
  private readonly now: () => Date;

  constructor(
    private readonly versions: SpecificationVersionService,
    private readonly state: SpecificationStatePort,
    private readonly recorder: TransitionRecorder,
    options: BaselineServiceOptions = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
  }

  /** FR-011a: fork a new draft version; the baseline stays as it stood. */
  async editBaselined(input: EditBaselinedInput): Promise<SpecificationVersionRecord> {
    const current = this.state.get(input.id);
    if (current !== 'baselined') {
      throw new ConflictError(
        'Only a baselined specification forks on edit; anything else is a plain edit.',
      );
    }
    const { version } = await this.versions.appendIfChanged({
      workspaceId: input.workspaceId,
      specificationId: input.id,
      contentRaw: input.contentRaw,
      contentParsed: input.contentParsed,
      // The FORK is born in draft — that is what makes the baseline immutable.
      lifecycleState: 'draft',
      authoredById: input.authoredById,
    });
    // A fork is not a transition; the state moves without a transition row.
    this.state.set(input.id, 'draft');
    return version;
  }

  /** FR-011b: archive from approved / baselined / implemented, recorded. */
  async archive(input: ArchiveInput): Promise<TransitionRecord> {
    const from = this.state.get(input.id);
    assertTransition(from as SpecLifecycleState, 'archived');
    const record: TransitionRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      specificationId: input.id,
      fromState: from as SpecLifecycleState,
      toState: 'archived',
      actorId: input.actorId,
      occurredAt: this.now(),
    };
    await this.recorder.append(record);
    this.state.set(input.id, 'archived');
    return record;
  }
}

/** In-memory state port for tests and database-less runs. */
export class InMemorySpecStatePort implements SpecificationStatePort {
  private readonly states = new Map<string, SpecLifecycleState>();

  get(specificationId: string): SpecLifecycleState | undefined {
    return this.states.get(specificationId);
  }

  set(specificationId: string, state: SpecLifecycleState): void {
    this.states.set(specificationId, state);
  }
}
