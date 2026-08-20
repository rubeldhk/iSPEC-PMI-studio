/**
 * T091 — the five-step invocation (research R-001).
 *
 * Spec Kit is NOT a callable generation API. `specify` only scaffolds; the
 * `/speckit-*` commands are prompt templates executed by an AI coding agent.
 * So generation means orchestrating a container through five ordered steps:
 *
 *   1  git init
 *   2  specify init --here --force --integration claude --script sh --ignore-agent-tools
 *   3  write the requirement set into the workspace as command input
 *   4  run the AI agent headlessly with /speckit-specify
 *   5  read back specs/<feature>/spec.md, parse, destroy the workspace
 *
 * This is a sandboxed execution runtime, not an integration client.
 *
 * The container runtime is an injected port (PC-1) so all five steps, their
 * ordering, and every failure path are unit-testable without Docker — which
 * matters because building a container in CI is RAID R-04.
 */
import {
  engineFail,
  engineOk,
  type EngineContext,
  type EngineDescriptor,
  type EngineFailureReason,
  type EngineResult,
  type GeneratedSpecification,
  type GeneratedTask,
  type GenerateSpecificationInput,
  type GenerateTasksInput,
  type RequirementInput,
  type SpecificationEngine,
  type ValidateSpecificationInput,
  type ValidationFinding,
} from '@pmi/engine-contract';
import type {
  AgentCapability,
  AgentExecutionRecord,
  AgentGateway,
} from '@pmi/agent-contract';
import {
  GENERATION_EGRESS_PROFILE,
  type ExecResult,
  type ExecutionSession,
  type ProjectExecutionEnvironment,
} from '@pmi/execution-contract';
import { buildSandboxEnvironment } from './correlation.js';
import { findSpecificationPath, parseSpecification } from './parse.js';
import { withEphemeralWorkspace, type WorkspaceFileSystem } from './workspace.js';

export const SPECKIT_INPUT_CEILING = 500;

/** From docker/sandbox.json, which sandbox-config.spec.ts has asserted since EPIC-003. */
export const DEFAULT_ENGINE_IMAGE = 'pmi-studio/speckit-engine';

/** ADR-0002's caps. Simultaneously a safety control and a cost control (RAID R-02). */
export const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  cpus: 1,
  memoryMb: 2048,
  pids: 256,
  wallClockMs: 600_000,
});

/** The five steps, in the order they must run. Exported so tests assert ordering by name. */
export const INVOCATION_STEPS = [
  'git_init',
  'specify_init',
  'write_input',
  'agent_run',
  'read_back',
] as const;

export type InvocationStep = (typeof INVOCATION_STEPS)[number];

/**
 * T575 — `ContainerRuntime` and `SandboxSession` were declared HERE, inside the
 * engine adapter, which is why nothing else in the programme could use them and
 * why implementing Docker against them would have made Docker the abstraction
 * rather than a provider (Native §4, conflict `C-20`, decision `D-21`).
 *
 * They are now `ProjectExecutionEnvironment` and `ExecutionSession` in
 * `@pmi/execution-contract`. The aliases below are retained ONLY as deprecated
 * names so the many existing tests keep compiling; nothing in `src/` uses them.
 *
 * `ExecutionSession` is deliberately identical in shape to the `SandboxSession`
 * it replaces — Native §28 preserves the contract, and a widened port that also
 * changed its session shape would have been two changes wearing one name.
 */
export type { ExecResult, ExecutionSession };

/** @deprecated Use `ExecutionSession` from `@pmi/execution-contract`. */
export type SandboxSession = ExecutionSession;
/** @deprecated Use `ProjectExecutionEnvironment` from `@pmi/execution-contract`. */
export type ContainerRuntime = ProjectExecutionEnvironment;

export interface SpecKitAdapterOptions {
  descriptor: EngineDescriptor;
  /**
   * The execution substrate, as a PORT.
   *
   * No component outside the worker composition root reaches a container
   * runtime directly — asserted by `agent-independence.spec.ts` (T581).
   */
  environment: ProjectExecutionEnvironment;
  /** Image the environment starts. Overridable per deployment. */
  image?: string;
  /**
   * T566 — WHO reasons, injected rather than named.
   *
   * Before this, the adapter hardcoded `claude` in four places, so swapping the
   * AI provider and swapping the specification engine were the same edit — the
   * merge Native §3 forbids. The engine still owns the five ordered steps and
   * the failure taxonomy; it no longer owns the answer to "which agent".
   */
  agent: AgentGateway;
  /** T567 — where each execution record is delivered. Never carries a prompt. */
  onAgentRun?: (record: AgentExecutionRecord) => void;
  fileSystem: WorkspaceFileSystem;
  /** The one credential the sandbox receives. */
  aiProviderToken: string;
  inputCeiling?: number;
  onTeardownFailure?: (path: string, error: unknown) => void;
}

/**
 * Where the image keeps the scaffolds it baked at build time (T699).
 *
 * One directory per Spec Kit integration, because `--integration claude` writes
 * Claude's command files and a run asking for another agent must not silently
 * receive them.
 */
const SCAFFOLD_ROOT = '/opt/pmi/scaffold';

/** Raised internally to carry a step failure to the single mapping point below. */
class StepFailure extends Error {
  constructor(
    readonly step: InvocationStep,
    readonly reason: EngineFailureReason,
    readonly detail: string,
    /**
     * T698 / DEF-028-013 — the agent's stderr, when it had any.
     *
     * Dropped before this: the engine reported `step=agent_run` and nothing
     * else, so three separate causes in one day each had to be reproduced by
     * hand against the image because the one field that knew the answer was
     * being discarded at the mapping point below.
     */
    readonly diagnostics?: string,
  ) {
    super(`${step}: ${detail}`);
    this.name = 'StepFailure';
  }
}

export class SpecKitEngine implements SpecificationEngine {
  readonly descriptor: EngineDescriptor;
  private readonly ceiling: number;
  /** Distinguishes the several agent runs inside one correlation (DEF-028-002). */
  private agentRunSequence = 0;

  constructor(private readonly options: SpecKitAdapterOptions) {
    this.descriptor = options.descriptor;
    this.ceiling = options.inputCeiling ?? SPECKIT_INPUT_CEILING;
  }

  async generateSpecification(
    input: GenerateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedSpecification>> {
    // E7 — both refusals happen BEFORE a container starts, so a doomed run is
    // never billed.
    if (input.requirements.length === 0) {
      return engineFail('empty_selection', 'Select at least one requirement.');
    }
    if (input.requirements.length > this.ceiling) {
      return engineFail(
        'input_too_large',
        `Selection of ${input.requirements.length} exceeds the engine limit of ${this.ceiling}.`,
      );
    }

    return this.runInSandbox(ctx, async (session) => {
      await this.step('git_init', session, ['git', 'init']);
      await this.scaffold(session);

      ctx.onProgress?.('scaffolded');

      await this.write(session, 'pmi-input.md', renderRequirements(input));

      await this.runAgent(
        session,
        ctx,
        'generate',
        `/speckit-specify ${input.projectName}: see pmi-input.md`,
      );

      ctx.onProgress?.('generated');

      const raw = await this.readBack(session);
      const parsed = parseSpecification(raw);
      if (!parsed.ok) {
        throw new StepFailure('read_back', parsed.reason, parsed.detail);
      }
      return parsed.value;
    });
  }

  async generateTasks(
    input: GenerateTasksInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedTask[]>> {
    return this.runInSandbox(ctx, async (session) => {
      await this.step('git_init', session, ['git', 'init']);
      await this.scaffold(session);
      await this.write(session, 'pmi-spec.md', input.specificationContent);
      await this.runAgent(session, ctx, 'generate', '/speckit-tasks');

      const raw = await this.readBackFile(session, 'tasks.md');
      const tasks = raw
        .split(/\r?\n/)
        .map((line) => /^-\s*\[[ xX]\]\s*(.+)$/.exec(line.trim())?.[1])
        .filter((description): description is string => Boolean(description))
        .map((description) => ({ description }));

      if (tasks.length === 0) {
        throw new StepFailure('read_back', 'empty_output', 'The engine produced no tasks.');
      }
      return tasks;
    });
  }

  async validateSpecification(
    input: ValidateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<ValidationFinding[]>> {
    return this.runInSandbox(ctx, async (session) => {
      await this.step('git_init', session, ['git', 'init']);
      await this.write(session, 'pmi-spec.md', input.specificationContent);
      const result = await this.runAgent(session, ctx, 'analyze', '/speckit-analyze');

      const findings = parseFindings(result.stdout);
      // FR-023: a finding with no location is malformed output, not a finding.
      if (findings.some((finding) => finding.location.trim() === '')) {
        throw new StepFailure('read_back', 'malformed_output', 'A finding carried no location.');
      }
      return findings;
    });
  }

  // ------------------------------------------------------------------ agent

  /**
   * What Spec Kit's `--integration` flag should be given.
   *
   * The name lives on the AGENT because only the agent knows what Spec Kit
   * calls it. An agent that declares none cannot scaffold a Spec Kit project,
   * and saying so is better than silently passing `undefined`.
   */
  private integrationName(): string {
    const name = this.options.agent.descriptor.specKitIntegrationName;
    if (!name) {
      throw new StepFailure(
        'specify_init',
        'engine_error',
        `Agent "${this.options.agent.descriptor.name}" declares no specKitIntegrationName, so Spec Kit cannot be scaffolded for it.`,
      );
    }
    return name;
  }

  /**
   * T699 / `DEF-028-013` — copy the scaffold the image already carries.
   *
   * This used to run `specify init`, which fetches its templates over the
   * network. At run time the generation egress profile permits
   * `api.anthropic.com` and nothing else (`ADR-0002`), so the fetch could not
   * succeed and the agent was asked to run `/speckit-specify` against a
   * workspace with no `.specify/` in it.
   *
   * The scaffold is now baked into the image at build time, when a network is
   * legitimately available, and copied in here. Generation needs no network
   * beyond the AI provider — which is the promise the profile makes, kept rather
   * than widened.
   *
   * Keyed by integration name, so an agent still cannot scaffold without
   * declaring one, and a second agent gets its own baked scaffold rather than
   * silently receiving Claude's.
   *
   * The path is passed POSITIONALLY and read as `"$1"`, for the same reason the
   * agent command is: it is interpolated into no shell text. A missing scaffold
   * fails loudly, because a silent skip would hand the agent an empty workspace
   * and produce exactly the empty read-back this replaced.
   */
  private async scaffold(session: ExecutionSession): Promise<void> {
    const path = `${SCAFFOLD_ROOT}/${this.integrationName()}`;
    await this.step('specify_init', session, [
      'sh',
      '-c',
      'test -d "$1" || { echo "no baked scaffold at $1" >&2; exit 66; }; cp -a "$1"/. .',
      'pmi-scaffold',
      path,
    ]);
  }

  /**
   * Delegate the reasoning, and record it (T567, Native §7).
   *
   * The agent's failure taxonomy is mapped onto the ENGINE's, because the
   * engine's contract is what the caller holds. Cancellation and timeout are
   * carried across unchanged — collapsing them is the defect `T045a` was
   * written to prevent and the EPIC-003 suite caught recurring.
   */
  private async runAgent(
    session: ExecutionSession,
    ctx: EngineContext,
    capability: AgentCapability,
    command: string,
  ): Promise<ExecResult> {
    const agent = this.options.agent;
    const startedAt = new Date().toISOString();

    const result = await agent.execute(
      { capability, command },
      session,
      ctx.onProgress
        ? { correlationId: ctx.correlationId, signal: ctx.signal, timeoutMs: ctx.timeoutMs, onProgress: ctx.onProgress }
        : { correlationId: ctx.correlationId, signal: ctx.signal, timeoutMs: ctx.timeoutMs },
    );

    const base = {
      provider: agent.descriptor.provider,
      model: agent.descriptor.model,
      // DEF-028-002 — built from the CAPABILITY and a sequence, never the
      // command. This was `${correlationId}:${command}`, and `command` is the
      // prompt: `/speckit-specify Apollo: see pmi-input.md` put the customer's
      // project name verbatim into a field designed to be logged, on both the
      // success and failure paths.
      //
      // The field is called `executionId` and reads as opaque at every call
      // site, which is exactly why nobody saw it. `capability` is a closed enum
      // and the sequence is a counter, so this identifier cannot hold content
      // by construction rather than by care.
      executionId: `${ctx.correlationId}:${capability}:${++this.agentRunSequence}`,
      correlationId: ctx.correlationId,
      startedAt,
      endedAt: new Date().toISOString(),
      ...(agent.descriptor.agentVersion ? { agentVersion: agent.descriptor.agentVersion } : {}),
    };

    if (result.ok) {
      // Note what is absent: stdout. An execution record is provenance, never
      // model output (PC-3, FR-AGT-012).
      this.options.onAgentRun?.({ ...base, status: 'succeeded' });
      return { exitCode: result.value.exitCode, stdout: result.value.stdout, stderr: '' };
    }

    const reason = result.failure.reason;
    this.options.onAgentRun?.({
      ...base,
      status: reason === 'cancelled' ? 'cancelled' : reason === 'timeout' ? 'timed_out' : 'failed',
      failureReason: reason,
    });

    const engineReason =
      reason === 'cancelled' || reason === 'timeout' || reason === 'malformed_output' || reason === 'empty_output'
        ? reason
        : reason === 'agent_unavailable'
          ? 'engine_unavailable'
          : 'engine_error';

    throw new StepFailure('agent_run', engineReason, result.failure.message, result.failure.diagnostics);
  }

  // ------------------------------------------------------------------ plumbing

  /**
   * One sandbox lifetime, one mapping point for every terminal outcome.
   *
   * Cancellation and timeout are decided HERE rather than inside a step,
   * because a step failing while the signal is already aborted is a
   * consequence of the abort, not an engine defect — reporting it as
   * `engine_error` would bury a cancellation in the failure statistics.
   */
  private async runInSandbox<T>(
    ctx: EngineContext,
    work: (session: ExecutionSession) => Promise<T>,
  ): Promise<EngineResult<T>> {
    if (ctx.signal.aborted) return engineFail('cancelled', 'Generation was cancelled.');

    let timedOutByLimit = false;
    const limit = setTimeout(() => {
      timedOutByLimit = true;
    }, ctx.timeoutMs);

    try {
      return await withEphemeralWorkspace(
        this.options.fileSystem,
        async (workspace) => {
          // Built OUTSIDE the try below on purpose. A missing correlation id or
          // credential is a wiring defect, and reporting it as
          // `engine_unavailable` would disguise a programming error as an
          // outage — sending someone to check the runtime while the real fault
          // is in the caller. The conformance suite caught exactly this.
          const env = buildSandboxEnvironment({
            correlationId: ctx.correlationId,
            aiProviderToken: this.options.aiProviderToken,
          });

          let session: ExecutionSession;
          try {
            // T575 — an `ExecutionRequest`, not four loose options. The workspace
            // binding is `ephemeral` by construction: there is no binding that is
            // persistent and unnamed, so sandbox state cannot implicitly become
            // authoritative project state (Native §5, decisions D-22/D-29).
            session = await this.options.environment.start({
              lifecycle: 'ephemeral',
              image: this.options.image ?? DEFAULT_ENGINE_IMAGE,
              env,
              workspace: { kind: 'ephemeral', scratchPath: workspace.path },
              // The FROZEN profile. Widening it is `SC-AGT-005`'s whole subject.
              egressProfile: GENERATION_EGRESS_PROFILE,
              credentials: [],
              resourceLimits: DEFAULT_RESOURCE_LIMITS,
              timeoutMs: ctx.timeoutMs,
              signal: ctx.signal,
            });
          } catch (error) {
            // Could not start is not the same as ran and failed: one is
            // retryable, the other is a defect.
            return engineFail<T>('engine_unavailable', 'The engine could not be started.', redact(error));
          }

          try {
            // E5 — self-terminate rather than relying on the caller. Awaiting
            // `work` alone would block for the FULL duration of a hung step:
            // the wall-clock flag would be set and nothing would act on it, so
            // a wedged agent would hold the job open past its own limit. The
            // conformance suite caught this by hanging for the whole timeout.
            const outcome = await Promise.race([
              work(session).then(
                (value) => ({ kind: 'value' as const, value }),
                (error: unknown) => ({ kind: 'error' as const, error }),
              ),
              abandonOn(ctx),
            ]);

            if (outcome.kind === 'value') return engineOk(outcome.value, this.descriptor);
            if (outcome.kind === 'error') return this.attribute<T>(outcome.error, ctx, timedOutByLimit);
            return outcome.kind === 'timeout'
              ? engineFail<T>('timeout', `The run exceeded its ${ctx.timeoutMs}ms limit.`)
              : engineFail<T>('cancelled', 'Generation was cancelled.');
          } catch (error) {
            /* c8 ignore next — the race above converts rejections into outcomes; this is a backstop. */
            return this.attribute<T>(error, ctx, timedOutByLimit);
          } finally {
            // E8 — the container goes whatever happened.
            await this.options.environment.stop(session).catch(() => undefined);
          }
        },
        this.options.onTeardownFailure
          ? { onTeardownFailure: this.options.onTeardownFailure }
          : {},
      );
    } finally {
      clearTimeout(limit);
    }
  }

  /**
   * Decide what a thrown error actually was.
   *
   * The ordering matters and was learned the hard way in EPIC-001: a wall-clock
   * abort and a user cancellation both surface as an aborted signal, so a
   * timeout reported as `cancelled` makes a systemic problem look like ordinary
   * user behaviour in every metric. The explicit flag settles it.
   */
  private attribute<T>(error: unknown, ctx: EngineContext, timedOutByLimit: boolean): EngineResult<T> {
    if (timedOutByLimit) {
      return engineFail<T>('timeout', `The run exceeded its ${ctx.timeoutMs}ms limit.`);
    }
    if (ctx.signal.aborted) {
      return engineFail<T>('cancelled', 'Generation was cancelled.');
    }
    if (error instanceof StepFailure) {
      // Redacted: the agent's stderr carries whatever the command line and
      // environment held, which includes a provider token (PC-3).
      const why = [`step=${error.step}`, error.detail, error.diagnostics]
        .filter((part) => Boolean(part))
        .join('\n');
      return engineFail<T>(error.reason, FAILURE_MESSAGE[error.reason], redact(why));
    }
    return engineFail<T>('engine_error', FAILURE_MESSAGE.engine_error, redact(error));
  }

  private async step(
    step: InvocationStep,
    session: ExecutionSession,
    command: readonly string[],
  ): Promise<ExecResult> {
    const result = await session.exec(command);
    if (result.exitCode !== 0) {
      throw new StepFailure(step, 'engine_error', `exit code ${result.exitCode}`);
    }
    return result;
  }

  private async write(session: ExecutionSession, path: string, content: string): Promise<void> {
    try {
      await session.writeFile(path, content);
    } catch (error) {
      throw new StepFailure('write_input', 'engine_error', redact(error));
    }
  }

  private async readBack(session: SandboxSession): Promise<string> {
    const files = await session.listFiles();
    const path = findSpecificationPath(files);
    if (!path) {
      throw new StepFailure('read_back', 'empty_output', 'The engine wrote no specification.');
    }
    return session.readFile(path);
  }

  private async readBackFile(session: ExecutionSession, suffix: string): Promise<string> {
    const files = await session.listFiles();
    const path = files.find((file) => file.replace(/\\/g, '/').endsWith(suffix));
    if (!path) {
      throw new StepFailure('read_back', 'empty_output', `The engine wrote no ${suffix}.`);
    }
    return session.readFile(path);
  }
}

/**
 * Resolve when the run must be abandoned — whichever of cancellation or the
 * wall clock arrives first.
 *
 * The two are kept distinct all the way through. Collapsing them (both "abort")
 * is what made EPIC-001 report systemic timeouts as ordinary user
 * cancellations, hiding a real problem in a metric nobody questions.
 *
 * Timers are always cleared: a pending timeout would keep the process alive
 * after a fast successful run.
 */
function abandonOn(ctx: EngineContext): Promise<{ kind: 'timeout' | 'cancelled' }> {
  return new Promise((resolve) => {
    const finish = (kind: 'timeout' | 'cancelled') => {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', onAbort);
      resolve({ kind });
    };
    const onAbort = () => finish('cancelled');

    // Check BEFORE subscribing. `addEventListener('abort')` never fires on an
    // already-aborted signal, so a cancellation arriving between the caller's
    // entry check and this line would be missed entirely — and the run would
    // then block until its wall clock expired, reporting a timeout for what was
    // actually a cancellation.
    if (ctx.signal.aborted) {
      resolve({ kind: 'cancelled' });
      return;
    }

    const timer = setTimeout(() => finish('timeout'), ctx.timeoutMs);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    ctx.signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * One user-safe sentence per reason.
 *
 * Widened by T566: a step failure can now originate in the AGENT, so the map
 * must cover every reason the engine contract declares rather than only the
 * three a Spec Kit step could previously produce.
 */
const FAILURE_MESSAGE: Record<EngineFailureReason, string> = {
  engine_error: 'The engine ran and failed.',
  malformed_output: 'The engine produced output that could not be read.',
  empty_output: 'The engine produced no output.',
  engine_unavailable: 'The engine is unavailable.',
  timeout: 'The run exceeded its time limit.',
  cancelled: 'Generation was cancelled.',
  input_too_large: 'The selection is too large for the engine.',
  empty_selection: 'Select at least one requirement.',
};

/** Requirements rendered as the agent's input document. */
function renderRequirements(input: GenerateSpecificationInput): string {
  return [
    `# ${input.projectName}`,
    '',
    ...input.requirements.map(
      (requirement: RequirementInput) =>
        `- ${requirement.reference} (${requirement.type}/${requirement.priority}) ${requirement.description}`,
    ),
    '',
  ].join('\n');
}

/** `location | severity | message` per line; anything else is ignored. */
function parseFindings(stdout: string): ValidationFinding[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .filter((cells) => ['info', 'warning', 'error'].includes(cells[1] ?? ''))
    .map((cells) => ({
      location: cells[0] ?? '',
      severity: cells[1] as ValidationFinding['severity'],
      message: cells.slice(2).join(' | '),
    }));
}

/**
 * E9 — never let a credential reach diagnostics.
 *
 * Diagnostics is the field people add "just this once" for debugging, and the
 * field that then gets shipped to an aggregator. An error from a container
 * carries whatever the command line and environment held.
 */
export function redact(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\b(AI_PROVIDER_TOKEN|DATABASE_URL|SESSION_SECRET|JWT_SECRET)\s*=\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(password|token|secret|apikey|api_key)\s*[=:]\s*\S+/gi, '$1=[redacted]');
}
