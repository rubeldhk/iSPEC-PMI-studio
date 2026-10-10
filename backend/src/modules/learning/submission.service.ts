/**
 * `T2327` (EPIC-048) — the only intake (`FR-LRN-001`…`008`, `010`…`014`, `017`,
 * `060`…`063`).
 *
 * An observation enters here and nowhere else, and it enters as an **untrusted
 * candidate**. Nothing in this file can write knowledge: it holds a
 * `LearningStore`, which has no knowledge insert (`R-048-4` fence 1).
 *
 * The order of checks is deliberate — the cheapest refusal that names the
 * caller's mistake comes first, and nothing is written until every check passes:
 *
 * 1. parse (every missing element at once, `FR-LRN-010`);
 * 2. replay (`FR-LRN-061`) — a retry gets the original answer even if, say, the
 *    bound has since been reached;
 * 3. policy and category (`FR-LRN-003`);
 * 4. source (`FR-LRN-005`, `-006`), grace period, bound (`FR-LRN-007`);
 * 5. scope (`FR-LRN-014`) and target;
 * 6. evidence resolution (`FR-LRN-012`) — `503` while `EvidenceReads` is unbound;
 * 7. record, then ask for a decision unless the execution is provisional
 *    (`FR-LRN-063`).
 *
 * Framework-free (PC-1).
 */
import { createHash } from 'node:crypto';
import {
  learningEventPayload,
  parseSubmission,
  scopeIncludesProject,
  type LearningSubmissionV1,
} from '@pmi/learning-contract';
import { ConflictError, ValidationFailedError } from '../../core/errors.js';
import type { LearningPolicy, LearningPolicyReader } from './learning-policy.js';
import { newLearningId, type CandidateRecord, type CitationRecord, type LearningStore } from './learning.store.js';
import type { ExpertFacts, LearningPorts } from './learning.tokens.js';
import { assertNoSecret } from './secret.screen.js';

export type SubmissionActor =
  | { readonly kind: 'person'; readonly workspaceId: string; readonly userId: string }
  | { readonly kind: 'agent'; readonly workspaceId: string; readonly principalId: string; readonly projectId: string };

export interface SubmitInput {
  readonly actor: SubmissionActor;
  /** The source project: the session body's, or the connector credential's. */
  readonly projectId: string;
  readonly body: unknown;
}

export interface Eligibility {
  readonly automatic: boolean;
  readonly failedConditions: readonly string[];
}

/** What asking for a decision did (`decision.requester.ts`, `T2349`). */
export interface DecisionRequestOutcome {
  readonly state: 'proposed' | 'pending-review' | 'approved';
  readonly decisionId?: string;
  readonly reason?: string;
  readonly eligibility: Eligibility;
}

export interface SubmissionBody {
  readonly candidateId: string;
  readonly state: string;
  readonly decisionId?: string;
  readonly late: boolean;
  readonly provisional: boolean;
  readonly eligibleForAutomatic: boolean;
  readonly reasonIfNot?: readonly string[];
  readonly corroborationId?: string;
  readonly replayed?: true;
}

export interface SubmissionOutcome {
  /** `201` recorded; `200` a corroboration or a replay (`contracts/learning-api.md`). */
  readonly status: 200 | 201;
  readonly body: SubmissionBody;
}

export interface SubmissionDeps {
  readonly store: LearningStore;
  readonly ports: LearningPorts;
  readonly policy: LearningPolicyReader;
  readonly now?: () => Date;
  /** Wired to `DecisionRequester.request` by the module; absent ⇒ the candidate stays proposed. */
  readonly requestDecision?: (candidate: CandidateRecord) => Promise<DecisionRequestOutcome>;
}

/** `R-048-15` — lower-case, punctuation stripped, whitespace collapsed. */
export function normaliseSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function subjectKeyOf(category: string, subject: string): string {
  return `${category}:${normaliseSubject(subject)}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** sha256 of the canonical candidate core — the `objectVersion` sent to `EPIC-031`. */
export function objectDigestOf(s: LearningSubmissionV1, source: { projectId: string; sourcePrincipalId: string }): string {
  const core = {
    kind: s.kind,
    targetVersionId: s.targetVersionId ?? null,
    statement: s.statement,
    category: s.category,
    subject: s.subject,
    evidence: [...s.evidence].map((e) => `${e.evidenceId}:${e.digest.sha256}`).sort(),
    confidence: s.confidence,
    claimedScope: { kind: s.claimedScope.kind, projectIds: [...s.claimedScope.projectIds].sort() },
    executionId: s.executionId ?? null,
    projectId: source.projectId,
    sourcePrincipalId: source.sourcePrincipalId,
  };
  return createHash('sha256').update(canonical(core)).digest('hex');
}

const HOUR = 3_600_000;

/** `FR-LRN-055` — the one memory policy that permits governed learning (`A-047-1`). */
export const GOVERNED_KNOWLEDGE = 'governed-knowledge';

export class SubmissionService {
  private readonly now: () => Date;

  constructor(private readonly deps: SubmissionDeps) {
    this.now = deps.now ?? ((): Date => new Date());
  }

  async submit(input: SubmitInput): Promise<SubmissionOutcome> {
    try {
      return await this.intake(input);
    } catch (err) {
      await this.recordRefusal(input, err);
      throw err;
    }
  }

  private async intake(input: SubmitInput): Promise<SubmissionOutcome> {
    const { actor } = input;
    const ws = actor.workspaceId;
    const named = this.namedExecution(input.body);

    // 0. Secrets first (FR-LRN-018, T2329): before parsing, before any read that
    //    could log it, before anything is stored. 503 while SecretScreen is unbound.
    await assertNoSecret(this.deps.ports.secrets, input.body);

    // 1. Parse — every missing element at once (FR-LRN-010).
    const parsed = parseSubmission(input.body, { requireExecution: actor.kind === 'agent' });
    if (!parsed.ok) {
      throw new ValidationFailedError(
        `The submission is incomplete or malformed: ${parsed.problems.map((p) => `${p.field} — ${p.problem}`).join('; ')}.`,
        { missing: parsed.missing, problems: parsed.problems },
      );
    }
    const s = parsed.value;
    if (actor.kind === 'person' && s.executionId !== undefined) {
      throw new ValidationFailedError(
        "A person's candidate names the person as its source (FR-LRN-006); an agent's observation is submitted through the connector route with its execution.",
        { field: 'executionId' },
      );
    }
    const sourcePrincipalId = actor.kind === 'person' ? actor.userId : actor.principalId;
    const projectId = input.projectId;
    const objectDigest = objectDigestOf(s, { projectId, sourcePrincipalId });

    // 2. Replay (FR-LRN-061).
    const replay = await this.replay(ws, s.idempotencyKey, objectDigest);
    if (replay !== null) {
      // The event is appended again under the same key — a no-op if it landed,
      // the recovery if the first response was lost before it did (FR-LRN-060).
      const prior = await this.deps.store.candidate(ws, replay.body.candidateId);
      if (prior !== null) await this.recordOutcome(prior, prior.late ? 'late-submitted' : 'submitted');
      return replay;
    }

    // 3. Policy and category (FR-LRN-003).
    const policy = await this.deps.policy.require(ws);
    if (policy.category(s.category) === null) {
      throw new ValidationFailedError(
        `Category "${s.category}" is not defined by the learning policy v${policy.version} (FR-LRN-003). Defined: ${policy.categories.map((c) => c.key).join(', ')}.`,
        { category: s.category, policyVersion: policy.version },
      );
    }

    // 4. Source, grace period and bound.
    const project = await this.deps.ports.projects.find(ws, projectId);
    if (project === null) throw new ValidationFailedError(`Project ${projectId} is not a project of this workspace.`, { projectId });
    if (project.status === 'archived') throw new ValidationFailedError(`Project ${projectId} is archived; it takes no new candidates.`, { projectId });
    const source = await this.source(ws, s, actor, projectId, policy, named);

    // 5. Scope and target.
    await this.checkScope(ws, s, projectId);
    await this.checkTarget(ws, s);

    // 6. Evidence (FR-LRN-012) — resolution refuses 503 while EvidenceReads is unbound.
    await this.checkEvidence(ws, s);

    // 7. Record.
    const at = this.now();
    const candidate: CandidateRecord = {
      id: newLearningId('lc'),
      workspaceId: ws,
      projectId,
      kind: s.kind,
      targetVersionId: s.targetVersionId ?? null,
      statement: s.statement,
      category: s.category,
      subject: s.subject,
      subjectKey: subjectKeyOf(s.category, s.subject),
      sourceKind: actor.kind === 'person' ? 'person' : 'execution',
      executionId: s.executionId ?? null,
      sourcePrincipalId,
      expertId: source.expert?.expertId ?? null,
      expertContractVersionId: source.expert?.contractVersionId ?? null,
      expertContractVersion: source.expert?.contractVersion ?? null,
      confidenceLevel: s.confidence.level,
      confidenceBasis: s.confidence.basis,
      claimedScope: s.claimedScope,
      proposedBand: s.proposedBand ?? null,
      late: source.late,
      provisional: source.provisional,
      policyVersion: policy.version,
      objectDigest,
      idempotencyKey: s.idempotencyKey,
      correlationId: s.correlationId,
      submittedAt: at,
    };
    const citations = this.citationsFor(candidate, s, null);
    await this.deps.store.transaction(
      async (tx) => {
        if ((await tx.candidateByIdempotencyKey(ws, s.idempotencyKey)) !== null) {
          throw new ConflictError(`idempotency key ${s.idempotencyKey} was recorded concurrently; retry to receive the original answer.`);
        }
        await tx.insertCandidate(candidate, citations, {
          workspaceId: ws,
          candidateId: candidate.id,
          state: 'proposed',
          reason: source.provisional ? 'execution-provisional' : null,
          decisionId: null,
          actorKind: 'platform',
          actorId: 'learning-intake',
          at,
        });
      },
      { lockKeys: [`learning-subject:${ws}:${candidate.subjectKey}`] },
    );

    await this.recordOutcome(candidate, candidate.late ? 'late-submitted' : 'submitted');
    return { status: 201, body: await this.afterRecord(candidate) };
  }

  /** The decision request (`FR-LRN-020`), unless the execution is provisional (`FR-LRN-063`). */
  private async afterRecord(candidate: CandidateRecord): Promise<SubmissionBody> {
    const base = { candidateId: candidate.id, late: candidate.late, provisional: candidate.provisional };
    if (candidate.provisional) {
      return { ...base, state: 'proposed', eligibleForAutomatic: false, reasonIfNot: ['execution-not-governed'] };
    }
    if (this.deps.requestDecision === undefined) {
      return { ...base, state: 'proposed', eligibleForAutomatic: false, reasonIfNot: ['decision-path-unavailable'] };
    }
    const outcome = await this.deps.requestDecision(candidate);
    return {
      ...base,
      state: outcome.state,
      ...(outcome.decisionId !== undefined ? { decisionId: outcome.decisionId } : {}),
      eligibleForAutomatic: outcome.eligibility.automatic,
      ...(outcome.eligibility.automatic ? {} : { reasonIfNot: outcome.eligibility.failedConditions }),
      ...(outcome.reason !== undefined && !outcome.eligibility.automatic ? { reasonIfNot: [...outcome.eligibility.failedConditions, outcome.reason] } : {}),
    };
  }

  /**
   * `FR-LRN-060` — a recorded outcome on the source execution. Content class, so
   * it is accepted after the execution's terminal event (`R-048-17`). A person's
   * candidate has no execution and appends nothing.
   */
  private async recordOutcome(candidate: CandidateRecord, kind: 'submitted' | 'late-submitted' | 'corroborated', corroborationId?: string): Promise<void> {
    if (candidate.executionId === null || candidate.sourceKind !== 'execution') return;
    await this.deps.ports.executions.appendLearningEvent({
      workspaceId: candidate.workspaceId,
      executionId: candidate.executionId,
      payload: learningEventPayload({ kind, candidateId: candidate.id }),
      idempotencyKey: `learning:${corroborationId ?? candidate.id}:${kind}`,
      emittedBy: candidate.sourcePrincipalId,
    });
  }

  /**
   * `FR-LRN-060`, `FR-LRN-007` — a refusal is an event on the execution it names,
   * when that execution is registered in this workspace. Recording is best
   * effort: the refusal itself is what the caller must see, and a registry
   * outage must not turn a 400 into a 503.
   */
  private async recordRefusal(input: SubmitInput, err: unknown): Promise<void> {
    if (input.actor.kind !== 'agent' || !(err instanceof ValidationFailedError)) return;
    const executionId = this.namedExecution(input.body);
    if (executionId === null) return;
    try {
      const facts = await this.deps.ports.executions.describe(input.actor.workspaceId, executionId);
      if (facts === null) return;
      const details = (err.details ?? {}) as Record<string, unknown>;
      const kind = details['bound'] !== undefined ? 'bound-exceeded' : details['memoryPolicy'] !== undefined ? 'memory-policy-refused' : 'refused';
      const key = typeof (input.body as Record<string, unknown>)['idempotencyKey'] === 'string' ? String((input.body as Record<string, unknown>)['idempotencyKey']) : newLearningId('anon');
      await this.deps.ports.executions.appendLearningEvent({
        workspaceId: input.actor.workspaceId,
        executionId,
        payload: learningEventPayload({ kind, reason: err.message.slice(0, 500) }),
        idempotencyKey: `learning:refused:${key}:${kind}`,
        emittedBy: input.actor.principalId,
      });
    } catch {
      // Best effort — see above.
    }
  }

  private namedExecution(body: unknown): string | null {
    if (body === null || typeof body !== 'object') return null;
    const id = (body as Record<string, unknown>)['executionId'];
    return typeof id === 'string' && id.trim() !== '' ? id : null;
  }

  private async replay(ws: string, key: string, digest: string): Promise<SubmissionOutcome | null> {
    const prior = await this.deps.store.candidateByIdempotencyKey(ws, key);
    if (prior === null) return null;
    if (prior.objectDigest !== digest) {
      throw new ConflictError(`idempotency key ${key} was already used for a different submission (FR-LRN-061).`, { idempotencyKey: key });
    }
    const current = await this.deps.store.currentTransition(ws, prior.id);
    const decisionId = (await this.deps.store.transitions(ws, prior.id)).reverse().find((t) => t.decisionId !== null)?.decisionId;
    return {
      status: 200,
      body: {
        candidateId: prior.id,
        state: current?.state ?? 'proposed',
        ...(decisionId ? { decisionId } : {}),
        late: prior.late,
        provisional: prior.provisional,
        eligibleForAutomatic: false,
        replayed: true,
      },
    };
  }

  private async source(
    ws: string,
    s: LearningSubmissionV1,
    actor: SubmissionActor,
    projectId: string,
    policy: LearningPolicy,
    _named: string | null,
  ): Promise<{ late: boolean; provisional: boolean; expert: ExpertFacts | null }> {
    if (actor.kind === 'person') return { late: false, provisional: false, expert: null };
    const executionId = s.executionId!;
    const facts = await this.deps.ports.executions.describe(ws, executionId);
    if (facts === null) {
      throw new ValidationFailedError(
        `Execution ${executionId} is not registered in this workspace; an observation with no source session is not a candidate (FR-LRN-005).`,
        { executionId },
      );
    }
    if (facts.projectId !== projectId) {
      throw new ValidationFailedError(`Execution ${executionId} is not bound to project ${projectId}.`, { executionId, projectId });
    }
    let late = false;
    if (facts.terminal !== null) {
      const since = this.now().getTime() - Date.parse(facts.terminal.at);
      if (since > policy.gracePeriodHours * HOUR) {
        throw new ValidationFailedError(
          `Execution ${executionId} ended with "${facts.terminal.type}" at ${facts.terminal.at}; late submissions are accepted for ${policy.gracePeriodHours} h after that (FR-LRN-005).`,
          { executionId, terminalEvent: facts.terminal.type, terminalAt: facts.terminal.at, gracePeriodHours: policy.gracePeriodHours },
        );
      }
      late = true;
    }
    const count = await this.deps.store.submissionsForExecution(ws, executionId);
    if (count >= policy.maxCandidatesPerExecution) {
      throw new ValidationFailedError(
        `Execution ${executionId} has already submitted ${count} candidates; the bound is ${policy.maxCandidatesPerExecution} per execution (FR-LRN-007).`,
        { executionId, bound: policy.maxCandidatesPerExecution },
      );
    }
    // FR-LRN-011 (T2337): an Expert session records its Expert and contract
    // version. 503 naming ExpertProvenance while EPIC-047's read is unbound — an
    // execution that may be an Expert's cannot be judged, so it is not recorded.
    const expert = await this.deps.ports.experts.forExecution(ws, executionId);
    // FR-LRN-055 (T2339): only `governed-knowledge` may contribute. `none` — and
    // any value this Epic does not recognise — is refused; the refusal is recorded
    // on the execution as `memory-policy-refused` (`recordRefusal`, via the
    // `memoryPolicy` detail). Nothing is stored per Expert (FR-LRN-056).
    if (expert !== null && expert.memoryPolicy !== GOVERNED_KNOWLEDGE) {
      throw new ValidationFailedError(
        `Expert ${expert.expertId} runs contract version ${expert.contractVersion}, whose memory policy "${expert.memoryPolicy}" does not permit ` +
          `contributing to governed learning; only "${GOVERNED_KNOWLEDGE}" does (FR-LRN-055).`,
        { memoryPolicy: expert.memoryPolicy, expertId: expert.expertId, contractVersionId: expert.contractVersionId, contractVersion: expert.contractVersion },
      );
    }
    return { late, provisional: facts.governanceState !== 'governed', expert };
  }

  private async checkScope(ws: string, s: LearningSubmissionV1, projectId: string): Promise<void> {
    const scope = s.claimedScope;
    if (scope.kind === 'project' && !scopeIncludesProject(scope, projectId)) {
      throw new ValidationFailedError(
        `A project scope claims the source project ${projectId}; claim a named set or the workspace to propose wider reuse (FR-LRN-014).`,
        { claimedScope: scope },
      );
    }
    if (scope.kind === 'projects') {
      const unknown: string[] = [];
      for (const p of scope.projectIds) if ((await this.deps.ports.projects.find(ws, p)) === null) unknown.push(p);
      if (unknown.length > 0) {
        throw new ValidationFailedError(`The named set includes projects that are not in this workspace: ${unknown.join(', ')} (FR-LRN-014).`, { unknownProjects: unknown });
      }
    }
  }

  /** `supersede`, `deprecate` and `widen-scope` act on the **current** version (`FR-LRN-031`). */
  private async checkTarget(ws: string, s: LearningSubmissionV1): Promise<void> {
    if (s.kind === 'new') return;
    const target = await this.deps.store.version(ws, s.targetVersionId!);
    if (target === null) throw new ValidationFailedError(`Knowledge version ${s.targetVersionId} does not exist in this workspace.`, { targetVersionId: s.targetVersionId });
    const status = await this.deps.store.currentStatus(ws, target.id);
    if (status?.status !== 'current') {
      throw new ValidationFailedError(`Knowledge version ${target.id} is ${status?.status ?? 'not current'}; only the current version can be acted on.`, {
        targetVersionId: target.id,
        status: status?.status ?? null,
      });
    }
    if (s.kind === 'widen-scope') {
      const { isStrictlyWider } = await import('@pmi/learning-contract');
      if (!isStrictlyWider(s.claimedScope, target.scope)) {
        throw new ValidationFailedError('A widen-scope candidate claims a scope strictly wider than the current version’s (FR-LRN-042).', {
          currentScope: target.scope,
          claimedScope: s.claimedScope,
        });
      }
    }
  }

  private async checkEvidence(ws: string, s: LearningSubmissionV1): Promise<void> {
    const ids = s.evidence.map((e) => e.evidenceId);
    const resolved = await this.deps.ports.evidence.resolve(ws, ids);
    const absent = ids.filter((id) => !resolved.has(id));
    if (absent.length > 0) {
      throw new ValidationFailedError(`Evidence not held in this workspace's Evidence Store: ${absent.join(', ')} (FR-LRN-012).`, {
        unresolvable: absent,
      });
    }
  }

  private citationsFor(candidate: CandidateRecord, s: LearningSubmissionV1, corroborationId: string | null): CitationRecord[] {
    return s.evidence.map((e) => ({
      id: newLearningId('lce'),
      workspaceId: candidate.workspaceId,
      candidateId: candidate.id,
      corroborationId,
      evidenceId: e.evidenceId,
      digestAlgorithm: 'sha256' as const,
      digest: e.digest.sha256,
    }));
  }
}
