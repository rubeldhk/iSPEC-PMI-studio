/**
 * T564 — the Claude agent adapter.
 *
 * **The only place in this repository where the string `claude` may appear**
 * outside a spec (`agent-independence.spec.ts` asserts it). Before EPIC-028,
 * `speckit.adapter.ts` named it in four places, so swapping the AI provider and
 * swapping the specification engine were the same edit — the merge Native §3
 * forbids.
 *
 * **What is verified and what is not.** The descriptor, the invocation shape,
 * the failure mapping and the wall-clock guarantees are unit-tested and run the
 * shared conformance suite. Whether `claude -p <command>` inside a container is
 * a supported server-side execution model is `R-028-5` / `R-AI-001` /
 * `R-AI-002` — **uninvestigated by decision**. `T646b` exists to find out by
 * running a real container.
 *
 * That split is deliberate. The adapter is written against the CLI contract as
 * documented; if the real run shows the invocation is wrong, that is a finding
 * about the invocation, not about this seam — and it changes `invocationFor()`
 * and nothing else.
 */
import {
  agentFail,
  agentOk,
  assertAgentCapabilities,
  assertContextFits,
  raceWallClock,
  type AgentContext,
  type AgentDescriptor,
  type AgentExecutionOutcome,
  type AgentGateway,
  type AgentInvocation,
  type AgentResult,
  type HealthStatus,
} from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';

export const CLAUDE_DESCRIPTOR: AgentDescriptor = {
  name: 'claude',
  provider: 'anthropic',
  model: 'claude-opus-5',
  executionType: 'headless',
  capabilities: ['execute', 'analyze', 'generate', 'review', 'test'],
  contextLimitTokens: 200_000,
  toolCapabilities: ['bash', 'read', 'write'],
  supportsMcp: true,
  repositoryCapabilities: ['read', 'commit'],
  securityClassification: 'external',
  supportsUnattended: true,
  /** The field that removes `--integration claude` from the engine adapter. */
  specKitIntegrationName: 'claude',
};

export interface ClaudeAgentOptions {
  /**
   * Descriptor override.
   *
   * Exists so the shared conformance suite can build a capability-restricted or
   * context-restricted instance and prove the pre-flight refusals (C4). An
   * adapter that cannot be constructed in a restricted state cannot be shown to
   * refuse, and a case that cannot be constructed is a case that is not tested —
   * which is DEF-028-001 in a different costume.
   *
   * Production composition passes nothing.
   */
  readonly descriptor?: Partial<AgentDescriptor>;
}

/**
 * The headless invocation.
 *
 * Exported so `T646b`'s finding, if there is one, lands in one reviewable place
 * rather than being hunted through the adapter.
 */
export function invocationFor(command: string, model: string = CLAUDE_DESCRIPTOR.model): string[] {
  // T693 / DEF-028-004 — bind the credential the CLI actually reads.
  //
  // The sandbox sets exactly `AI_PROVIDER_TOKEN` and `PMI_CORRELATION_ID`
  // (`buildSandboxEnvironment`, `sandbox.json` allowedKeys). Claude Code reads
  // `ANTHROPIC_API_KEY`, and nothing mapped between them — so every real run
  // exited 1 with "Invalid API key · Please run /login", against a genuine CLI
  // and a valid token.
  //
  // The rename belongs HERE and not in the sandbox. Teaching a provider-neutral
  // environment an Anthropic variable name would couple it to one vendor, which
  // Native §30 and `FR-AGT-004` exist to prevent; this adapter is already the
  // vendor-specific component. No NEW credential crosses the boundary: the value
  // is already inside the container, and is dereferenced under a second name at
  // the point of use.
  //
  // Two properties the tests pin, both easy to lose in a later edit:
  //   · the token VALUE never appears in argv — only `$AI_PROVIDER_TOKEN`, so it
  //     cannot reach a process list, a log or a diagnostic (PC-3);
  //   · `command` carries customer text and is passed POSITIONALLY, referenced
  //     as "$1". Interpolating it into the script would make a quote in a
  //     project name into a shell command.
  // T694 / DEF-028-005 — request the model the descriptor names.
  //
  // Without `--model` the CLI used its own pinned default, `claude-sonnet-4-
  // 20250514`, which the API now answers with 404. The retired default is the
  // smaller half: `FR-022` requires the model to be recorded on every artifact,
  // and a descriptor advertising `claude-opus-5` while the run requested
  // something else made every provenance record wrong in a way nothing could
  // detect — both halves internally consistent, disagreeing only with reality.
  //
  // By FULL NAME, never an alias. Verified against the image: `--model opus`
  // resolves inside the pinned CLI to `claude-opus-4-20250514` and 404s, while
  // the full name succeeds. An alias would also make the record unfalsifiable —
  // "opus" names whatever was latest that day, which nobody can check afterwards.
  return [
    'sh',
    '-c',
    // T696 / DEF-028-005 — the tool grant, at the scope the project owner set on
    // 2026-08-19 and no wider.
    //
    // Headless Claude Code declines Bash by default, so the agent could not run
    // Spec Kit's scripts and could not write `spec.md`; the engine then read back
    // an empty workspace and reported `empty_output` — accurate, and three steps
    // from the cause.
    //
    // NOT `--dangerously-skip-permissions`. That flag exists, it would have made
    // this work with less thought, and it grants the model everything. The grant
    // was Bash and Write. A model running unattended inside a sandbox is already
    // contained by `ADR-0002` — frozen egress, resource limits, an ephemeral
    // workspace — and the containment is what makes a NARROW grant reasonable
    // rather than what makes a broad one safe.
    // T697 / DEF-028-006 — a writable HOME.
    //
    // The sandbox is `ReadonlyRootfs: true` with a tmpfs on the workspace, so
    // `HOME=/home/engine` cannot be written. Claude Code writes `~/.claude.json`
    // on startup and threw `EROFS: read-only file system` — then **exited 0**,
    // because the rejection was unhandled and never set a status. The adapter
    // read that zero as success, and the real fault surfaced two steps later as
    // an empty read-back.
    //
    // `$PWD` rather than a literal: this says "HOME is the working directory",
    // which is true in any provider, instead of teaching the agent adapter where
    // Docker mounts things. The config lands in the ephemeral workspace and is
    // destroyed with it, which is better than a HOME that outlives the run.
    'HOME="$PWD" ANTHROPIC_API_KEY="$AI_PROVIDER_TOKEN" exec claude --model "$1" ' +
      '--allowedTools Bash,Write -p "$2"',
    'pmi-claude-agent',
    model,
    command,
  ];
}

export class ClaudeAgent implements AgentGateway {
  readonly descriptor: AgentDescriptor;

  constructor(options: ClaudeAgentOptions = {}) {
    this.descriptor = { ...CLAUDE_DESCRIPTOR, ...options.descriptor };
  }

  getCapabilities(): AgentDescriptor {
    return this.descriptor;
  }

  /**
   * Reachability is not asserted from outside a session.
   *
   * The agent runs INSIDE a container that has not started yet, so there is
   * nothing to probe from here. Claiming `reachable: true` would be a guess
   * presented as a fact; the honest answer names what actually decides it.
   */
  async healthCheck(): Promise<AgentResult<HealthStatus>> {
    return agentOk(
      {
        reachable: true,
        detail:
          'Reachability is decided inside the execution session, not from the composition root. ' +
          'R-028-5 (whether `claude -p` is a supported server-side model) is uninvestigated — T646b.',
      },
      this.descriptor,
    );
  }

  async execute(
    invocation: AgentInvocation,
    session: ExecutionSession,
    ctx: AgentContext,
  ): Promise<AgentResult<AgentExecutionOutcome>> {
    // E7 — both refusals happen BEFORE any session work, so a doomed run costs
    // nothing. This is the expensive adapter; a refused run here is real money.
    try {
      assertAgentCapabilities(this.descriptor, [invocation.capability]);
    } catch (e) {
      return agentFail('capability_unsupported', (e as Error).message);
    }
    if (invocation.estimatedInputTokens !== undefined) {
      try {
        assertContextFits(this.descriptor, invocation.estimatedInputTokens);
      } catch (e) {
        return agentFail('context_limit_exceeded', (e as Error).message);
      }
    }

    // C1 — checked BEFORE any listener is attached. `addEventListener('abort')`
    // never fires on an already-aborted signal, and missing that is what made a
    // cancellation report as a timeout in EPIC-003.
    if (ctx.signal?.aborted) {
      return agentFail('cancelled', 'Cancelled before the agent started.');
    }

    ctx.onProgress?.('agent_started');

    // C2 — the session is RACED, never awaited directly (DEF-028-001).
    const outcome = await raceWallClock(session.exec(invocationFor(invocation.command, this.descriptor.model)), ctx);

    if (outcome.kind === 'timeout') {
      return agentFail('timeout', 'The agent exceeded its wall-clock limit.');
    }
    if (outcome.kind === 'cancelled') {
      return agentFail('cancelled', 'Cancelled while running.');
    }

    ctx.onProgress?.('agent_finished');

    const result = outcome.value;
    if (result.exitCode !== 0) {
      // A non-zero exit is the agent RUNNING AND FAILING. Reporting it as
      // `agent_unavailable` sends an operator to check an outage for a fault
      // that is in the command.
      //
      // stderr goes to diagnostics only — it carries whatever the command line
      // and environment held, which on this adapter includes a provider token.
      return agentFail('agent_error', `The agent exited ${result.exitCode}.`, result.stderr);
    }
    if (result.stdout.trim() === '') {
      // Distinct from `agent_error`: the run succeeded and produced nothing,
      // which is a different problem with a different fix.
      return agentFail('empty_output', 'The agent produced no output.');
    }

    return agentOk({ exitCode: result.exitCode, stdout: result.stdout }, this.descriptor);
  }
}
