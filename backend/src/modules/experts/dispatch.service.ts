/**
 * `T1932`…`T1942`, `T1989` (EPIC-047) — the gate before an Expert runs.
 *
 * `FR-EXP-012`…`FR-EXP-024`, `FR-EXP-060`…`FR-EXP-063`. A dispatch is checked
 * against the Expert's **approved** contract and against the requester's own
 * authority, and only then run. The order is the design:
 *
 * 1. **Shape** — a request with no objective or project is the caller's
 *    mistake, refused `400` before anything is registered.
 * 2. **Registration** — the run is registered with `EPIC-037` before any
 *    governance check, so that every refusal after this point is an event on a
 *    real execution, returned with its id (`FR-EXP-061`). A refused dispatch is
 *    a fact somebody can open, not a log line.
 * 3. **Checks** — retired, no approved version, not a governed command, a
 *    dangling Evidence Contract, the contract, the targets, a runner for a
 *    declared model that meets the workspace requirements, then context.
 * 4. **Run** — a session row naming the version it started under, the run,
 *    then what it reported: tool use (observed or not), outputs, outcome.
 * 5. **Close** — complete the execution; or, for unattended work, record that it
 *    needs review and **propose** its completion (`FR-EXP-063`).
 *
 * Every port is read from the holder at call time (`ExpertPorts`), so Phase 9's
 * bindings — and route tests' in-test ones — are the ones a call uses.
 */
import { assertAgentCapabilities, type AgentCapability } from '@pmi/agent-contract';
import { GOVERNED_COMMANDS } from '@pmi/execution-registry-contract';
import { NotFoundError, PlatformError, ValidationFailedError } from '../../core/errors.js';
import { effectiveVersion } from './approval.js';
import { currentAssignment } from './assignment.service.js';
import { authorityOf, contractRefusal, targetRefusal, type DispatchTarget } from './authority.js';
import { admitDelegation, DelegationRefusal } from './delegation.service.js';
import type { ExpertContract, ExpertSession, LimitKind, SessionOutcome } from './expert.types.js';
import { chargeConsumption, planLimits, reported } from './limits.js';
import type { ExpertsStore } from './experts.store.js';
import type { ActorAccess, ExpertGateways, ExpertPorts, ExpertRunner, RunReport } from './experts.tokens.js';

export interface DispatchRequest {
  readonly expertId: string;
  /** A member of `GOVERNED_COMMANDS` (`R-047-3`). */
  readonly command: string;
  readonly objective: string;
  readonly projectId: string;
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  /** Actions the run will take, checked against the prohibited list (`FR-EXP-013`). */
  readonly actions: readonly string[];
  readonly targets: readonly DispatchTarget[];
  readonly unattended?: boolean;
  /** `FR-EXP-044` — the request's own limits; narrowed to the contract's where higher. */
  readonly limits?: Partial<Record<LimitKind, number>>;
  /** `FR-EXP-053` — the task this run is for; it must stand assigned to this Expert. */
  readonly taskId?: string;
  /** `FR-EXP-031` — the running session this run is delegated from. */
  readonly delegatedFromExecutionId?: string;
}

export interface Actor {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: string;
}

export interface DispatchResult {
  readonly executionId: string;
  readonly contractVersion: number;
  readonly model: string;
  readonly usedFallback: boolean;
  readonly toolObservation: ExpertSession['toolObservation'];
  readonly contextPackageId: string;
  readonly outcome: SessionOutcome;
  readonly reviewRequired: boolean;
}

export interface DispatchDeps {
  readonly access: ActorAccess;
  /** Read at call time. */
  readonly ports: ExpertPorts;
  readonly clock?: () => string;
}

export type RunnerChoice =
  | { readonly runner: ExpertRunner; readonly model: string; readonly usedFallback: boolean; readonly fallbackReason: string | null }
  | { readonly refused: string };

/** A refusal decided after registration; the service records it before throwing. */
class Refusal extends Error {}

/**
 * `FR-EXP-017`, `FR-EXP-018`, `FR-EXP-019`, `FR-EXP-023` — the preferred model,
 * else the first declared fallback, whose runner covers the capabilities and
 * meets the workspace requirements. Never a model the contract did not name.
 */
export async function selectRunner(
  contract: ExpertContract,
  capabilities: readonly string[],
  gateways: ExpertGateways,
  options: { readonly unattended?: boolean },
): Promise<RunnerChoice> {
  const declared = [contract.models.preferred, ...contract.models.fallbacks];
  const req = contract.workspaceRequirements;
  const unmet: string[] = [];
  const passed: string[] = [];
  for (const model of declared) {
    for (const runner of await gateways.gatewaysFor(model)) {
      const d = runner.descriptor;
      try {
        assertAgentCapabilities(d, capabilities as AgentCapability[]);
      } catch {
        continue;
      }
      const missing: string[] = [];
      if (req.executionType && d.executionType !== req.executionType) missing.push(`execution type ${req.executionType}`);
      for (const access of req.repositoryAccess ?? []) {
        if (!d.repositoryCapabilities.includes(access)) missing.push(`repository access ${access}`);
      }
      if ((req.supportsUnattended || options.unattended) && !d.supportsUnattended) missing.push('unattended execution');
      if (missing.length > 0) {
        unmet.push(`${model}: ${missing.join(', ')}`);
        continue;
      }
      const usedFallback = model !== contract.models.preferred;
      return {
        runner,
        model,
        usedFallback,
        fallbackReason: usedFallback
          ? `the preferred model ${contract.models.preferred} had no runner able to take this run` +
            (passed.length > 0 ? ` (tried: ${passed.join(', ')})` : '')
          : null,
      };
    }
    passed.push(model);
  }
  if (unmet.length > 0) {
    return { refused: `no runner meets the contract's workspace requirements — ${unmet.join('; ')} (FR-EXP-019)` };
  }
  return {
    refused: `no declared model has a runner for these capabilities — no declared model among ${declared.join(', ')} is available, and an undeclared one is never used (FR-EXP-018)`,
  };
}

export class DispatchService {
  readonly #clock: () => string;
  /** Runs in flight in this process, so a parent's end can stop its delegates (`FR-EXP-037`). */
  readonly #running = new Map<string, AbortController>();

  constructor(
    private readonly store: ExpertsStore,
    private readonly deps: DispatchDeps,
  ) {
    this.#clock = deps.clock ?? (() => new Date().toISOString());
  }

  async dispatch(actor: Actor, req: DispatchRequest): Promise<DispatchResult> {
    // 1 — the caller's own mistakes, before anything is registered.
    const objective = typeof req.objective === 'string' ? req.objective.trim() : '';
    const projectId = typeof req.projectId === 'string' ? req.projectId.trim() : '';
    if (objective === '') throw new ValidationFailedError('a dispatch needs an objective');
    if (projectId === '') throw new ValidationFailedError('a dispatch needs a projectId');
    for (const [name, list] of [
      ['capabilities', req.capabilities],
      ['tools', req.tools],
      ['actions', req.actions],
      ['targets', req.targets],
    ] as const) {
      if (!Array.isArray(list)) throw new ValidationFailedError(`${name} must be a list`);
    }
    if (req.capabilities.length === 0) throw new ValidationFailedError('a dispatch must name at least one capability');

    const ws = actor.workspaceId;
    const ports = this.deps.ports;
    const expert = await this.store.findExpert(ws, req.expertId);
    if (expert === null) throw new NotFoundError('Not found.');
    const versions = await this.store.versionsFor(ws, expert.id);
    const effective = await effectiveVersion(versions, ports.approvals);
    const shown = effective ?? versions[versions.length - 1]!;

    // 2 — registered before any governance check (Constitution XII).
    const { executionId } = await ports.executions.register({
      workspaceId: ws,
      projectId,
      command: req.command,
      actorId: actor.userId,
      expertKey: expert.key,
      contractVersion: shown.version,
      model: shown.contract.models.preferred,
      objective,
    });

    // `FR-EXP-061` — set once the session row exists. Before it, a failure is a
    // refused dispatch; after it, the dispatch was admitted and a failure is a
    // failed run (`T2001`).
    let started = false;
    let closed = false;
    try {
      // 3 — the checks.
      if (expert.status === 'retired') throw new Refusal(`Expert '${expert.key}' is retired (FR-EXP-006)`);
      if (effective === null) {
        throw new Refusal(`Expert '${expert.key}' has no approved contract version, so nothing may run under it (FR-EXP-005)`);
      }
      const contract = effective.contract;
      if (!(GOVERNED_COMMANDS as readonly string[]).includes(req.command)) {
        throw new Refusal(`'${req.command}' is not a governed command; Expert runs execute governed commands only (R-047-3)`);
      }
      const ref = contract.evidenceContract;
      if (!(await ports.evidence.exists(ref))) {
        throw new Refusal(
          `the contract's Evidence Contract ${ref.workClass}@${ref.contractVersion} no longer exists; ` +
            'new runs are refused until the contract is re-versioned (FR-EXP-022)',
        );
      }
      if (req.taskId !== undefined) {
        const held = await currentAssignment(this.store, ports.approvals, ws, req.taskId);
        if (held === null || held.assigneeKind !== 'expert' || held.assigneeId !== expert.id) {
          throw new Refusal(`task ${req.taskId} is not assigned to ${expert.key} (FR-EXP-053)`);
        }
        if (held.state !== 'standing') {
          throw new Refusal(`task ${req.taskId}'s assignment to ${expert.key} is ${held.state}, not standing (FR-EXP-054)`);
        }
      }

      // `FR-EXP-030`…`FR-EXP-035` — a delegate is admitted by contract and policy,
      // and its authority is intersected down the chain.
      let authority = authorityOf(contract);
      let depth = 0;
      let parentId: string | null = null;
      if (req.delegatedFromExecutionId !== undefined) {
        const admitted = await admitDelegation(this.store, ws, req.delegatedFromExecutionId, expert, contract);
        authority = admitted.authority;
        depth = admitted.depth;
        parentId = admitted.parent.executionId;
      }
      const byContract = contractRefusal(authority, req);
      if (byContract) throw new Refusal(byContract);
      const byTarget = await targetRefusal(ws, actor.userId, authority, req.targets, this.deps.access);
      if (byTarget) throw new Refusal(byTarget);

      const choice = await selectRunner(contract, req.capabilities, ports.gateways, { unattended: req.unattended === true });
      if ('refused' in choice) throw new Refusal(choice.refused);

      // `FR-EXP-040`…`FR-EXP-044` — what this provider can enforce decides what may run.
      const plan = planLimits(contract.budget, req.limits ?? {}, choice.runner.descriptor.enforceableLimits);
      if (plan.refusal !== null) throw new Refusal(plan.refusal);

      const { packageId } = await ports.context.assemble({
        workspaceId: ws,
        projectId,
        objective,
        actorId: actor.userId,
        actorRole: actor.role,
        policy: contract.contextPolicy,
      });
      await ports.context.bind?.(ws, packageId, executionId);

      if (choice.usedFallback) {
        await ports.executions.record(ws, executionId, 'fallback-used', {
          model: choice.model,
          reason: choice.fallbackReason,
        });
      }
      for (const n of plan.narrowed) {
        await ports.executions.record(ws, executionId, 'limit-narrowed', { ...n, reason: "the contract's limit applies (FR-EXP-044)" });
      }
      for (const kind of plan.unenforceable) {
        await ports.executions.record(ws, executionId, 'limit-unenforceable', {
          limit: kind,
          reason: 'this provider exposes no control for it, so it is recorded and not enforced (FR-EXP-042)',
        });
      }

      // 4 — the run.
      const unattended = req.unattended === true;
      await this.store.addSession({
        executionId,
        workspaceId: ws,
        expertId: expert.id,
        contractVersionId: effective.id,
        delegatedFromExecutionId: parentId,
        depth,
        model: choice.model,
        usedFallback: choice.usedFallback,
        fallbackReason: choice.fallbackReason,
        effectiveAuthority: authority,
        toolObservation: 'unobserved',
        unattended,
        reviewRequired: unattended,
        outcome: null,
        startedAt: this.#clock(),
        endedAt: null,
      });
      started = true;
      for (const limit of plan.limits) await this.store.putLimit({ ...limit, executionId });

      const stoppedResult = async (): Promise<DispatchResult> => {
        // `FR-EXP-037` — whatever this run left running stops with it.
        await this.#stopDelegates(ws, executionId);
        const now = await this.store.findSession(ws, executionId);
        return {
          executionId,
          contractVersion: effective.version,
          model: choice.model,
          usedFallback: choice.usedFallback,
          toolObservation: now?.toolObservation ?? 'unobserved',
          contextPackageId: packageId,
          outcome: 'stopped-by-parent',
          reviewRequired: unattended,
        };
      };

      // `T2003`, `FR-EXP-037` — admitted while the parent ran, but the parent may
      // have ended (and run its cascade) before this row existed. Re-check now
      // that the cascade can see it.
      if (parentId !== null) {
        const parent = await this.store.findSession(ws, parentId);
        if (parent === null || parent.outcome !== null) {
          await this.#stopOne(ws, executionId, parentId);
          return stoppedResult();
        }
      }

      // `FR-EXP-041` — time is enforced here, whatever the provider does with its timeout.
      const timeMs = plan.limits.find((l) => l.limit === 'time')!.value;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeMs);
      this.#running.set(executionId, controller);
      let report: RunReport;
      try {
        report = await choice.runner.run(
          { capability: req.capabilities[0] as AgentCapability, command: `${req.command}: ${objective}` },
          { correlationId: executionId, timeoutMs: timeMs, signal: controller.signal },
        );
      } finally {
        clearTimeout(timer);
        this.#running.delete(executionId);
      }

      // Stopped by its own parent while it ran: already recorded and closed.
      if ((await this.store.findSession(ws, executionId))?.outcome === 'stopped-by-parent') return stoppedResult();

      if (timedOut) {
        const time = (await this.store.limitsFor(ws, executionId)).find((l) => l.limit === 'time')!;
        await this.store.putLimit({ ...time, reached: 'stopped' });
        await ports.executions.record(ws, executionId, 'limit-reached', { limit: 'time', value: timeMs });
      }
      // `T2003` — this run is marked ended first, and only then are its delegates
      // stopped, so none is admitted in between.
      const { outcome, won } = await this.#settle(ws, executionId, contract, authority, report, timedOut);
      if (!won) {
        // The parent's cascade got there first: it recorded and closed this run.
        if ((await this.store.findSession(ws, executionId))?.outcome === 'stopped-by-parent') return stoppedResult();
      }
      await this.#stopDelegates(ws, executionId);

      // `FR-EXP-036`, `FR-EXP-046` — charged here and up the chain; a crossing is only ever late.
      for (const breach of await chargeConsumption(this.store, ws, executionId, reported(report), this.#clock())) {
        await ports.executions.record(ws, breach.executionId, 'limit-breach-detected-late', {
          ...breach,
          detectedAt: this.#clock(),
          reason: 'reported after the run; recorded as detected late, never as prevented (FR-EXP-046)',
        });
      }

      // 5 — close: complete, or propose for review.
      const worked = outcome === 'succeeded' || outcome === 'incomplete';
      if (unattended && worked) {
        await ports.executions.record(ws, executionId, 'review-required', {
          reason: 'unattended Expert work enters verification and review (FR-EXP-063, BR-0061)',
        });
        await ports.executions.proposeCompletion(ws, executionId, `Expert '${expert.key}' finished unattended: ${outcome}`);
      } else {
        await ports.executions.complete(ws, executionId, COMPLETION[outcome], `Expert '${expert.key}' run ${outcome}`);
      }
      closed = true;

      return {
        executionId,
        contractVersion: effective.version,
        model: choice.model,
        usedFallback: choice.usedFallback,
        toolObservation: report.toolCalls === undefined ? 'unobserved' : 'observed',
        contextPackageId: packageId,
        outcome,
        reviewRequired: unattended,
      };
    } catch (error) {
      if (started) throw await this.#failed(ws, executionId, error, closed);
      throw await this.#refused(ws, executionId, error);
    }
  }

  /**
   * `T2001`, `FR-EXP-061`, `FR-EXP-037` — a failure after the session started:
   * the session ends `failed` (unless it already ended), a run failure is
   * recorded, and the execution is closed as failed unless it was already
   * closed. Never `dispatch-refused`: this dispatch was admitted. The error is
   * rethrown with the execution id added.
   */
  async #failed(ws: string, executionId: string, error: unknown, closed: boolean): Promise<Error> {
    const reason = error instanceof Error ? error.message : 'the run failed';
    const executions = this.deps.ports.executions;
    // Each step on its own, so one failing write does not leave the others undone.
    const won = await this.store.endSession(ws, executionId, { outcome: 'failed', endedAt: this.#clock() }).catch(() => false);
    if (!won) {
      // Stopped by its parent: the cascade already recorded and closed it.
      const now = await this.store.findSession(ws, executionId).catch(() => null);
      if (now?.outcome === 'stopped-by-parent') closed = true;
    }
    await executions.record(ws, executionId, 'run-failed', { reason }).catch(() => undefined);
    if (!closed) {
      await executions.complete(ws, executionId, 'failed', `Expert run failed: ${reason}`).catch(() => undefined);
    }
    await this.#stopDelegates(ws, executionId).catch(() => undefined);
    return withExecutionId(error, executionId);
  }

  /** `FR-EXP-037` — every running delegate of `executionId`, transitively. */
  async #stopDelegates(ws: string, executionId: string): Promise<void> {
    for (const child of await this.store.childrenOf(ws, executionId)) {
      if (child.outcome !== null) continue;
      await this.#stopOne(ws, child.executionId, executionId);
      await this.#stopDelegates(ws, child.executionId);
    }
  }

  /**
   * `T2003` — end one delegate as `stopped-by-parent`. Only the call whose
   * `endSession` won records and closes it: a child that settled first keeps
   * its own outcome, and a stopped child is closed once.
   */
  async #stopOne(ws: string, executionId: string, parentExecutionId: string): Promise<boolean> {
    const won = await this.store.endSession(ws, executionId, { outcome: 'stopped-by-parent', endedAt: this.#clock() });
    if (!won) return false;
    const executions = this.deps.ports.executions;
    await executions.record(ws, executionId, 'stopped-by-parent', {
      parentExecutionId,
      reason: 'the session that delegated this run ended, and a delegate does not outlive it (FR-EXP-037)',
    });
    await executions.complete(ws, executionId, 'cancelled', `stopped: parent ${parentExecutionId} ended`);
    this.#running.get(executionId)?.abort();
    return true;
  }

  /** What the run reported, recorded: tool observation, outputs, outcome. */
  async #settle(
    ws: string,
    executionId: string,
    contract: ExpertContract,
    authority: ReturnType<typeof authorityOf>,
    report: RunReport,
    timedOut: boolean,
  ): Promise<{ outcome: SessionOutcome; won: boolean }> {
    const record = this.deps.ports.executions.record.bind(this.deps.ports.executions);
    let breach = false;
    if (report.toolCalls === undefined) {
      await record(ws, executionId, 'tool-use-unobserved', {
        reason: 'the provider does not report its tool calls, so tool use is recorded as unobserved — never as enforced (FR-EXP-024)',
      });
    } else {
      const outside = [...new Set(report.toolCalls)].filter(
        (t) => !authority.tools.includes(t) || authority.prohibitedActions.includes(t),
      );
      if (outside.length > 0) {
        breach = true;
        await record(ws, executionId, 'tool-call-breach', {
          tools: outside,
          reason: 'the provider reported tool calls outside the contract (FR-EXP-024)',
        });
      }
    }

    let outcome: SessionOutcome;
    if (timedOut) {
      outcome = 'stopped-by-limit';
    } else if (report.status !== 'succeeded') {
      outcome = report.status === 'timed_out' ? 'stopped-by-limit' : 'failed';
    } else if (breach) {
      outcome = 'failed';
    } else {
      const missing = contract.expectedOutputs
        .filter((o) => o.required && !report.outputs.includes(o.kind))
        .map((o) => o.kind);
      if (missing.length > 0) {
        await record(ws, executionId, 'outputs-incomplete', { missing });
        outcome = 'incomplete';
      } else {
        outcome = 'succeeded';
      }
    }

    const won = await this.store.endSession(ws, executionId, {
      outcome,
      endedAt: this.#clock(),
      toolObservation: report.toolCalls === undefined ? 'unobserved' : 'observed',
    });
    return { outcome, won };
  }

  /**
   * A failure after registration: recorded as `dispatch-refused` on the
   * execution, which is closed as cancelled, and rethrown as its own class with
   * the execution id added — a `400` stays a `400`, a `503` stays a `503`.
   */
  async #refused(ws: string, executionId: string, error: unknown): Promise<Error> {
    const reason = error instanceof Error ? error.message : 'dispatch failed';
    const executions = this.deps.ports.executions;
    try {
      await executions.record(ws, executionId, 'dispatch-refused', { reason });
      await executions.complete(ws, executionId, 'cancelled', `dispatch refused: ${reason}`);
      // `FR-EXP-032` — a refused delegation is recorded on the session that asked.
      if (error instanceof DelegationRefusal && error.parentExecutionId !== null) {
        await executions.record(ws, error.parentExecutionId, 'delegation-refused', { reason, attempt: executionId });
      }
    } catch {
      // The refusal stands whether or not its record could be written.
    }
    if (error instanceof Refusal || error instanceof DelegationRefusal) {
      return new ValidationFailedError(`dispatch refused: ${reason}`, { executionId, reason });
    }
    return withExecutionId(error, executionId);
  }
}

/** The same class of error — a `400` stays a `400`, a `503` a `503` — with the execution id in its details. */
function withExecutionId(error: unknown, executionId: string): Error {
  if (error instanceof PlatformError) {
    const Same = error.constructor as new (message: string, details?: unknown) => PlatformError;
    const base = typeof error.details === 'object' && error.details !== null ? error.details : {};
    return new Same(error.message, { ...base, executionId });
  }
  const plain = error instanceof Error ? error : new Error(String(error));
  return Object.assign(plain, { details: { executionId } });
}

const COMPLETION: Record<SessionOutcome, 'completed' | 'partially-completed' | 'failed' | 'cancelled' | 'timed-out'> = {
  succeeded: 'completed',
  incomplete: 'partially-completed',
  failed: 'failed',
  'stopped-by-limit': 'timed-out',
  'stopped-by-parent': 'cancelled',
};
