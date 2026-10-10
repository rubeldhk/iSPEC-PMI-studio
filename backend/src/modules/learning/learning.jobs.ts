/**
 * `T2359`, `T2361`, `T2369`, `T2377` (EPIC-048) — the learning sweeps.
 *
 * `EPIC-031` emits nothing when a decision resolves (no emitter, subscription or
 * outbox), so this Epic learns resolutions by reading them (`R-048-7`). Each job
 * is a named handler run through `run(name)` — the runner tests drive, wrapped in
 * the platform's `runWithLimits` so a sweep has a hard ceiling — and scheduled by
 * `LearningSweeps` when the deployment turns sweeps on.
 *
 * | Job | Interval | Does |
 * |---|---|---|
 * | `learning.resolve-decisions` | 30 s | `resolutionOf` for `pending-review` → materialise, return or close |
 * | `learning.request-pending` | 60 s | decisions after an outage, after reconciliation, and again for a guard-returned candidate (≤ 3) |
 * | `learning.expire` | hourly | past the review window → `expired` (`FR-LRN-030`) |
 * | `learning.flags` | hourly | evidence and source-execution changes → flags (`FR-LRN-037`) |
 * | `learning.retrievability` | 10 min | retry not-yet-retrievable versions (`FR-LRN-053`) |
 *
 * **No job writes knowledge directly.** Every resolution goes through the
 * materialiser; `T2332` asserts this file never names the writer.
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import { runWithLimits } from '../jobs/job-runner.service.js';
import { MAX_DECISION_ATTEMPTS, type DecisionRequester } from './decision.requester.js';
import type { LearningStore } from './learning.store.js';
import type { LearningPorts } from './learning.tokens.js';
import type { Materialiser } from './materialiser.js';

export const LEARNING_JOB_INTERVALS_MS = Object.freeze({
  'learning.resolve-decisions': 30_000,
  'learning.request-pending': 60_000,
  'learning.expire': 3_600_000,
  'learning.flags': 3_600_000,
  'learning.retrievability': 600_000,
} as const);
export type LearningJobName = keyof typeof LEARNING_JOB_INTERVALS_MS;
export const LEARNING_JOB_NAMES = Object.freeze(Object.keys(LEARNING_JOB_INTERVALS_MS) as LearningJobName[]);

export interface JobReport {
  readonly job: LearningJobName;
  readonly outcome: 'succeeded' | 'failed' | 'timed_out' | 'cancelled';
  readonly examined: number;
  readonly changed: number;
  readonly errors: readonly string[];
}

export interface RunOptions {
  /** One workspace, or every workspace with work when omitted. */
  readonly workspaceId?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface LearningJobsDeps {
  readonly store: LearningStore;
  readonly ports: LearningPorts;
  readonly materialiser: Pick<Materialiser, 'applyResolution'>;
  readonly requester: Pick<DecisionRequester, 'request' | 'attempts'>;
  readonly now?: () => Date;
}

type Tally = { examined: number; changed: number; errors: string[] };
type Handler = (options: RunOptions, tally: Tally) => Promise<void>;

/** Reasons a `proposed` candidate is asked for again; anything else waits for a person or a policy change. */
const RETRY_REASONS = new Set(['decision-path-unavailable', 'decision-not-accepted', 'policy-auto-executed-review']);

export class LearningJobs {
  protected readonly now: () => Date;
  protected readonly handlers = new Map<LearningJobName, Handler>();

  constructor(protected readonly deps: LearningJobsDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.handlers.set('learning.resolve-decisions', (o, t) => this.resolveDecisions(o, t));
    this.handlers.set('learning.request-pending', (o, t) => this.requestPending(o, t));
  }

  /** Run one job by name, under a hard time limit. Per-item failures are reported, not thrown. */
  async run(name: LearningJobName, options: RunOptions = {}): Promise<JobReport> {
    const handler = this.handlers.get(name);
    if (handler === undefined) {
      throw new ValidationFailedError(`Unknown learning job "${String(name)}". Jobs: ${[...this.handlers.keys()].join(', ')}.`);
    }
    const tally: Tally = { examined: 0, changed: 0, errors: [] };
    const outcome = await runWithLimits(() => handler(options, tally), { timeoutMs: options.timeoutMs ?? 120_000, ...(options.signal ? { signal: options.signal } : {}) });
    if (outcome.outcome === 'failed') tally.errors.push(String(outcome.reason));
    return { job: name, outcome: outcome.outcome, examined: tally.examined, changed: tally.changed, errors: tally.errors };
  }

  /** `R-048-7` — decisions resolved elsewhere (EPIC-031's own Inbox) reach the materialiser here. */
  private async resolveDecisions(options: RunOptions, tally: Tally): Promise<void> {
    for (const { candidate, current } of await this.deps.store.candidatesInStates(['pending-review'], options.workspaceId)) {
      tally.examined += 1;
      if (current.decisionId === null) continue;
      try {
        const resolution = await this.deps.ports.decisions.resolutionOf(candidate.workspaceId, current.decisionId);
        if (resolution === null) continue;
        await this.deps.materialiser.applyResolution(candidate.workspaceId, candidate.id, resolution);
        tally.changed += 1;
      } catch (err) {
        tally.errors.push(`${candidate.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * `FR-LRN-063`, `FR-LRN-030`, `R-048-6` (I1) — ask for a decision again where
   * asking can now succeed: the path is back, the execution is reconciled, or the
   * guard returned the candidate. Bounded at {@link MAX_DECISION_ATTEMPTS}.
   */
  private async requestPending(options: RunOptions, tally: Tally): Promise<void> {
    for (const { candidate, current } of await this.deps.store.candidatesInStates(['proposed'], options.workspaceId)) {
      tally.examined += 1;
      try {
        const neverAsked = (await this.deps.requester.attempts(candidate)) === 0 && current.reason !== 'decision-path-unavailable';
        if (candidate.provisional && neverAsked) {
          if (candidate.executionId === null) continue;
          const facts = await this.deps.ports.executions.describe(candidate.workspaceId, candidate.executionId);
          if (facts?.governanceState !== 'governed') continue;
          await this.deps.requester.request(candidate, { reconciled: true });
          tally.changed += 1;
          continue;
        }
        if (current.reason === null || !RETRY_REASONS.has(current.reason)) continue;
        if (current.reason !== 'decision-path-unavailable' && (await this.deps.requester.attempts(candidate)) >= MAX_DECISION_ATTEMPTS) continue;
        await this.deps.requester.request(candidate, candidate.provisional ? { reconciled: true } : {});
        tally.changed += 1;
      } catch (err) {
        tally.errors.push(`${candidate.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
