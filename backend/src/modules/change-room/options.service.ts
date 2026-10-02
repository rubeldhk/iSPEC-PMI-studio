/**
 * `T996s` (EPIC-034) — options for a change. `FR-CHR-040`–`FR-CHR-042`,
 * `BR-0045`, `BR-0023`.
 *
 * ## Two requirements that pull against each other
 *
 * `FR-CHR-040` says **two or more**, for every Change Request. `EPIC-028`'s
 * gateway **degrades** when absent rather than refusing, which `EPIC-033`
 * established and this Room follows. Put together they invite the one bad
 * resolution available: manufacture a second option so the count is met.
 *
 * It would not be met. A synthesised alternative is a decision presenting
 * itself as a choice — `BR-0023`'s objection exactly — and it would be
 * indistinguishable, on screen, from a real one. So a degraded run returns
 * **`null` options and a stated reason**. `ChangeOptions` is a minimum-length
 * tuple, so there is nowhere to put a single option even on purpose, and the
 * decision that would have consumed these refuses for want of a choice rather
 * than proceeding on a manufactured one.
 *
 * ## None is pre-selected, and there is nowhere to put a selection
 *
 * No `selected`, `recommended`, `preferred` or `chosen` member exists here.
 * `EPIC-033`'s reasoning, unchanged: a boolean would eventually default to true
 * for whichever option the model liked, and the human decision would quietly
 * become a confirmation. The set is returned in the order it was given — a
 * "best first" ordering is a pre-selection nobody has to admit to.
 *
 * ## No materiality threshold
 *
 * `FR-CHR-040` as resolved 2026-08-23 (analysis finding `A1`): every Change
 * Request in this Room **is** a material change, because `FR-CHR-011` makes
 * this the only path by which an approved baseline changes. Nothing here reads
 * a materiality field, because there is none to read.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import {
  isAgentFailure,
  type AgentContext,
  type AgentExecutionRecord,
  type AgentGateway,
  type AgentInvocation,
} from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';
import {
  TRADEOFF_DIMENSIONS,
  type ChangeOption,
  type ChangeOptions,
  type TradeOff,
  type TradeOffDimension,
} from './option.types.js';

/**
 * The two things one invocation needs, bound at the composition root.
 *
 * Not a new seam — `AgentGateway` is `EPIC-028`'s and `ExecutionSession` is
 * `EPIC-024`'s. Optional, because absent ⇒ degrade.
 */
export interface ChangeOptionsBinding {
  readonly gateway: AgentGateway;
  readonly session: ExecutionSession;
}

export interface OptionsRequest {
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly correlationId: string;
  readonly timeoutMs?: number;
}

/** Why no options are being presented. Four causes, one shape for the caller. */
export type OptionsDegradedKind =
  | 'gateway-unbound'
  | 'invocation-failed'
  | 'output-unreadable'
  | 'too-few-options';

/** An option the provider produced that this Room refused to present. */
export interface RejectedOption {
  readonly index: number;
  readonly reason: string;
}

export interface OptionsResult {
  /** True only when two or more usable options came back. */
  readonly available: boolean;
  /**
   * Two or more, or `null`.
   *
   * Never one — the tuple forbids it. Never `[]` either: an empty array reads
   * as "we looked and there are no options", which nobody established.
   */
  readonly options: ChangeOptions | null;
  readonly degradedReason: string | null;
  readonly degradedKind: OptionsDegradedKind | null;
  /** `BR-0104` — attributable. Null when nothing ran. */
  readonly record: AgentExecutionRecord | null;
  /** Never silently dropped. A discarded option is a fact about the provider. */
  readonly rejected: readonly RejectedOption[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class OptionsService {
  constructor(private readonly binding?: ChangeOptionsBinding | undefined) {}

  async generate(request: OptionsRequest): Promise<OptionsResult> {
    if (!this.binding) {
      return degraded(
        'gateway-unbound',
        'no options provider is bound (EPIC-028 AgentGateway) — no options were produced, and ' +
          'none have been invented to stand in for them',
        null,
        [],
      );
    }
    return this.withAgent(this.binding, request);
  }

  private async withAgent(
    binding: ChangeOptionsBinding,
    request: OptionsRequest,
  ): Promise<OptionsResult> {
    const invocation: AgentInvocation = {
      capability: 'analyze',
      command: buildCommand(request),
    };
    const ctx: AgentContext = {
      correlationId: request.correlationId,
      timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    const startedAt = new Date().toISOString();
    const result = await binding.gateway.execute(invocation, binding.session, ctx);
    const endedAt = new Date().toISOString();

    if (isAgentFailure(result)) {
      return degraded(
        'invocation-failed',
        `the options provider did not answer: ${result.failure.message}`,
        recordOf(binding, request, startedAt, endedAt, 'failed', result.failure.reason),
        [],
      );
    }

    // The invocation SUCCEEDED — that is what the record says, and it stays
    // true even when the output turns out to be unreadable below. Marking it
    // failed there would blame the provider for this Room's parser.
    const record: AgentExecutionRecord = {
      provider: result.producedBy.provider,
      model: result.producedBy.model,
      ...(result.producedBy.agentVersion === undefined
        ? {}
        : { agentVersion: result.producedBy.agentVersion }),
      executionId: randomUUID(),
      correlationId: request.correlationId,
      startedAt,
      endedAt,
      status: 'succeeded',
    };

    if (result.value.exitCode !== 0) {
      return degraded(
        'invocation-failed',
        `the options provider exited ${result.value.exitCode}`,
        { ...record, status: 'failed' },
        [],
      );
    }

    const parsed = parseOptions(result.value.stdout);
    if (!parsed) {
      return degraded(
        'output-unreadable',
        'the options provider returned output this Room could not read — the invocation ' +
          'succeeded and nothing usable came back',
        record,
        [],
      );
    }

    if (parsed.accepted.length < 2) {
      // `FR-CHR-040`. The rejections travel with the degradation: without them
      // the reason the count fell short would be invisible.
      return degraded(
        'too-few-options',
        `FR-CHR-040 requires two or more options and ${parsed.accepted.length} survived ` +
          'validation — none has been invented to make up the number',
        record,
        parsed.rejected,
      );
    }

    return {
      available: true,
      // Checked above, and the cast is what the tuple costs. The check and the
      // cast are three lines apart so they cannot drift.
      options: parsed.accepted as unknown as ChangeOptions,
      degradedReason: null,
      degradedKind: null,
      record,
      rejected: parsed.rejected,
    };
  }
}

function degraded(
  degradedKind: OptionsDegradedKind,
  degradedReason: string,
  record: AgentExecutionRecord | null,
  rejected: readonly RejectedOption[],
): OptionsResult {
  return { available: false, options: null, degradedReason, degradedKind, record, rejected };
}

function recordOf(
  binding: ChangeOptionsBinding,
  request: OptionsRequest,
  startedAt: string,
  endedAt: string,
  status: AgentExecutionRecord['status'],
  failureReason?: AgentExecutionRecord['failureReason'],
): AgentExecutionRecord {
  const descriptor = binding.gateway.descriptor;
  return {
    provider: descriptor.provider,
    model: descriptor.model,
    ...(descriptor.agentVersion === undefined ? {} : { agentVersion: descriptor.agentVersion }),
    executionId: randomUUID(),
    correlationId: request.correlationId,
    startedAt,
    endedAt,
    status,
    ...(failureReason === undefined ? {} : { failureReason }),
  };
}

function buildCommand(request: OptionsRequest): string {
  return [
    'Propose two or more distinct ways to satisfy this change request.',
    `Change request: ${request.changeRequestId}.`,
    `State all six trade-off dimensions for each: ${TRADEOFF_DIMENSIONS.join(', ')}.`,
    'Where a dimension does not apply, say so and say why — do not omit it.',
    'Do not indicate a preference; the choice is not yours to make.',
  ].join(' ');
}

interface Parsed {
  readonly accepted: ChangeOption[];
  readonly rejected: RejectedOption[];
}

/**
 * Reads the provider's output, and refuses everything it cannot vouch for.
 *
 * `null` means the whole reply was unreadable. A reply that parses but contains
 * bad options is a different outcome: those options are **rejected by index**
 * and the survivors stand, because a provider getting one option wrong says
 * nothing about the others.
 */
function parseOptions(stdout: string): Parsed | null {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return null;
  }
  const raw = (payload as { options?: unknown })?.options;
  if (!Array.isArray(raw)) return null;

  const accepted: ChangeOption[] = [];
  const rejected: RejectedOption[] = [];

  raw.forEach((candidate, index) => {
    const problem = validate(candidate);
    if (problem) {
      rejected.push({ index, reason: problem });
      return;
    }
    const row = candidate as { optionId: string; summary: string; reasoning: string };
    accepted.push({
      optionId: row.optionId,
      summary: row.summary.trim(),
      reasoning: row.reasoning.trim(),
      tradeOffs: tradeOffsOf(candidate),
      // Computed here from one line, never read from the provider. A model that
      // labelled its own output `fact` would otherwise be believed.
      epistemic: 'recommendation',
    });
  });

  return { accepted, rejected };
}

/** The reason to refuse an option, or `null` to accept it. */
function validate(candidate: unknown): string | null {
  const row = candidate as Record<string, unknown>;
  if (!row || typeof row !== 'object') return 'not an object';
  for (const field of ['optionId', 'summary', 'reasoning'] as const) {
    if (typeof row[field] !== 'string' || (row[field] as string).trim() === '') {
      return `missing ${field}`;
    }
  }
  const tradeOffs = row['tradeOffs'] as Record<string, unknown> | undefined;
  if (!tradeOffs || typeof tradeOffs !== 'object') return 'missing tradeOffs';

  for (const dimension of TRADEOFF_DIMENSIONS) {
    const entry = tradeOffs[dimension] as { stated?: unknown; detail?: unknown } | undefined;
    if (!entry || typeof entry !== 'object') return `missing ${dimension}`;
    if (typeof entry.stated !== 'boolean') return `${dimension} does not say whether it applies`;
    // `stated: false` means *explicitly not applicable*, which is a position
    // somebody took — and a position needs words. A blank detail is how the
    // requirement gets satisfied on paper.
    if (typeof entry.detail !== 'string' || entry.detail.trim() === '') {
      return `${dimension} has no detail`;
    }
  }
  return null;
}

function tradeOffsOf(candidate: unknown): Readonly<Record<TradeOffDimension, TradeOff>> {
  const source = (candidate as { tradeOffs: Record<string, TradeOff> }).tradeOffs;
  const out = {} as Record<TradeOffDimension, TradeOff>;
  for (const dimension of TRADEOFF_DIMENSIONS) {
    const entry = source[dimension]!;
    out[dimension] = { stated: entry.stated, detail: entry.detail.trim() };
  }
  return out;
}
