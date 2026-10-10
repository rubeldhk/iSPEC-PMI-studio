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
import { retryMissingAttestations } from './attestation.js';
import { MAX_DECISION_ATTEMPTS, type DecisionRequester } from './decision.requester.js';
import { stateOf } from './evidence.view.js';
import { LEARNING_POLICY_DEFAULTS, type LearningPolicyReader } from './learning-policy.js';
import { newLearningId, type CandidateRecord, type FlagRecord, type LearningStore } from './learning.store.js';
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
  /** The instant the sweep judges against — the clock, unless a test or a backfill says otherwise. */
  readonly asOf?: Date;
}

export interface LearningJobsDeps {
  readonly store: LearningStore;
  readonly ports: LearningPorts;
  readonly materialiser: Pick<Materialiser, 'applyResolution'>;
  readonly requester: Pick<DecisionRequester, 'request' | 'attempts'>;
  readonly policy?: Pick<LearningPolicyReader, 'current'>;
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
    this.handlers.set('learning.expire', (o, t) => this.expire(o, t));
    this.handlers.set('learning.flags', (o, t) => this.flags(o, t));
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
   * `FR-LRN-037` (T2369) — flags, never status changes. Deprecation is a human
   * decision; the platform only says *look at this again*.
   *
   * - `evidence-changed` on a current version whose citations are no longer all
   *   verified, cleared by a later row when they are;
   * - `source-invalid` on a current version, and on an open candidate (`C3`),
   *   whose source execution carries an invalidating governance event
   *   (`R-048-17`) — permanent, since the registry is append-only;
   * - the attestation retry (`R-048-19`).
   *
   * An unreachable Evidence Store or registry is reported, never read as change.
   */
  private async flags(options: RunOptions, tally: Tally): Promise<void> {
    const { store, ports } = this.deps;
    const at = this.now();
    const openOf = async (workspaceId: string, ref: { versionId?: string; candidateId?: string }, kind: FlagRecord['kind']): Promise<FlagRecord[]> => {
      const all = await store.flags(workspaceId, ref);
      const cleared = new Set(all.map((f) => f.clearsFlagId).filter((id): id is string => id !== null));
      return all.filter((f) => f.kind === kind && f.clearsFlagId === null && !cleared.has(f.id));
    };
    const raise = (workspaceId: string, ref: { versionId?: string; candidateId?: string }, kind: FlagRecord['kind'], detail: string, clears: string | null = null): Promise<void> =>
      store.transaction((tx) =>
        tx.appendFlag({ id: newLearningId('kf'), workspaceId, versionId: ref.versionId ?? null, candidateId: ref.candidateId ?? null, kind, detail, raisedAt: at, clearsFlagId: clears }),
      );
    const invalidity = async (candidate: CandidateRecord): Promise<readonly string[]> => {
      if (candidate.executionId === null) return [];
      const facts = await ports.executions.describe(candidate.workspaceId, candidate.executionId);
      return facts?.invalidatedBy ?? [];
    };

    for (const version of await store.currentVersions(options.workspaceId)) {
      tally.examined += 1;
      const ws = version.workspaceId;
      const candidate = await store.candidate(ws, version.candidateId);
      if (candidate === null) continue;
      const ref = { versionId: version.id };

      try {
        const citations = (await store.citations(ws, candidate.id)).filter((c) => c.corroborationId === null);
        const resolved = await ports.evidence.resolve(ws, citations.map((c) => c.evidenceId));
        const broken = citations.map((c) => ({ id: c.evidenceId, state: stateOf(c, resolved.get(c.evidenceId)) })).filter((c) => c.state !== 'verified');
        const open = await openOf(ws, ref, 'evidence-changed');
        if (broken.length > 0 && open.length === 0) {
          await raise(ws, ref, 'evidence-changed', `evidence changed since approval: ${broken.map((b) => `${b.id} ${b.state}`).join(', ')}`);
          tally.changed += 1;
        } else if (broken.length === 0) {
          for (const f of open) await raise(ws, ref, 'evidence-changed', 'every citation verified again', f.id);
          tally.changed += open.length;
        }
      } catch (err) {
        tally.errors.push(`${version.id} evidence: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        const invalid = await invalidity(candidate);
        if (invalid.length > 0 && (await openOf(ws, ref, 'source-invalid')).length === 0) {
          await raise(ws, ref, 'source-invalid', `source execution ${candidate.executionId} carries ${invalid.join(', ')}`);
          tally.changed += 1;
        }
      } catch (err) {
        tally.errors.push(`${version.id} source: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // C3 — an open candidate from an invalid source is flagged before anyone decides it.
    for (const { candidate } of await store.candidatesInStates(['proposed', 'pending-review'], options.workspaceId)) {
      tally.examined += 1;
      try {
        const invalid = await invalidity(candidate);
        const ref = { candidateId: candidate.id };
        if (invalid.length > 0 && (await openOf(candidate.workspaceId, ref, 'source-invalid')).length === 0) {
          await raise(candidate.workspaceId, ref, 'source-invalid', `source execution ${candidate.executionId} carries ${invalid.join(', ')}`);
          tally.changed += 1;
        }
      } catch (err) {
        tally.errors.push(`${candidate.id} source: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const retried = await retryMissingAttestations({ store, ports, now: this.now }, options.workspaceId);
    tally.changed += retried.contributed;
    tally.errors.push(...retried.failed);
  }

  /**
   * `FR-LRN-030` (T2361) — past the review window a candidate reads `expired`,
   * distinct from `rejected`. A pending one's decision is first refused by the
   * requesting automation with kind `expired` (`A-031-1`), so it leaves the
   * Inbox; if that refusal cannot be made, the candidate is left as it is and the
   * failure is reported — expiring it locally would leave an open decision
   * behind it (`R-048-14`).
   */
  private async expire(options: RunOptions, tally: Tally): Promise<void> {
    const asOf = (options.asOf ?? this.now()).getTime();
    const windows = new Map<string, number>();
    const windowDays = async (ws: string): Promise<number> => {
      if (!windows.has(ws)) {
        const p = this.deps.policy === undefined ? null : await this.deps.policy.current(ws);
        windows.set(ws, p?.state === 'ok' ? p.policy.reviewWindowDays : LEARNING_POLICY_DEFAULTS.reviewWindowDays);
      }
      return windows.get(ws)!;
    };
    for (const { candidate, current } of await this.deps.store.candidatesInStates(['proposed', 'pending-review'], options.workspaceId)) {
      tally.examined += 1;
      const days = await windowDays(candidate.workspaceId);
      if (candidate.submittedAt.getTime() + days * 86_400_000 > asOf) continue;
      const reason = `review window of ${days} days elapsed`;
      try {
        if (current.state === 'pending-review' && current.decisionId !== null) {
          const resolution = await this.deps.ports.decisions.refuse({
            workspaceId: candidate.workspaceId,
            decisionId: current.decisionId,
            by: { kind: 'automation', id: 'learning-intake' },
            kind: 'expired',
            reason,
          });
          await this.deps.materialiser.applyResolution(candidate.workspaceId, candidate.id, resolution);
        } else {
          await this.deps.store.transaction((tx) =>
            tx.appendTransition({ workspaceId: candidate.workspaceId, candidateId: candidate.id, state: 'expired', reason, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date(asOf) }),
          );
        }
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
