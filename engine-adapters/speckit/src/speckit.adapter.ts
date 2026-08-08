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
import { buildSandboxEnvironment } from './correlation.js';
import { findSpecificationPath, parseSpecification } from './parse.js';
import { withEphemeralWorkspace, type WorkspaceFileSystem } from './workspace.js';

export const SPECKIT_INPUT_CEILING = 500;

/** The five steps, in the order they must run. Exported so tests assert ordering by name. */
export const INVOCATION_STEPS = [
  'git_init',
  'specify_init',
  'write_input',
  'agent_run',
  'read_back',
] as const;

export type InvocationStep = (typeof INVOCATION_STEPS)[number];

export interface ExecResult {
  exitCode: number;
  stdout: string;
  /** Operator-facing only. Never returned to a user, never logged (R-011). */
  stderr: string;
}

export interface SandboxSession {
  exec(command: readonly string[]): Promise<ExecResult>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

export interface ContainerRuntime {
  /** Start a container. Throwing here means the engine could not be reached. */
  start(options: {
    env: Record<string, string>;
    workspacePath: string;
    timeoutMs: number;
    signal: AbortSignal;
  }): Promise<SandboxSession>;
  /** Destroy it. Must be idempotent and must not throw into a result. */
  stop(session: SandboxSession): Promise<void>;
}

export interface SpecKitAdapterOptions {
  descriptor: EngineDescriptor;
  runtime: ContainerRuntime;
  fileSystem: WorkspaceFileSystem;
  /** The one credential the sandbox receives. */
  aiProviderToken: string;
  inputCeiling?: number;
  onTeardownFailure?: (path: string, error: unknown) => void;
}

/** Raised internally to carry a step failure to the single mapping point below. */
class StepFailure extends Error {
  constructor(
    readonly step: InvocationStep,
    readonly reason: 'engine_error' | 'malformed_output' | 'empty_output',
    readonly detail: string,
  ) {
    super(`${step}: ${detail}`);
    this.name = 'StepFailure';
  }
}

export class SpecKitEngine implements SpecificationEngine {
  readonly descriptor: EngineDescriptor;
  private readonly ceiling: number;

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
      await this.step('specify_init', session, [
        'specify',
        'init',
        '--here',
        '--force',
        '--integration',
        'claude',
        '--script',
        'sh',
        '--ignore-agent-tools',
      ]);

      ctx.onProgress?.('scaffolded');

      await this.write(session, 'pmi-input.md', renderRequirements(input));

      await this.step('agent_run', session, [
        'claude',
        '-p',
        `/speckit-specify ${input.projectName}: see pmi-input.md`,
      ]);

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
      await this.step('specify_init', session, [
        'specify',
        'init',
        '--here',
        '--force',
        '--integration',
        'claude',
        '--script',
        'sh',
        '--ignore-agent-tools',
      ]);
      await this.write(session, 'pmi-spec.md', input.specificationContent);
      await this.step('agent_run', session, ['claude', '-p', '/speckit-tasks']);

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
      const result = await this.step('agent_run', session, ['claude', '-p', '/speckit-analyze']);

      const findings = parseFindings(result.stdout);
      // FR-023: a finding with no location is malformed output, not a finding.
      if (findings.some((finding) => finding.location.trim() === '')) {
        throw new StepFailure('read_back', 'malformed_output', 'A finding carried no location.');
      }
      return findings;
    });
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
    work: (session: SandboxSession) => Promise<T>,
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

          let session: SandboxSession;
          try {
            session = await this.options.runtime.start({
              env,
              workspacePath: workspace.path,
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
            await this.options.runtime.stop(session).catch(() => undefined);
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
      return engineFail<T>(error.reason, FAILURE_MESSAGE[error.reason], `step=${error.step}`);
    }
    return engineFail<T>('engine_error', FAILURE_MESSAGE.engine_error, redact(error));
  }

  private async step(
    step: InvocationStep,
    session: SandboxSession,
    command: readonly string[],
  ): Promise<ExecResult> {
    const result = await session.exec(command);
    if (result.exitCode !== 0) {
      throw new StepFailure(step, 'engine_error', `exit code ${result.exitCode}`);
    }
    return result;
  }

  private async write(session: SandboxSession, path: string, content: string): Promise<void> {
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

  private async readBackFile(session: SandboxSession, suffix: string): Promise<string> {
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

const FAILURE_MESSAGE = {
  engine_error: 'The engine ran and failed.',
  malformed_output: 'The engine produced output that could not be read.',
  empty_output: 'The engine produced no output.',
} as const;

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
