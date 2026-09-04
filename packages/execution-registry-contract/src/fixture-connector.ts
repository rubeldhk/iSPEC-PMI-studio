/**
 * T1028 (EPIC-037 Band A) — the fixture connector.
 *
 * The **conformance oracle**: the smallest thing that speaks the semantic
 * contract correctly. Every other surface — managed sandbox, MCP client, IDE
 * extension, local CLI, CI — is judged against what this does, which is what
 * makes "semantic equivalence across surfaces" a test rather than a hope.
 *
 * ## It is deliberately not clever
 *
 * It holds no policy, retries nothing, and interprets nothing. It sanitises its
 * arguments, mints an idempotency key per operation, and reports. If a real
 * connector needs to do more than this to be correct, the contract is wrong.
 *
 * ## What it cannot do, by construction
 *
 * There is no `applyTransition`, no `approve`, no `setStatus`. Not because the
 * fixture chose not to implement them — because {@link ExecutionRegistry} does
 * not have them. A connector's inability to apply lifecycle policy is a
 * property of the contract, not of its own restraint.
 *
 * It also cannot construct identity. The snapshot references it carries were
 * minted server-side and handed to it; it passes them through unchanged.
 */
import type {
  AppendedEvent,
  CompleteExecutionRequest,
  ExecutionIdentityRefs,
  ExecutionRegistry,
  ExecutionSnapshot,
  ExecutionSurface,
  GovernedCommand,
  InputBinding,
  OutputBinding,
} from './contract.js';

/** EPIC-041 T1370 (FR-LPW-030, FR-LPW-032): the environment a local surface binds. */
export interface FixtureEnvironment {
  readonly kind: 'managed-isolated' | 'controlled-local';
  readonly workspace:
    | { readonly kind: 'persistent'; readonly projectRef: string; readonly mode: 'read-only' | 'read-write'; readonly branch: string }
    | { readonly kind: 'ephemeral'; readonly scratchPath: string };
}

/** The wire form of an environment: kind, lifecycle, and what it binds. */
export function describeEnvironment(environment: FixtureEnvironment): string {
  const bound = environment.workspace.kind === 'persistent' ? environment.workspace.projectRef : environment.workspace.scratchPath;
  return `${environment.kind}:${environment.workspace.kind}:${bound}`;
}

export interface FixtureConnectorOptions {
  readonly workspaceId: string;
  /** Defaults to 'fixture'. A local surface ('mcp-client', 'local-cli') is what EPIC-041 admits (FR-LPW-032). */
  readonly surface?: ExecutionSurface;
  /** Sent as the request's environment string; absent when not given. */
  readonly environment?: FixtureEnvironment;
  readonly identity: ExecutionIdentityRefs;
  readonly correlationId: string;
  /** Injected so a test can make keys deterministic. */
  readonly keyFor?: (operation: string) => string;
}

/**
 * A run, as the fixture performs it: register, start, complete.
 *
 * Returned rather than logged, so a test asserts on what the connector actually
 * did rather than on what it says it did.
 */
export interface FixtureRunResult {
  readonly snapshot: ExecutionSnapshot;
  readonly started: AppendedEvent;
  readonly completed: AppendedEvent;
}

export class FixtureConnector {
  private counter = 0;

  constructor(
    private readonly registry: ExecutionRegistry,
    private readonly options: FixtureConnectorOptions,
  ) {}

  private key(operation: string): string {
    if (this.options.keyFor !== undefined) return this.options.keyFor(operation);
    this.counter += 1;
    return `${this.options.correlationId}:${operation}:${this.counter}`;
  }

  /** Register, binding the INPUT identity. Never `commitAfter`. */
  async register(input: {
    command: GovernedCommand;
    args: Readonly<Record<string, unknown>>;
    binding: InputBinding;
    executionId?: string;
    parentExecutionId?: string;
  }): Promise<ExecutionSnapshot> {
    return this.registry.register({
      ...(input.executionId !== undefined ? { executionId: input.executionId } : {}),
      workspaceId: this.options.workspaceId,
      command: input.command,
      argsSanitized: input.args,
      surface: this.options.surface ?? 'fixture',
      ...(this.options.environment !== undefined ? { environment: describeEnvironment(this.options.environment) } : {}),
      identity: this.options.identity,
      input: input.binding,
      correlationId: this.options.correlationId,
      idempotencyKey: this.key('register'),
      contractVersion: '1.0',
      ...(input.parentExecutionId !== undefined
        ? { parentExecutionId: input.parentExecutionId }
        : {}),
    });
  }

  async start(executionId: string): Promise<AppendedEvent> {
    return this.registry.appendEvent({
      executionId,
      workspaceId: this.options.workspaceId,
      type: 'started',
      payload: {},
      occurredAt: new Date().toISOString(),
      identity: this.options.identity,
      idempotencyKey: this.key('started'),
    });
  }

  /**
   * Complete, binding the OUTPUT identity and carrying the mandatory comment.
   *
   * `output` is optional here for the same reason it is optional in the
   * contract: a failed run produced nothing, and forcing one would make
   * connectors invent it.
   */
  async complete(input: {
    executionId: string;
    outcome: CompleteExecutionRequest['outcome'];
    comment: string;
    output?: OutputBinding;
  }): Promise<AppendedEvent> {
    return this.registry.complete({
      executionId: input.executionId,
      workspaceId: this.options.workspaceId,
      outcome: input.outcome,
      identity: this.options.identity,
      idempotencyKey: this.key(`complete:${input.outcome}`),
      occurredAt: new Date().toISOString(),
      completionComment: input.comment,
      ...(input.output !== undefined ? { output: input.output } : {}),
    });
  }

  /** Propose a transition. The verdict is EPIC-030's; this only asks. */
  async propose(input: {
    executionId: string;
    targetRef: string;
    targetVersion: number;
    expectedCurrentStatus: string;
    proposedState: string;
    rationale: string;
  }): Promise<AppendedEvent> {
    return this.registry.proposeTransition({
      executionId: input.executionId,
      workspaceId: this.options.workspaceId,
      targetRef: input.targetRef,
      targetVersion: input.targetVersion,
      expectedCurrentStatus: input.expectedCurrentStatus,
      proposedState: input.proposedState,
      rationale: input.rationale,
      identity: this.options.identity,
      correlationId: this.options.correlationId,
      idempotencyKey: this.key('propose'),
    });
  }

  /** The whole round trip, in the order the contract requires it. */
  async run(input: {
    command: GovernedCommand;
    args: Readonly<Record<string, unknown>>;
    binding: InputBinding;
    output: OutputBinding;
    comment: string;
  }): Promise<FixtureRunResult> {
    const snapshot = await this.register({
      command: input.command,
      args: input.args,
      binding: input.binding,
    });
    const started = await this.start(snapshot.executionId);
    const completed = await this.complete({
      executionId: snapshot.executionId,
      outcome: 'completed',
      comment: input.comment,
      output: input.output,
    });
    return { snapshot, started, completed };
  }
}
