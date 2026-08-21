/**
 * T344 + T347 — run mode selection, the stop-point range, and the two ways a
 * run ends early (FR-RUN-001, FR-RUN-002, FR-RUN-008, FR-RUN-008a).
 *
 * The organising idea of the epic: an unattended run NEVER decides. It defers,
 * marks, and carries on — so nothing here has a "pause" state. A run is
 * `running` until it reaches the user-selected stop point (a SUCCESS state,
 * not a failure), fails unrecoverably (preserving every piece of completed
 * work), or is cancelled (keeping the questions recorded so far).
 *
 * A Run is not a GenerationJob (R-002-1): one run spans many engine
 * invocations across the selected range.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';

const OPAQUE = 'Not found.';

export type RunMode = 'interactive' | 'unattended';
export type RunStopRange = 'after_specification' | 'through_tasks';
export type RunState = 'running' | 'reached_stop_point' | 'failed' | 'cancelled';

export const RUN_MODES: readonly RunMode[] = ['interactive', 'unattended'];
export const RUN_STOP_RANGES: readonly RunStopRange[] = ['after_specification', 'through_tasks'];

/** Terminal states are final — no transition leaves them except `continue`. */
const TERMINAL: readonly RunState[] = ['failed', 'cancelled'];

export interface RunRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  mode: RunMode;
  stopRange: RunStopRange;
  state: RunState;
  /** Resolved grants at start (FR-ACC-028, R-002-4) — written by EPIC-024. */
  accessSnapshot: unknown | null;
  initiatedById: string;
  startedAt: Date;
  endedAt: Date | null;
  outcomeReason: string | null;
}

export interface RunStore {
  create(run: Omit<RunRecord, 'id'>): Promise<RunRecord>;
  find(workspaceId: string, id: string): Promise<RunRecord | null>;
  listForProject(workspaceId: string, projectId: string): Promise<RunRecord[]>;
  update(workspaceId: string, id: string, patch: Partial<RunRecord>): Promise<RunRecord>;
}

export interface StartRunInput {
  projectId: string;
  mode?: string;
  stopRange?: string;
  initiatedById: string;
  accessSnapshot?: unknown;
}

export class RunModeService {
  constructor(private readonly runs: RunStore) {}

  /** FR-RUN-001/002 — mode and stop range are the user's selection, required. */
  async start(workspaceId: string, input: StartRunInput, at?: Date): Promise<RunRecord> {
    if (!input.mode || !RUN_MODES.includes(input.mode as RunMode)) {
      throw new ValidationFailedError('A run requires a mode.', {
        fields: [{ field: 'mode', reason: `Must be one of: ${RUN_MODES.join(', ')}.` }],
      });
    }
    if (!input.stopRange || !RUN_STOP_RANGES.includes(input.stopRange as RunStopRange)) {
      throw new ValidationFailedError('A run requires a stop range.', {
        fields: [{ field: 'stopRange', reason: `Must be one of: ${RUN_STOP_RANGES.join(', ')}.` }],
      });
    }
    return this.runs.create({
      workspaceId,
      projectId: input.projectId,
      mode: input.mode as RunMode,
      stopRange: input.stopRange as RunStopRange,
      state: 'running',
      accessSnapshot: input.accessSnapshot ?? null,
      initiatedById: input.initiatedById,
      startedAt: at ?? new Date(),
      endedAt: null,
      outcomeReason: null,
    });
  }

  async get(workspaceId: string, id: string): Promise<RunRecord> {
    const run = await this.runs.find(workspaceId, id);
    if (!run) throw new NotFoundError(OPAQUE);
    return run;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<RunRecord[]> {
    return this.runs.listForProject(workspaceId, projectId);
  }

  /**
   * FR-RUN-008a — the run stops at the range the user selected AND REPORTS
   * THAT IT DID. A success state: the run has done its job.
   */
  async reachStopPoint(workspaceId: string, id: string, at?: Date): Promise<RunRecord> {
    const run = await this.requireRunning(workspaceId, id);
    return this.runs.update(workspaceId, run.id, {
      state: 'reached_stop_point',
      endedAt: at ?? new Date(),
      outcomeReason: `Stopped at the selected range: ${run.stopRange}.`,
    });
  }

  /**
   * T347 — FR-RUN-008: a condition the run cannot proceed past stops it,
   * PRESERVES every piece of completed work, and records the reason. Distinct
   * from `reached_stop_point`, which is a success. Nothing is deleted here —
   * questions, markings, and artifacts produced so far all survive, because
   * this method touches only the run row.
   */
  async failUnrecoverable(
    workspaceId: string,
    id: string,
    reason: string,
    at?: Date,
  ): Promise<RunRecord> {
    if (!reason || reason.trim() === '') {
      throw new ValidationFailedError('An unrecoverable stop requires a recorded reason.', {
        fields: [{ field: 'reason', reason: 'Required.' }],
      });
    }
    const run = await this.requireRunning(workspaceId, id);
    return this.runs.update(workspaceId, run.id, {
      state: 'failed',
      endedAt: at ?? new Date(),
      outcomeReason: reason,
    });
  }

  /** A cancelled run keeps the questions recorded so far (parent data model). */
  async cancel(workspaceId: string, id: string, at?: Date): Promise<RunRecord> {
    const run = await this.requireRunning(workspaceId, id);
    return this.runs.update(workspaceId, run.id, {
      state: 'cancelled',
      endedAt: at ?? new Date(),
      outcomeReason: 'Cancelled by the user. Questions recorded so far are preserved.',
    });
  }

  /** Continues past a `reached_stop_point` run (contract · Runs). */
  async continue(workspaceId: string, id: string): Promise<RunRecord> {
    const run = await this.get(workspaceId, id);
    if (run.state !== 'reached_stop_point') {
      throw new ConflictError(
        `Only a run at its stop point can continue — this one is "${run.state}".`,
      );
    }
    return this.runs.update(workspaceId, run.id, {
      state: 'running',
      stopRange: 'through_tasks',
      endedAt: null,
      outcomeReason: null,
    });
  }

  private async requireRunning(workspaceId: string, id: string): Promise<RunRecord> {
    const run = await this.get(workspaceId, id);
    if (TERMINAL.includes(run.state) || run.state === 'reached_stop_point') {
      throw new ConflictError(`This run already ended as "${run.state}" — terminal states are final.`);
    }
    return run;
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryRunStore implements RunStore {
  private readonly rows = new Map<string, RunRecord>();
  private seq = 0;

  async create(run: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const row: RunRecord = { id: `run_${++this.seq}`, ...run };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async find(workspaceId: string, id: string): Promise<RunRecord | null> {
    const row = this.rows.get(id);
    // Wrong tenant is ABSENT, never forbidden (FR-002 / layer 1).
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<RunRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId)
      .map((r) => ({ ...r }));
  }

  async update(workspaceId: string, id: string, patch: Partial<RunRecord>): Promise<RunRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const next = { ...row, ...patch };
    this.rows.set(id, next);
    return { ...next };
  }
}
