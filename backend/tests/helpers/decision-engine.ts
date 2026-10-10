/**
 * EPIC-031 — a decision engine wired entirely in memory, for unit tests.
 *
 * Every port is real-shaped and replaceable: a test that needs a refusing
 * steering source, a missing gate provider or an absent audit sink passes it in
 * and changes nothing else.
 */
import type {
  AuditSink,
  ClassificationRule,
  DecisionAuditEntry,
  DecisionRequest,
  GateOutcome,
  GateProvider,
  ResolvedRuleset,
  SteeringSource,
} from '@pmi/decision-contract';
import { DecisionEngine } from '../../src/modules/decision/evaluator.js';
import { InMemoryDecisionRepository } from '../../src/modules/decision/decision.repository.js';
import {
  PLATFORM_DEFAULT_POLICY,
  type PolicySource,
  type TenantPolicyDocument,
} from '../../src/modules/decision/policy.loader.js';

export const WS = 'ws_dpe';

export function rules(list: ClassificationRule[], precedence?: string): SteeringSource {
  const ruleset: ResolvedRuleset = {
    rules: list,
    source: list.length === 0 ? null : { lineageId: 'lin-risk', version: 4 },
    ...(precedence !== undefined ? { precedence } : {}),
  };
  return { rulesetFor: async () => ruleset };
}

export function policy(overrides: Partial<TenantPolicyDocument> = {}): PolicySource {
  return { current: async () => ({ ...PLATFORM_DEFAULT_POLICY, version: 2, approvedBy: 'owner', ...overrides }) };
}

export function gates(results: Record<string, GateOutcome['result']>): GateProvider {
  return {
    evaluate: async (gateId) =>
      gateId in results ? { gateId, result: results[gateId]! } : { gateId, result: 'refused', detail: 'not configured' },
  };
}

export class RecordingAudit implements AuditSink {
  readonly entries: DecisionAuditEntry[] = [];
  async record(entry: DecisionAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export interface EngineOptions {
  steering?: SteeringSource | null;
  policies?: PolicySource | null;
  gates?: GateProvider | null;
  audit?: AuditSink | null;
  repository?: InMemoryDecisionRepository;
}

export function engine(options: EngineOptions = {}) {
  const repository = options.repository ?? new InMemoryDecisionRepository();
  const audit = options.audit === undefined ? new RecordingAudit() : options.audit;
  const subject = new DecisionEngine({
    steering: options.steering === undefined ? rules([]) : options.steering,
    policies: options.policies === undefined ? policy() : options.policies,
    gates: options.gates === undefined ? null : options.gates,
    audit,
    repository,
  });
  // The default is always a RecordingAudit; a test that passes its own (or null) reads it from its own variable.
  return { engine: subject, repository, audit: audit as RecordingAudit };
}

export function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    workspaceId: WS,
    projectId: 'p1',
    actionType: 'deploy',
    target: { type: 'service', id: 'svc-1' },
    objectVersion: '7',
    actor: { kind: 'human', id: 'u_requester' },
    requiredGates: [],
    ...overrides,
  };
}
