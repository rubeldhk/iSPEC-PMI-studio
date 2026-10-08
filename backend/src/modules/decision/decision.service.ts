/**
 * `EPIC-031` — the decision engine's capabilities for an authenticated caller
 * (PC-1: callable without HTTP; the controller is a transport).
 *
 * The caller's identity comes from the session and never from a body: the
 * actor of a decision is whoever is signed in, and the requester is the same
 * person. Every read is scoped to the caller's workspace.
 */
import {
  isRiskBand,
  RISK_BANDS,
  type ActorRef,
  type DecisionRequest,
  type DecisionResult,
  type Explanation,
  type RiskBand,
} from '@pmi/decision-contract';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DecisionRepository } from './decision.repository.js';
import type { DecisionEngine } from './evaluator.js';
import { inboxFor, type InboxEntry } from './inbox.projection.js';
import { loadPolicy, type PolicySource, type TenantPolicyDocument } from './policy.loader.js';

export interface Principal {
  readonly workspaceId: string;
  readonly userId: string;
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationFailedError(`${what} is required.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationFailedError(`${what} is required.`);
  return value.trim();
}

export interface DecisionMetrics {
  readonly decisions: number;
  /** `FR-DPE-033` — how decisions spread across the bands. */
  readonly bandDistribution: Readonly<Record<RiskBand, number>>;
  /** Share of decisions that auto-executed — a tenant tuned into permanent auto-approval shows here. */
  readonly autoExecutionRate: number | null;
  readonly outcomes: Readonly<Record<string, number>>;
}

export class DecisionService {
  constructor(
    private readonly engine: DecisionEngine,
    private readonly repository: DecisionRepository,
    private readonly policies: PolicySource,
  ) {}

  private actor(principal: Principal): ActorRef {
    return { kind: 'human', id: principal.userId };
  }

  /** `POST /decisions` — the Decide seam's HTTP face. */
  async decide(principal: Principal, body: unknown): Promise<DecisionResult> {
    const input = record(body, 'A decision request');
    const target = record(input['target'], 'target');
    const requiredGates = input['requiredGates'] ?? [];
    if (!Array.isArray(requiredGates) || !requiredGates.every((g) => typeof g === 'string' && g !== '')) {
      throw new ValidationFailedError('requiredGates is a list of gate ids.');
    }
    const proposed = input['proposedClass'];
    if (proposed !== undefined && !isRiskBand(proposed)) {
      throw new ValidationFailedError(`proposedClass is one of ${RISK_BANDS.join(', ')}.`);
    }
    const request: DecisionRequest = {
      workspaceId: principal.workspaceId,
      projectId: text(input['projectId'], 'projectId'),
      actionType: text(input['actionType'], 'actionType'),
      target: { type: text(target['type'], 'target.type'), id: text(target['id'], 'target.id') },
      objectVersion: text(input['objectVersion'], 'objectVersion'),
      actor: this.actor(principal),
      requestedBy: principal.userId,
      requiredGates: requiredGates as string[],
      ...(proposed !== undefined ? { proposedClass: proposed as RiskBand } : {}),
    };
    const result = await this.engine.decide(request);
    if (result.outcome === 'refused') {
      // 409 carrying the decision id and its explanation, so the caller reads
      // why rather than inferring it (contract §7, FR-DPE-043).
      throw new ConflictError('The decision was refused by policy.', { decisionId: result.decisionId, result });
    }
    return result;
  }

  /** `POST /decisions/:id/approve` — 403 when the caller lacks the authority, with the reason. */
  async approve(principal: Principal, decisionId: string): Promise<DecisionResult> {
    const result = await this.engine.approve({
      workspaceId: principal.workspaceId,
      decisionId,
      approver: this.actor(principal),
    });
    if (result.outcome === 'refused') {
      throw new ForbiddenError('You may not approve this decision.', { decisionId, result });
    }
    return result;
  }

  /** `POST /decisions/:id/exceptions` — `FR-DPE-013`. */
  async recordException(principal: Principal, decisionId: string, body: unknown): Promise<DecisionResult> {
    const input = record(body, 'An exception');
    const expires = typeof input['expiresAt'] === 'string' ? new Date(input['expiresAt']) : undefined;
    return this.engine.recordException({
      workspaceId: principal.workspaceId,
      decisionId,
      gateId: text(input['gateId'], 'gateId'),
      authorizedBy: this.actor(principal),
      reason: typeof input['reason'] === 'string' ? input['reason'] : '',
      expiresAt: expires,
    });
  }

  /** `GET /decisions/:id/explanation` — renderable by a Room without a second lookup (`FR-DPE-043`). */
  async explanation(
    principal: Principal,
    decisionId: string,
  ): Promise<{ decisionId: string; outcome: string; effectiveClass: RiskBand; explanation: Explanation; resolvedBy: string | null }> {
    const decision = await this.repository.get(principal.workspaceId, decisionId);
    if (decision === null) throw new NotFoundError(`No decision ${decisionId}.`);
    const resolution = await this.repository.resolutionOf(principal.workspaceId, decisionId);
    const { id: _id, ...explanation } = decision.explanation;
    return {
      decisionId,
      outcome: decision.outcome,
      effectiveClass: decision.effectiveClass,
      explanation,
      resolvedBy: resolution?.id ?? null,
    };
  }

  /** `GET /inbox` — `FR-DPE-020`–`FR-DPE-025`. */
  async inbox(principal: Principal): Promise<{ entries: InboxEntry[] }> {
    const [decisions, policy] = await Promise.all([
      this.repository.list(principal.workspaceId),
      this.policies.current(principal.workspaceId),
    ]);
    return { entries: inboxFor(this.actor(principal), decisions, policy) };
  }

  /** `GET /decisions/metrics` — `FR-DPE-033`, `SC-DPE-008`. First decisions only: a resolution is not a second decision. */
  async metrics(principal: Principal): Promise<DecisionMetrics> {
    const first = (await this.repository.list(principal.workspaceId)).filter((d) => d.resolvesDecisionId === null);
    const bandDistribution = { low: 0, medium: 0, high: 0 } as Record<RiskBand, number>;
    const outcomes: Record<string, number> = {};
    for (const d of first) {
      bandDistribution[d.effectiveClass] += 1;
      outcomes[d.outcome] = (outcomes[d.outcome] ?? 0) + 1;
    }
    return {
      decisions: first.length,
      bandDistribution,
      autoExecutionRate: first.length === 0 ? null : (outcomes['auto-executed'] ?? 0) / first.length,
      outcomes,
    };
  }

  /** `GET /decision-policies/current`. */
  async currentPolicy(principal: Principal): Promise<TenantPolicyDocument> {
    return this.policies.current(principal.workspaceId);
  }

  /**
   * `POST /decision-policies` — `FR-DPE-011`. A sixth route the contract did not
   * list: without it the burden is tunable by nobody (`DEF-031-003`). Refused at
   * load, naming the action, when it crosses a fence (`FR-DPE-012`, `FR-DPE-031`).
   */
  async issuePolicy(principal: Principal, body: unknown): Promise<TenantPolicyDocument> {
    const current = await this.policies.current(principal.workspaceId);
    const candidate = { ...record(body, 'A tenant policy'), version: current.version + 1, approvedBy: principal.userId };
    const loaded = loadPolicy(candidate);
    if (!loaded.ok) throw new ValidationFailedError(loaded.message, { reason: loaded.reason });
    await this.repository.appendPolicy(principal.workspaceId, loaded.policy, new Date());
    return loaded.policy;
  }
}
