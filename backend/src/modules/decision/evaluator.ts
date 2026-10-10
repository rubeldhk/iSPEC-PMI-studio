/**
 * `T746`–`T750`, `T777`–`T780`, `T780b`, `T780f` — the decision engine.
 * `FR-DPE-010`–`FR-DPE-016`, `FR-DPE-030`–`FR-DPE-032`, `FR-DPE-050`.
 *
 * One evaluation, in order, each step able to refuse:
 *
 * 1. **Read** the ruleset (`EPIC-019` steering) and the tenant policy. If either
 *    cannot be read, or no `AuditSink` is bound, refuse — `FR-DPE-050`.
 * 2. **Classify** — policy-declared, never model-inferred (`classifier.ts`).
 * 3. **Automation** must be permitted by policy, citing the rule that fired it
 *    (`FR-DPE-030`, `FR-DPE-031`).
 * 4. **Gates** — every required gate resolves to `satisfied`, a recorded
 *    `exception`, `refused` or `violation`; anything but the first two refuses.
 *    `satisfied` comes only from a provider saying so (`FR-DPE-013`).
 * 5. **Treatment** — low may auto-execute, medium needs its gates, high waits
 *    for an authorized human (`FR-DPE-010`).
 * 6. **Record** the explanation and the decision together, then audit it —
 *    every outcome, permitted or not (`FR-DPE-016`).
 *
 * ## Cedar's properties (`R-031-2`)
 *
 * Default deny and forbid-overrides-permit are adopted. **Skip-on-error is
 * rejected**: every source that errors refuses the decision, and the refusal
 * says which source. An unexplainable allow is a defect (`FR-DPE-040`).
 *
 * ## Never throws on a governance outcome
 *
 * `decide`, `approve`, `refuse` and `recordException` return a `DecisionResult` for every
 * refusal — the reason travels as data a Room can render (`FR-DPE-043`). They
 * throw only for a caller error (an unknown decision, an exception missing its
 * reason) or an attempt to resolve a decision twice.
 */
import {
  CLOSURE_KINDS,
  GATE_RESULTS,
  MOST_RESTRICTIVE_BAND,
  isClosureKind,
  type ActorRef,
  type AuditSink,
  type ClosureKind,
  type DecisionOutcome,
  type DecisionRequest,
  type DecisionResult,
  type GateOutcome,
  type GateProvider,
  type ResolvedRuleset,
  type RiskBand,
  type SteeringRuleRef,
  type SteeringSource,
} from '@pmi/decision-contract';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { classifyAction } from './classifier.js';
import { buildExplanation } from './explanation.builder.js';
import type { DecisionRecord, DecisionRepository, GateExceptionRecord } from './decision.repository.js';
import { patternCovers, type PolicySource, type TenantPolicyDocument } from './policy.loader.js';

export interface DecisionEngineDeps {
  readonly steering: SteeringSource | null;
  readonly policies: PolicySource | null;
  readonly gates: GateProvider | null;
  readonly audit: AuditSink | null;
  readonly repository: DecisionRepository;
  readonly now?: () => Date;
}

/** What one decision was judged on — enough to conclude it, or to re-conclude it under an exception. */
interface Judgement {
  readonly request: DecisionRequest;
  readonly band: RiskBand;
  readonly policy: TenantPolicyDocument;
  readonly matchedRule: SteeringRuleRef | null;
  readonly precedence?: string | undefined;
  readonly classificationReason: string;
  readonly constraintCited?: string | undefined;
}

function fromRecord(record: DecisionRecord): DecisionResult {
  const { id: _explanationId, ...explanation } = record.explanation;
  return {
    decisionId: record.id,
    outcome: record.outcome,
    effectiveClass: record.effectiveClass,
    explanation,
    gateOutcomes: record.gateOutcomes,
  };
}

export class DecisionEngine {
  private readonly now: () => Date;

  constructor(private readonly deps: DecisionEngineDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  // ─────────────────────────────────────────────────────────────── decide

  async decide(request: DecisionRequest): Promise<DecisionResult> {
    // 1. The sources. Each that cannot be read refuses (FR-DPE-050).
    if (this.deps.audit === null) {
      return this.failClosed(request, 'no AuditSink is bound (EPIC-004); a decision that cannot be recorded is not taken (FR-DPE-016, FR-DPE-050)');
    }
    let ruleset: ResolvedRuleset;
    let policy: TenantPolicyDocument;
    try {
      if (this.deps.steering === null) throw new Error('no SteeringSource is bound (EPIC-019)');
      ruleset = await this.deps.steering.rulesetFor({ workspaceId: request.workspaceId, projectId: request.projectId });
    } catch (error) {
      return this.failClosed(request, `the classification rules could not be read — ${(error as Error).message} (FR-DPE-050)`);
    }
    try {
      if (this.deps.policies === null) throw new Error('no policy source is bound');
      policy = await this.deps.policies.current(request.workspaceId);
    } catch (error) {
      return this.failClosed(request, `the tenant policy could not be read — ${(error as Error).message} (FR-DPE-050)`);
    }

    // 2. Classify — policy-declared (FR-DPE-003).
    const classification = classifyAction({ actionType: request.actionType, target: request.target }, ruleset);
    const judgement: Judgement = {
      request,
      band: classification.band,
      policy,
      matchedRule: classification.source,
      precedence: ruleset.precedence,
      classificationReason: classification.reason,
      constraintCited: classification.constraintCited,
    };

    // 3. Automation, only where policy permits it, citing the firing rule.
    if (request.actor.kind === 'automation') {
      const refusal = this.automationRefusal(request, policy);
      if (refusal !== null) return this.record(judgement, 'refused', refusal, [], null);
    }

    // 4–5. Gates, then the band's treatment.
    const gateOutcomes = await this.evaluateGates(request, []);
    return this.conclude(judgement, gateOutcomes, null, null);
  }

  // ─────────────────────────────────────────────────────────────── approve

  /**
   * `FR-DPE-014`, `FR-DPE-015`. A human approves a pending decision — not their
   * own request unless policy names the action class. An attempt without
   * authority is **refused and not recorded as a resolution**: the decision
   * stays pending for someone who has it. The attempt is audited.
   */
  async approve(input: { workspaceId: string; decisionId: string; approver: ActorRef }): Promise<DecisionResult> {
    const pending = await this.pendingDecision(input.workspaceId, input.decisionId);
    const policy = await this.currentPolicyOrThrow(input.workspaceId);
    const requester = pending.requestedBy ?? pending.actorId;

    const refusedAttempt = async (authorityApplied: string): Promise<DecisionResult> => {
      await this.deps.audit?.record({
        workspaceId: input.workspaceId,
        decisionId: pending.id,
        actionType: pending.actionType,
        outcome: 'approval-refused',
        actor: input.approver.id,
      });
      const { id: _id, ...explanation } = pending.explanation;
      return {
        decisionId: pending.id,
        outcome: 'refused',
        effectiveClass: pending.effectiveClass,
        explanation: { ...explanation, authorityApplied },
        gateOutcomes: pending.gateOutcomes,
      };
    };

    if (input.approver.kind !== 'human') {
      return refusedAttempt(`only an authorized human may approve a ${pending.effectiveClass}-band decision; ${input.approver.id} is automation (FR-DPE-010)`);
    }
    let selfNote = '';
    if (input.approver.id === requester) {
      const permitting = policy.selfApprovalAllowed.find((p) => patternCovers(p, pending.actionType));
      if (permitting === undefined) {
        return refusedAttempt(
          `${input.approver.id} requested this and may not approve it; policy v${policy.version} does not permit ` +
            `self-approval for ${pending.actionType} (FR-DPE-015)`,
        );
      }
      selfNote = `; self-approval permitted by policy v${policy.version} for ${permitting} (FR-DPE-015)`;
    }

    const authorityApplied =
      `approved by ${input.approver.id}, an authenticated human in this workspace — the authority model ` +
      `available until U-02 (FR-DPE-014)${selfNote}`;
    const { id: _explanationId, ...prior } = pending.explanation;
    const record = await this.deps.repository.append({
      ...this.carry(pending),
      outcome: pending.outcome === 'pending' && pending.gateOutcomes.some((g) => g.result === 'exception') ? 'exception' : 'approved',
      decidedBy: input.approver.id,
      decidedAt: this.now(),
      actorKind: 'human',
      actorId: input.approver.id,
      authorityBasis: authorityApplied,
      resolvesDecisionId: pending.id,
      explanation: { ...prior, authorityApplied },
    });
    await this.audit(record);
    return fromRecord(record);
  }

  // ─────────────────────────────────────────────────────────────── refuse

  /**
   * `T2504`, `FR-DPE-017` (amendment `A-031-1`) — close a pending decision
   * without approving it. The closure is a new row resolving the pending one,
   * always with outcome `refused`, carrying its kind and reason in the
   * explanation and its actor under `FR-DPE-014`:
   *
   * - `rejected` — by a human who is not the requester (a requester withdraws);
   * - `withdrawn` — by the requester: the human it names, or the automation
   *   that made it;
   * - `expired` — by the automation that made the request, and only that one.
   *
   * An attempt outside those is **not recorded as a resolution**: it is audited
   * as `closure-refused` and the decision stays pending — the same shape as an
   * unauthorized approval. A closure cannot approve; there is no branch here
   * that writes anything but `refused`.
   */
  async refuse(input: {
    workspaceId: string;
    decisionId: string;
    by: ActorRef;
    kind: ClosureKind;
    reason: string;
  }): Promise<DecisionResult> {
    if (!isClosureKind(input.kind)) {
      throw new ValidationFailedError(`a closure is one of ${CLOSURE_KINDS.join(', ')} (FR-DPE-017)`);
    }
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason === '') throw new ValidationFailedError('a closure states its reason (FR-DPE-017)');
    const pending = await this.pendingDecision(input.workspaceId, input.decisionId);
    const requester = pending.requestedBy ?? pending.actorId;
    const madeIt = pending.actorKind === 'automation' && pending.actorId === input.by.id;

    const refusal = ((): string | null => {
      if (input.by.kind === 'automation' && !madeIt) {
        return `automation may close only its own request; ${input.by.id} did not request ${pending.id} (FR-DPE-017)`;
      }
      switch (input.kind) {
        case 'rejected':
          if (input.by.kind !== 'human') return `only an authorized human may reject a decision; ${input.by.id} is automation (FR-DPE-017)`;
          if (input.by.id === requester) {
            return `${input.by.id} requested this and may not reject it; a requester may withdraw it instead (FR-DPE-017)`;
          }
          return null;
        case 'withdrawn':
          if (input.by.kind === 'human' && input.by.id !== requester) {
            return `only ${requester}, who requested it, may withdraw ${pending.id} (FR-DPE-017)`;
          }
          return null;
        case 'expired':
          if (input.by.kind === 'human') return 'a decision is expired only by the automation that requested it (FR-DPE-017)';
          return null;
      }
    })();

    const { id: _explanationId, ...prior } = pending.explanation;
    if (refusal !== null) {
      await this.deps.audit?.record({
        workspaceId: input.workspaceId,
        decisionId: pending.id,
        actionType: pending.actionType,
        outcome: 'closure-refused',
        actor: input.by.id,
      });
      return {
        decisionId: pending.id,
        outcome: 'refused',
        effectiveClass: pending.effectiveClass,
        explanation: { ...prior, authorityApplied: refusal },
        gateOutcomes: pending.gateOutcomes,
      };
    }

    const authorityApplied =
      `${input.kind} by ${input.by.id} (${input.by.kind}) — ${reason}; the pending decision is closed without ` +
      `approval (FR-DPE-017)`;
    const record = await this.deps.repository.append({
      ...this.carry(pending),
      outcome: 'refused',
      decidedBy: input.by.id,
      decidedAt: this.now(),
      actorKind: input.by.kind,
      actorId: input.by.id,
      authorityBasis: authorityApplied,
      resolvesDecisionId: pending.id,
      explanation: { ...prior, authorityApplied, closure: { kind: input.kind, reason } },
    });
    await this.audit(record);
    return fromRecord(record);
  }

  // ─────────────────────────────────────────────────────────────── exceptions

  /**
   * `FR-DPE-013`, data-model §4. A human grants an expiring, recorded exception
   * to one required gate of a refused decision; the decision is then
   * re-concluded, and the result resolves the refused one.
   */
  async recordException(input: {
    workspaceId: string;
    decisionId: string;
    gateId: string;
    authorizedBy: ActorRef;
    reason: string;
    expiresAt: Date | undefined;
  }): Promise<DecisionResult> {
    const refused = await this.deps.repository.get(input.workspaceId, input.decisionId);
    if (refused === null) throw new NotFoundError(`No decision ${input.decisionId}.`);
    if (refused.outcome !== 'refused') {
      throw new ConflictError(`decision ${input.decisionId} is ${refused.outcome}; an exception applies to a refused decision`);
    }
    if (await this.deps.repository.resolutionOf(input.workspaceId, refused.id)) {
      throw new ConflictError(`decision ${refused.id} is already resolved`);
    }
    if (input.authorizedBy.kind !== 'human') {
      throw new ValidationFailedError('an exception is authorized by a human (FR-DPE-013)');
    }
    if (typeof input.reason !== 'string' || input.reason.trim() === '') {
      throw new ValidationFailedError('an exception states its reason (FR-DPE-013)');
    }
    if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
      throw new ValidationFailedError('an exception carries an expiry; an expiry is a fact, not a grace period');
    }
    if (input.expiresAt.getTime() <= this.now().getTime()) {
      throw new ValidationFailedError('an exception that has already expired is not an exception — it would be a pass');
    }
    if (!refused.requiredGates.includes(input.gateId)) {
      throw new ValidationFailedError(`${input.gateId} is not a required gate of decision ${refused.id}`);
    }

    await this.deps.repository.appendException({
      workspaceId: input.workspaceId,
      decisionId: refused.id,
      gateId: input.gateId,
      authorizedBy: input.authorizedBy.id,
      reason: input.reason.trim(),
      expiresAt: input.expiresAt,
    });

    const request: DecisionRequest = {
      workspaceId: refused.workspaceId,
      projectId: refused.projectId,
      actionType: refused.actionType,
      target: refused.target,
      objectVersion: refused.objectVersion,
      actor: { kind: refused.actorKind, id: refused.actorId },
      requiredGates: refused.requiredGates,
      ...(refused.proposedClass !== null ? { proposedClass: refused.proposedClass } : {}),
      ...(refused.requestedBy !== null ? { requestedBy: refused.requestedBy } : {}),
    };
    const policy = await this.currentPolicyOrThrow(input.workspaceId);
    const judgement: Judgement = {
      request,
      band: refused.effectiveClass,
      policy,
      matchedRule: refused.explanation.matchedRule,
      precedence: refused.explanation.precedenceResolution,
      classificationReason: `classified ${refused.effectiveClass} when first decided`,
      constraintCited: refused.explanation.constraintCited,
    };
    const exceptions = await this.chainExceptions(input.workspaceId, refused);
    const gateOutcomes = await this.evaluateGates(request, exceptions);
    return this.conclude(judgement, gateOutcomes, refused.id, input.authorizedBy);
  }

  // ─────────────────────────────────────────────────────────────── internals

  /** Steps 4–6. */
  private async conclude(
    judgement: Judgement,
    gateOutcomes: readonly GateOutcome[],
    resolves: string | null,
    exceptionGrantor: ActorRef | null,
  ): Promise<DecisionResult> {
    const { request, band, policy } = judgement;
    const failing = gateOutcomes.filter((g) => g.result !== 'satisfied' && g.result !== 'exception');
    if (failing.length > 0) {
      return this.record(
        judgement,
        'refused',
        `required gate${failing.length > 1 ? 's' : ''} ${failing.map((g) => `${g.gateId} (${g.result})`).join(', ')} ` +
          'not satisfied; an unsatisfied gate refuses or proceeds under a recorded exception (FR-DPE-013)',
        gateOutcomes,
        resolves,
      );
    }
    const excepted = gateOutcomes.some((g) => g.result === 'exception');
    const treatment = policy.bandTreatment[band];

    if (treatment === 'human-approval') {
      return this.record(
        judgement,
        'pending',
        `${band} band under policy v${policy.version}: awaits approval by an authorized human other than the requester (FR-DPE-010, FR-DPE-015)`,
        gateOutcomes,
        resolves,
      );
    }
    if (treatment === 'gates-required' && request.requiredGates.length === 0) {
      return this.record(
        judgement,
        'refused',
        `${band} band under policy v${policy.version} requires at least one gate, and this request names none (FR-DPE-010)`,
        gateOutcomes,
        resolves,
      );
    }
    const outcome: DecisionOutcome = excepted ? 'exception' : treatment === 'auto-execute' ? 'auto-executed' : 'approved';
    const because =
      treatment === 'auto-execute'
        ? `${band} band auto-executes under policy v${policy.version} (FR-DPE-010)`
        : `${band} band under policy v${policy.version}: all ${request.requiredGates.length} required gate(s) satisfied (FR-DPE-010)`;
    return this.record(
      judgement,
      outcome,
      excepted ? `${because}, under a recorded exception granted by ${exceptionGrantor?.id ?? 'a human'} (FR-DPE-013)` : because,
      gateOutcomes,
      resolves,
      excepted && exceptionGrantor !== null ? exceptionGrantor : null,
    );
  }

  private async record(
    judgement: Judgement,
    outcome: DecisionOutcome,
    authorityApplied: string,
    gateOutcomes: readonly GateOutcome[],
    resolves: string | null,
    decider: ActorRef | null = null,
  ): Promise<DecisionResult> {
    const { request, band, policy } = judgement;
    const explanation = buildExplanation({
      policyVersion: policy.version,
      matchedRule: judgement.matchedRule,
      riskClass: band,
      precedence: judgement.precedence,
      authorityApplied: `${judgement.classificationReason}. ${authorityApplied}`,
      constraintCited: judgement.constraintCited,
      proposedClass: request.proposedClass,
      triggeredBy: request.triggeredBy,
    });
    const actor = decider ?? request.actor;
    const taken = outcome !== 'pending';
    const record = await this.deps.repository.append({
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      actionType: request.actionType,
      target: request.target,
      effectiveClass: band,
      proposedClass: request.proposedClass ?? null,
      outcome,
      decidedBy: !taken ? null : outcome === 'refused' ? `policy:v${policy.version}` : actor.id,
      authorityBasis: authorityApplied,
      objectVersion: request.objectVersion,
      decidedAt: taken ? this.now() : null,
      actorKind: actor.kind,
      actorId: actor.id,
      requestedBy: request.requestedBy ?? request.actor.id,
      steeringVersions: judgement.matchedRule === null ? {} : { [judgement.matchedRule.lineageId]: judgement.matchedRule.version },
      policyVersion: policy.version,
      requiredGates: request.requiredGates,
      gateOutcomes,
      resolvesDecisionId: resolves,
      explanation,
    });
    await this.audit(record);
    return fromRecord(record);
  }

  /** `FR-DPE-050` — refuse, record what could be recorded, and say which source failed. */
  private async failClosed(request: DecisionRequest, why: string): Promise<DecisionResult> {
    const policy: TenantPolicyDocument = {
      version: 0,
      bandTreatment: { low: 'human-approval', medium: 'human-approval', high: 'human-approval' },
      selfApprovalAllowed: [],
      automatedActions: [],
      approvedBy: 'platform',
    };
    const judgement: Judgement = {
      request,
      band: MOST_RESTRICTIVE_BAND,
      policy,
      matchedRule: null,
      classificationReason: 'not classified: the engine could not be consulted',
      constraintCited: `fail closed — ${why}`,
    };
    try {
      return await this.record(judgement, 'refused', 'refused without evaluation', [], null);
    } catch {
      // Not even the refusal could be stored. Still refused, still explained.
      return {
        decisionId: 'unrecorded',
        outcome: 'refused',
        effectiveClass: MOST_RESTRICTIVE_BAND,
        explanation: buildExplanation({
          policyVersion: 0,
          matchedRule: null,
          riskClass: MOST_RESTRICTIVE_BAND,
          authorityApplied: 'refused without evaluation; the refusal itself could not be recorded',
          constraintCited: `fail closed — ${why}`,
        }),
        gateOutcomes: [],
      };
    }
  }

  private automationRefusal(request: DecisionRequest, policy: TenantPolicyDocument): string | null {
    const permitted = policy.automatedActions.find((a) => patternCovers(a.actionPattern, request.actionType));
    if (permitted === undefined) {
      return `policy v${policy.version} permits no automated ${request.actionType}; a workflow may react only where policy says so (FR-DPE-030)`;
    }
    if (request.triggeredBy === undefined) {
      return `an automated ${request.actionType} names no rule that fired it, so it cannot be explained (FR-DPE-031)`;
    }
    if (request.triggeredBy.ruleId !== permitted.ruleId) {
      return (
        `${request.actionType} was fired by ${request.triggeredBy.ruleId}, but policy v${policy.version} permits it only ` +
        `when fired by ${permitted.ruleId} (FR-DPE-030, FR-DPE-031)`
      );
    }
    return null;
  }

  /** `FR-DPE-013` — one outcome per required gate. `satisfied` only from a provider that says so. */
  private async evaluateGates(
    request: DecisionRequest,
    exceptions: readonly GateExceptionRecord[],
  ): Promise<GateOutcome[]> {
    const now = this.now().getTime();
    return Promise.all(
      request.requiredGates.map(async (gateId): Promise<GateOutcome> => {
        const excepted = exceptions.find((e) => e.gateId === gateId && e.expiresAt.getTime() > now);
        if (excepted !== undefined) {
          return {
            gateId,
            result: 'exception',
            detail: `excepted by ${excepted.authorizedBy} until ${excepted.expiresAt.toISOString()}: ${excepted.reason}`,
          };
        }
        if (this.deps.gates === null) {
          return { gateId, result: 'violation', detail: 'no GateProvider is bound (EPIC-021); an unevaluated gate is not satisfied' };
        }
        try {
          const outcome = await this.deps.gates.evaluate(gateId, request);
          if (outcome.gateId !== gateId || !(GATE_RESULTS as readonly string[]).includes(outcome.result)) {
            return { gateId, result: 'violation', detail: `the gate provider answered for ${outcome.gateId}, not ${gateId}` };
          }
          return outcome;
        } catch {
          return { gateId, result: 'violation', detail: 'the gate provider failed; an unevaluated gate is not satisfied' };
        }
      }),
    );
  }

  /** Exceptions granted anywhere along the chain of decisions this one resolves. */
  private async chainExceptions(workspaceId: string, decision: DecisionRecord): Promise<GateExceptionRecord[]> {
    const all: GateExceptionRecord[] = [];
    let link: DecisionRecord | null = decision;
    while (link !== null) {
      all.push(...(await this.deps.repository.exceptionsFor(workspaceId, link.id)));
      link = link.resolvesDecisionId === null ? null : await this.deps.repository.get(workspaceId, link.resolvesDecisionId);
    }
    return all;
  }

  private async pendingDecision(workspaceId: string, id: string): Promise<DecisionRecord> {
    const decision = await this.deps.repository.get(workspaceId, id);
    if (decision === null) throw new NotFoundError(`No decision ${id}.`);
    if (await this.deps.repository.resolutionOf(workspaceId, id)) {
      throw new ConflictError(`decision ${id} is already resolved`);
    }
    if (decision.outcome !== 'pending') throw new ConflictError(`decision ${id} is ${decision.outcome}, not pending`);
    return decision;
  }

  private async currentPolicyOrThrow(workspaceId: string): Promise<TenantPolicyDocument> {
    if (this.deps.policies === null) throw new ConflictError('no policy source is bound (FR-DPE-050)');
    return this.deps.policies.current(workspaceId);
  }

  private carry(d: DecisionRecord) {
    return {
      workspaceId: d.workspaceId,
      projectId: d.projectId,
      actionType: d.actionType,
      target: d.target,
      effectiveClass: d.effectiveClass,
      proposedClass: d.proposedClass,
      objectVersion: d.objectVersion,
      requestedBy: d.requestedBy,
      steeringVersions: d.steeringVersions,
      policyVersion: d.policyVersion,
      requiredGates: d.requiredGates,
      gateOutcomes: d.gateOutcomes,
    };
  }

  private async audit(record: DecisionRecord): Promise<void> {
    await this.deps.audit?.record({
      workspaceId: record.workspaceId,
      decisionId: record.id,
      actionType: record.actionType,
      outcome: record.outcome,
      actor: record.actorId,
    });
  }
}
