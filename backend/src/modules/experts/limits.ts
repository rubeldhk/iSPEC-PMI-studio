/**
 * `T1959`, `T1963` (EPIC-047) — session limits.
 *
 * `FR-EXP-040`…`FR-EXP-046`, `ADR-0027` rule 4, `R-047-7`. Three rules carry
 * the honesty this Epic is about:
 *
 * - **Narrowed, never widened.** A request above its contract gets the
 *   contract's value; what it asked for is kept beside it (`FR-EXP-044`).
 * - **Enforced only with a control.** Time is enforced everywhere — the run's
 *   context carries a timeout and an abort signal. Tokens, cost and resource are
 *   `enforced` only where the runner declares the control; otherwise they read
 *   `unenforceable`, never `enforced` (`FR-EXP-042`). With the clarified
 *   default, an unenforceable money limit refuses the dispatch (`FR-EXP-043`).
 * - **Unreported is not zero; late is not prevented.** Consumption a provider
 *   did not report is `null` with a reason (`FR-EXP-045`); a breach found after
 *   the run is `detected-late` with the instant (`FR-EXP-046`).
 *
 * A delegate's consumption is charged up its chain (`FR-EXP-036`), so a chain
 * cannot spend past its root's budget by splitting the work.
 */
import type { EnforceableLimit } from '@pmi/agent-contract';
import { LIMIT_KINDS, defaultPosture, type Budget, type LimitKind, type SessionLimit } from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';
import type { RunReport } from './experts.tokens.js';

export type PlannedLimit = Omit<SessionLimit, 'executionId'>;

export interface LimitPlan {
  readonly limits: readonly PlannedLimit[];
  readonly narrowed: readonly { limit: LimitKind; requested: number; applied: number }[];
  /** Limits applied without a provider control — recorded, and refused where the posture says so. */
  readonly unenforceable: readonly LimitKind[];
  readonly refusal: string | null;
}

export function planLimits(
  budget: Budget,
  requested: Partial<Record<LimitKind, number>>,
  enforceable: readonly EnforceableLimit[] | undefined,
): LimitPlan {
  const limits: PlannedLimit[] = [];
  const narrowed: { limit: LimitKind; requested: number; applied: number }[] = [];
  const unenforceable: LimitKind[] = [];
  const refusals: string[] = [];

  for (const kind of LIMIT_KINDS) {
    const setting = budget[kind];
    const asked = requested[kind];
    if (setting === undefined && asked === undefined) continue;
    const contractValue = setting?.value;
    const value =
      contractValue === undefined ? asked! : asked === undefined ? contractValue : Math.min(asked, contractValue);
    if (asked !== undefined && contractValue !== undefined && asked > contractValue) {
      narrowed.push({ limit: kind, requested: asked, applied: contractValue });
    }
    const enforced = kind === 'time' || (enforceable ?? []).includes(kind);
    if (!enforced) {
      unenforceable.push(kind);
      const posture = setting?.onUnenforceable ?? defaultPosture(kind);
      if (posture === 'refuse') {
        refusals.push(
          `the ${kind} limit cannot be enforced by this provider, and the contract's posture for an ` +
            `unenforceable ${kind} limit is to refuse (FR-EXP-043)`,
        );
      }
    }
    limits.push({
      limit: kind,
      value,
      requested: asked ?? null,
      enforcement: enforced ? 'enforced' : 'unenforceable',
      consumed: null,
      consumedReason: 'not yet reported',
      reached: 'no',
      detectedAt: null,
    });
  }
  return { limits, narrowed, unenforceable, refusal: refusals.length > 0 ? refusals.join('; ') : null };
}

/**
 * `T2009`, `R-047-7`, `FR-EXP-036` — what the chain above a delegate has left
 * of each token, cost and resource limit: the smallest `value - consumed`
 * across every ancestor that has the limit. Time is per session and not shared.
 */
export async function chainRemaining(
  store: ExpertsStore,
  workspaceId: string,
  parentExecutionId: string,
): Promise<Partial<Record<LimitKind, number>>> {
  const out: Partial<Record<LimitKind, number>> = {};
  const seen = new Set<string>();
  let walk: string | null = parentExecutionId;
  while (walk !== null && !seen.has(walk)) {
    seen.add(walk);
    const session = await store.findSession(workspaceId, walk);
    if (session === null) break;
    for (const row of await store.limitsFor(workspaceId, walk)) {
      if (row.limit === 'time') continue;
      const left = row.value - (row.consumed ?? 0);
      out[row.limit] = Math.min(out[row.limit] ?? Number.POSITIVE_INFINITY, left);
    }
    walk = session.delegatedFromExecutionId;
  }
  return out;
}

export interface ChainCap {
  readonly plan: LimitPlan;
  /** Each limit lowered (or added) to the chain's remaining budget; `requested` is null where the delegate had none. */
  readonly capped: readonly { limit: LimitKind; requested: number | null; applied: number }[];
  readonly refusal: string | null;
}

/**
 * `T2009` — cap a delegate's plan at its chain's remaining budget. A limit the
 * delegate lacks but its chain has is added at what is left: a delegate cannot
 * be unlimited where the chain above it is limited. A chain with nothing left
 * of a limit delegates nothing. Added limits follow the delegate's runner for
 * enforceability and are recorded, not refused — the chain's own posture was
 * applied when its root was dispatched.
 */
export function capByChain(
  plan: LimitPlan,
  remaining: Partial<Record<LimitKind, number>>,
  enforceable: readonly EnforceableLimit[] | undefined,
): ChainCap {
  const limits = [...plan.limits];
  const unenforceable = [...plan.unenforceable];
  const capped: { limit: LimitKind; requested: number | null; applied: number }[] = [];
  const empty: LimitKind[] = [];
  for (const kind of LIMIT_KINDS) {
    const left = remaining[kind];
    if (kind === 'time' || left === undefined) continue;
    if (left <= 0) {
      empty.push(kind);
      continue;
    }
    const at = limits.findIndex((l) => l.limit === kind);
    if (at >= 0) {
      const existing = limits[at]!;
      if (existing.value > left) {
        limits[at] = { ...existing, value: left };
        capped.push({ limit: kind, requested: existing.value, applied: left });
      }
      continue;
    }
    const enforced = (enforceable ?? []).includes(kind);
    if (!enforced) unenforceable.push(kind);
    limits.push({
      limit: kind,
      value: left,
      requested: null,
      enforcement: enforced ? 'enforced' : 'unenforceable',
      consumed: null,
      consumedReason: 'not yet reported',
      reached: 'no',
      detectedAt: null,
    });
    capped.push({ limit: kind, requested: null, applied: left });
  }
  return {
    plan: { ...plan, limits, unenforceable },
    capped,
    refusal:
      empty.length > 0
        ? empty.map((k) => `the delegation chain has no ${k} budget left, so it delegates nothing more (FR-EXP-036)`).join('; ')
        : null,
  };
}

/** What a report says was consumed, per limit; `undefined` where it said nothing. */
export function reported(report: RunReport): Partial<Record<LimitKind, number>> {
  const out: Partial<Record<LimitKind, number>> = {};
  if (report.consumption?.tokens !== undefined) out.tokens = report.consumption.tokens;
  if (report.consumption?.cost !== undefined) out.cost = report.consumption.cost;
  const resource = report.consumption?.resource ?? report.toolCalls?.length;
  if (resource !== undefined) out.resource = resource;
  return out;
}

export interface Breach {
  readonly executionId: string;
  readonly limit: LimitKind;
  readonly consumed: number;
  readonly value: number;
}

/**
 * `FR-EXP-036`, `FR-EXP-045`, `FR-EXP-046` — add a run's reported consumption
 * to its own limits and to every ancestor's. Returns the limits that crossed
 * their value as a result, each now `detected-late`.
 */
export async function chargeConsumption(
  store: ExpertsStore,
  workspaceId: string,
  executionId: string,
  amounts: Partial<Record<LimitKind, number>>,
  at: string,
): Promise<Breach[]> {
  const breaches: Breach[] = [];
  let walk: string | null = executionId;
  let own = true;
  while (walk !== null) {
    const session = await store.findSession(workspaceId, walk);
    if (session === null) break;
    for (const row of await store.limitsFor(workspaceId, walk)) {
      if (row.limit === 'time') continue;
      const amount = amounts[row.limit];
      if (amount === undefined) {
        if (own) {
          await store.noteUnreported(
            workspaceId,
            walk,
            row.limit,
            `the provider did not report ${row.limit} consumption for this run (FR-EXP-045)`,
          );
        }
        continue;
      }
      // `T2007` — atomic, so a sibling charging the same ancestor cannot overwrite this charge.
      const charged = await store.chargeLimit(workspaceId, walk, row.limit, amount, at);
      if (charged?.crossed) {
        breaches.push({ executionId: walk, limit: row.limit, consumed: charged.consumed, value: charged.value });
      }
    }
    walk = session.delegatedFromExecutionId;
    own = false;
  }
  return breaches;
}
