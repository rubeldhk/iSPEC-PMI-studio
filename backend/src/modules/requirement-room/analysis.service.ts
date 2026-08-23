/**
 * T338n, T338p, T338t — AI analysis, epistemic labelling, and the findings that
 * need no model. `FR-RQR-011`, `FR-RQR-014`, `FR-RQR-015`, `R-033-2`,
 * `RULE-03`. Unit tests: `T338m`, `T338o`, `T338s`.
 *
 * **Two halves, and the split is the whole design.**
 *
 *   - **Deterministic** — duplicates within the candidate set, and candidates
 *     that restate or contradict something already frozen in a baseline. No
 *     model, always available, and a human can act on every one of them.
 *   - **AI** — gaps, assumptions and the readings a rule cannot produce, via
 *     `EPIC-028`'s gateway with the existing `analyze` capability.
 *
 * That split is what makes `degrade` the right absent-behaviour for this one
 * port. When the gateway is unbound or fails, the deterministic half still runs
 * and the AI half **says in the payload that it did not**. A Room that lost its
 * provider and rendered a clean, confident, blank analysis — no conflicts, no
 * questions, nothing wrong — is the failure this shape exists to prevent.
 *
 * **No new AI seam and no provider dependency** (`R-033-2`). `AGENT_CAPABILITIES`
 * already contains `analyze`; calling a model provider directly would put a
 * vendor in a Room's business logic, which is the coupling `EPIC-028` exists to
 * remove (`RULE-08`, `BR-0103`).
 *
 * **The Room does not create environments.** `AgentGateway.execute` takes an
 * already-started `ExecutionSession`, and the composition root supplies the
 * pair. A Room that started its own session would be an execution provider.
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
import { isEpistemic, labelled, type Labelled } from '@pmi/room-contract';
import type { CandidateRow, RequirementRoomStore } from './requirement-room.store.js';

/**
 * The two things one invocation needs, bound together at the composition root.
 *
 * Not a new seam: both types are `EPIC-028`'s and `EPIC-024`'s respectively, and
 * this pair only records that a gateway is useless without a session to run in.
 * Absent ⇒ **degrade** (`ROOM_PORTS`), which is why it is optional here and not
 * a required constructor argument like the Room's store.
 */
export interface AgentAnalysisBinding {
  readonly gateway: AgentGateway;
  readonly session: ExecutionSession;
}

export interface AnalyzeRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  readonly correlationId: string;
  /**
   * What is already frozen, resolved by the caller through `EPIC-007`.
   *
   * Passed in rather than read here: a baseline stores requirement **version
   * ids**, and turning those into text means holding the register, which
   * `FR-RQR-002` puts behind `register.adapter.ts`. The join belongs to the
   * caller for the same reason it does in `assertEditable`.
   */
  readonly baselined?: readonly BaselinedIntent[];
  readonly timeoutMs?: number;
}

export interface BaselinedIntent {
  readonly requirementVersionId: string;
  readonly text: string;
}

/** Why the AI half did not contribute. Four causes, one shape for the caller. */
export type DegradedReasonKind = 'gateway-unbound' | 'invocation-failed' | 'output-unreadable';

export const FINDING_KINDS = Object.freeze([
  'duplicate',
  'restates-baselined',
  'contradicts-baselined',
] as const);

export type FindingKind = (typeof FINDING_KINDS)[number];

/**
 * A finding names what collided and **never says which one wins.**
 *
 * `FR-RQR-015`: *"never resolve by recency"*. There is deliberately no
 * `winner`, no `resolution` and no ordering that could be read as one — a field
 * meaning "the newer one" is exactly how recency-resolution gets added later
 * without anybody deciding to add it.
 */
export interface Finding {
  readonly kind: FindingKind;
  /** Candidate ids and baselined version ids, sorted. Order carries no meaning. */
  readonly involves: readonly string[];
  readonly detail: string;
}

/** An element the model produced that this Room refused to present. */
export interface RejectedElement {
  readonly index: number;
  readonly reason: string;
}

export interface AnalysisResult {
  /** True only when the AI half produced usable output. */
  readonly aiAvailable: boolean;
  readonly degradedReason: string | null;
  readonly degradedKind: DegradedReasonKind | null;
  /** `BR-0104` — attributable. Null when nothing ran. */
  readonly record: AgentExecutionRecord | null;
  /** Every element carries exactly one label, by construction. */
  readonly elements: readonly Labelled<string>[];
  /** Never silently dropped — see `T338p`. */
  readonly rejected: readonly RejectedElement[];
  readonly findings: readonly Finding[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class AnalysisService {
  constructor(
    private readonly store: RequirementRoomStore,
    private readonly binding?: AgentAnalysisBinding | undefined,
  ) {}

  async analyze(request: AnalyzeRequest): Promise<AnalysisResult> {
    const candidates = await this.store.listCandidates(request.workspaceId, request.roomObjectId);
    const findings = detectFindings(candidates, request.baselined ?? []);

    if (!this.binding) {
      return degraded(
        findings,
        'gateway-unbound',
        'no analysis provider is bound (EPIC-028 AgentGateway) — the deterministic findings ' +
          'below are complete, and no AI reading was produced',
        null,
      );
    }
    return this.withAgent(this.binding, request, candidates, findings);
  }

  /** T338n — one invocation, and an `AgentExecutionRecord` whatever happens. */
  private async withAgent(
    binding: AgentAnalysisBinding,
    request: AnalyzeRequest,
    candidates: readonly CandidateRow[],
    findings: readonly Finding[],
  ): Promise<AnalysisResult> {
    const invocation: AgentInvocation = {
      capability: 'analyze',
      command: buildCommand(candidates),
    };
    const ctx: AgentContext = {
      correlationId: request.correlationId,
      timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    const startedAt = new Date().toISOString();
    const result = await binding.gateway.execute(invocation, binding.session, ctx);
    const endedAt = new Date().toISOString();

    if (isAgentFailure(result)) {
      const record = recordOf(binding, request, startedAt, endedAt, 'failed', result.failure.reason);
      return degraded(
        findings,
        'invocation-failed',
        `the analysis provider did not answer: ${result.failure.message}`,
        record,
      );
    }

    // The invocation SUCCEEDED — that is what the record says, and it is true
    // even when the output turns out to be unreadable below. Marking the record
    // failed there would blame the agent for this Room's parser.
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
        findings,
        'invocation-failed',
        `the analysis provider exited ${result.value.exitCode}`,
        { ...record, status: 'failed' },
      );
    }

    const parsed = parseElements(result.value.stdout);
    if (!parsed) {
      return degraded(
        findings,
        'output-unreadable',
        'the analysis provider returned output this Room could not read — the invocation ' +
          'succeeded and nothing usable came back',
        record,
      );
    }

    return {
      aiAvailable: true,
      degradedReason: null,
      degradedKind: null,
      record,
      elements: parsed.elements,
      rejected: parsed.rejected,
      findings,
    };
  }
}

function degraded(
  findings: readonly Finding[],
  degradedKind: DegradedReasonKind,
  degradedReason: string,
  record: AgentExecutionRecord | null,
): AnalysisResult {
  return {
    aiAvailable: false,
    degradedReason,
    degradedKind,
    record,
    elements: [],
    rejected: [],
    findings,
  };
}

function recordOf(
  binding: AgentAnalysisBinding,
  request: AnalyzeRequest,
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

/**
 * The prompt. Opaque to the gateway, and it never leaves this function into the
 * `AgentExecutionRecord` — Native §7's audit row carries no prompt (PC-3).
 */
function buildCommand(candidates: readonly CandidateRow[]): string {
  const lines = candidates.map((c, i) => `${i + 1}. ${c.normalizedText}`);
  return [
    'Analyse the following requirement candidates for gaps, assumptions and',
    'contradictions. Answer as JSON: {"elements":[{"epistemic":"fact|inference|',
    'recommendation|open-question","text":"..."}]}. Every element must carry',
    'exactly one epistemic label.',
    '',
    ...lines,
  ].join('\n');
}

/**
 * T338p — `FR-RQR-011`, `SC-RQR-002`. Untrusted model output becomes
 * `Labelled<string>` or it becomes nothing.
 *
 * **The type is the guarantee; this is the backstop.** `Labelled<T>` has a
 * required `epistemic` with no default and no optional variant, so no code path
 * *builds* an unlabelled element. This function is the one place values arrive
 * from outside the type system, and its job is to make sure they leave it
 * inside.
 *
 * **Rejected, never defaulted, and never silently dropped.** Defaulting an
 * unlabelled element to any kind invents an epistemic claim the model did not
 * make — `UX-0031`'s *"a governance failure expressed as a styling choice"*,
 * one layer lower. Dropping it quietly is the same harm with no evidence left.
 * So each refusal is returned with its index and its reason.
 */
export function parseElements(
  stdout: string,
): { elements: Labelled<string>[]; rejected: RejectedElement[] } | null {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return null;
  }
  const raw = (payload as { elements?: unknown })?.elements;
  if (!Array.isArray(raw)) return null;

  const elements: Labelled<string>[] = [];
  const rejected: RejectedElement[] = [];
  raw.forEach((entry, index) => {
    const item = entry as { epistemic?: unknown; text?: unknown } | null;
    const kind = item?.epistemic;
    const text = item?.text;
    if (typeof kind !== 'string' || !isEpistemic(kind)) {
      rejected.push({
        index,
        reason:
          typeof kind === 'string'
            ? `"${kind}" is not one of the four epistemic kinds`
            : 'no epistemic label',
      });
      return;
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      rejected.push({ index, reason: 'labelled, but carries no text' });
      return;
    }
    elements.push(labelled(kind, text.trim()));
  });
  return { elements, rejected };
}

// ------------------------------------------------------------------ findings

/** Case-folded, so "SHALL" and "shall" are the same subject for comparison. */
function key(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

const NEGATIONS = new Set(['not', 'never', 'cannot', 'no', "n't"]);

/**
 * The sentence with its negations removed, and how many there were.
 *
 * Deliberately narrow. Two sentences that are identical apart from a `not` are
 * the one contradiction worth detecting without a model, because it is **exact**
 * — no judgement, no threshold, no false positive that a reviewer has to
 * dismiss. Everything broader is the AI half's job, and saying so here is what
 * keeps somebody from adding a similarity score to this function later.
 */
function polarity(text: string): { stem: string; negated: boolean } {
  const words = key(text)
    .replace(/\bcan't\b/g, 'cannot')
    .split(/\b/)
    .map((w) => w.trim())
    .filter(Boolean);
  const kept = words.filter((w) => !NEGATIONS.has(w));
  const count = words.length - kept.length;
  return { stem: kept.join(' ').replace(/\s+/g, ' ').trim(), negated: count % 2 === 1 };
}

/**
 * T338t — `FR-RQR-014`, `FR-RQR-015`. What can be found without a model.
 *
 * Three kinds, each exact:
 *
 *   - **duplicate** — two candidates saying the same thing, so a reviewer does
 *     not approve one and then meet the other in the next set;
 *   - **restates-baselined** — new intent identical to something already
 *     frozen. Somebody is re-entering an approved requirement, which is a
 *     Change Request (`RULE-02`), not new intent;
 *   - **contradicts-baselined** — new intent that is the negation of something
 *     frozen. `FR-RQR-015` exactly: it surfaces **for decision**.
 *
 * **Nothing here resolves anything.** No newest-wins, no dedupe, no
 * auto-supersede. A `Finding` names what collided and stops.
 */
export function detectFindings(
  candidates: readonly CandidateRow[],
  baselined: readonly BaselinedIntent[],
): Finding[] {
  const findings: Finding[] = [];

  const byKey = new Map<string, CandidateRow[]>();
  for (const candidate of candidates) {
    const k = key(candidate.normalizedText);
    byKey.set(k, [...(byKey.get(k) ?? []), candidate]);
  }
  for (const [, group] of [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (group.length < 2) continue;
    findings.push({
      kind: 'duplicate',
      involves: group.map((c) => c.id).sort(),
      detail: `${group.length} candidates state the same requirement: "${group[0]!.normalizedText}"`,
    });
  }

  for (const candidate of candidates) {
    const candidatePolarity = polarity(candidate.normalizedText);
    for (const frozen of baselined) {
      const frozenPolarity = polarity(frozen.text);
      if (candidatePolarity.stem !== frozenPolarity.stem) continue;
      const contradicts = candidatePolarity.negated !== frozenPolarity.negated;
      findings.push({
        kind: contradicts ? 'contradicts-baselined' : 'restates-baselined',
        involves: [candidate.id, frozen.requirementVersionId].sort(),
        detail: contradicts
          ? `"${candidate.normalizedText}" is the negation of a baselined requirement — a ` +
            'conflict for decision (FR-RQR-015)'
          : `"${candidate.normalizedText}" restates a baselined requirement — changing it is a ` +
            'Change Request, not new intent (RULE-02)',
      });
    }
  }

  return findings;
}
