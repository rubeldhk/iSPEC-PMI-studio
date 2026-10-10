/**
 * EPIC-048 — recording in-test port bindings (`R-048-20`).
 *
 * Every binding records the calls it receives in `calls`, so a test asserts what
 * was asked as well as what was answered. Each is set up **visibly** in the test
 * that needs it; the module default stays refusing (`learning.tokens.ts`).
 */
import { secretRuleMatching } from '../../src/modules/executions/sanitisation.js';
import {
  refusingPorts,
  type AuditEntry,
  type DecisionView,
  type ExecutionFacts,
  type ExpertFacts,
  type LearningDecisionRequest,
  type LearningPorts,
  type PrincipalKind,
  type ResolutionView,
  type ResolvedEvidence,
} from '../../src/modules/learning/learning.tokens.js';
import { DIGEST } from './learning-fixtures.js';

export interface Recorded<T> {
  readonly calls: T[];
}

export interface LearningTestWorld {
  readonly ports: LearningPorts;
  readonly executions: Map<string, ExecutionFacts>;
  readonly events: { workspaceId: string; executionId: string; payload: Record<string, unknown>; idempotencyKey: string; emittedBy: string }[];
  readonly evidence: Map<string, ResolvedEvidence>;
  readonly experts: Map<string, ExpertFacts>;
  readonly projects: Map<string, { id: string; status: 'active' | 'archived'; workspaceId: string }>;
  readonly principals: Map<string, PrincipalKind>;
  readonly readable: Set<string>;
  readonly audit: AuditEntry[];
  readonly decisions: DecisionRecorder;
  readonly policyDocs: Map<string, { content: string; version: number; actorId: string }>;
  readonly reindexed: { workspaceId: string; entryId: string; versionId: string }[];
  readonly attestations: unknown[];
  /** Overwrite the outcome for the next reindex / attestation call. */
  indexOutcome: 'indexed' | 'current' | 'unbound' | 'bad-request';
  attestationFails: boolean;
}

/**
 * A decision engine stand-in that records every request and lets the test choose
 * the outcome. It does what `EPIC-031` does with a request — it does **not**
 * check who approves: that check is this Epic's, which is the point of `MP-3`.
 */
export class DecisionRecorder {
  readonly requests: LearningDecisionRequest[] = [];
  readonly approvals: { workspaceId: string; decisionId: string; approver: { kind: 'human'; id: string } }[] = [];
  readonly refusals: { workspaceId: string; decisionId: string; by: { kind: string; id: string }; kind: string; reason: string }[] = [];
  private readonly resolutions = new Map<string, ResolutionView>();
  private seq = 0;
  /** What `decide` answers. `pending` unless the test says otherwise. */
  next: 'pending' | 'auto-executed' | 'refused' | 'unreachable' = 'pending';
  /** Refuse an approval by the requester (separation of duties). */
  selfApprovalAllowed = false;
  readonly requestedBy = new Map<string, string>();
  readonly actionTypes = new Map<string, string>();

  explanation(actionType: string): DecisionView['explanation'] {
    return { policyVersion: '3', matchedRule: `rule:${actionType}`, riskClass: actionType.startsWith('learning.approve.') ? 'low' : 'high', authorityApplied: 'steering' };
  }

  async decide(request: LearningDecisionRequest): Promise<DecisionView> {
    if (this.next === 'unreachable') throw new Error('connect ECONNREFUSED decision engine');
    this.requests.push(request);
    const decisionId = `dec_${++this.seq}`;
    this.requestedBy.set(decisionId, request.requestedBy);
    this.actionTypes.set(decisionId, request.actionType);
    const outcome = this.next;
    const view: DecisionView = {
      decisionId,
      outcome,
      effectiveClass: outcome === 'auto-executed' ? 'low' : 'high',
      actionType: request.actionType,
      explanation: { ...this.explanation(request.actionType), ...(outcome === 'refused' ? { summary: 'automation not permitted for learning.* in this tenant' } : {}) },
    };
    if (outcome === 'auto-executed' || outcome === 'refused') {
      this.resolutions.set(decisionId, {
        decisionId,
        resolvingDecisionId: null,
        outcome,
        actorKind: 'automation',
        decidedBy: 'learning-intake',
        actionType: request.actionType,
        requestedBy: request.requestedBy,
        effectiveClass: view.effectiveClass,
        explanation: view.explanation,
      });
    }
    return view;
  }

  async approve(input: { workspaceId: string; decisionId: string; approver: { kind: 'human'; id: string } }): Promise<ResolutionView> {
    this.approvals.push(input);
    if (!this.selfApprovalAllowed && this.requestedBy.get(input.decisionId) === input.approver.id) {
      const { ForbiddenError } = await import('../../src/core/errors.js');
      throw new ForbiddenError('Self-approval is not allowed by policy (FR-DPE-015).');
    }
    return this.resolveAs(input.decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: input.approver.id });
  }

  async refuse(input: { workspaceId: string; decisionId: string; by: { kind: 'human' | 'automation'; id: string }; kind: 'rejected' | 'withdrawn' | 'expired'; reason: string }): Promise<ResolutionView> {
    this.refusals.push(input);
    return this.resolveAs(input.decisionId, { outcome: 'refused', actorKind: input.by.kind, decidedBy: input.by.id, closure: { kind: input.kind, reason: input.reason } });
  }

  async resolutionOf(_workspaceId: string, decisionId: string): Promise<ResolutionView | null> {
    return this.resolutions.get(decisionId) ?? null;
  }

  /** Resolve a pending decision as if it happened in EPIC-031's own Inbox. */
  resolveAs(decisionId: string, over: Partial<ResolutionView> & Pick<ResolutionView, 'outcome' | 'actorKind' | 'decidedBy'>): ResolutionView {
    const actionType = this.actionTypes.get(decisionId) ?? 'learning.review.candidate';
    const view: ResolutionView = {
      decisionId,
      resolvingDecisionId: `${decisionId}_r`,
      actionType,
      requestedBy: this.requestedBy.get(decisionId) ?? null,
      effectiveClass: 'high',
      explanation: this.explanation(actionType),
      ...over,
    };
    this.resolutions.set(decisionId, view);
    return view;
  }
}

export const POLICY = {
  categories: [
    { key: 'test-setup', description: 'How tests are run', lowRisk: true, defaultClassification: 'internal' },
    { key: 'architecture', description: 'Structural decisions', defaultClassification: 'internal' },
  ],
  reuse: { workspaceScopeAllowed: true, namedSetsAllowed: true, permittedClassifications: { default: ['internal'] } },
  gracePeriodHours: 24,
  reviewWindowDays: 30,
  maxCandidatesPerExecution: 20,
};

export function verified(evidenceId: string, over: Partial<ResolvedEvidence> = {}): ResolvedEvidence {
  return {
    evidenceId,
    integrity: 'valid',
    resolution: 'resolved',
    subjectDigest: DIGEST,
    predicateType: 'https://pmi.studio/attestation/test-run/v1',
    attestedArtifact: { id: 'art_1', version: 1 },
    attestedTarget: { type: 'project', id: 'p1' },
    ...over,
  };
}

/**
 * A world where everything on `main` is bound and the four unmerged ports are
 * bound by recorders: workspace `ws_a`, projects `p1`/`p2`/`p3`, one governed
 * registered execution `exe_1` in `p1`, evidence `ev_1`/`ev_2`, a learning
 * policy, and a human reviewer `u_h`.
 */
export function learningWorld(options: { policy?: object | null } = {}): LearningTestWorld {
  const executions = new Map<string, ExecutionFacts>();
  executions.set('exe_1', { executionId: 'exe_1', workspaceId: 'ws_a', projectId: 'p1', governanceState: 'governed', terminal: null, invalidatedBy: [] });
  const events: LearningTestWorld['events'] = [];
  const evidence = new Map<string, ResolvedEvidence>([
    ['ev_1', verified('ev_1')],
    ['ev_2', verified('ev_2')],
  ]);
  const experts = new Map<string, ExpertFacts>();
  const projects = new Map<string, { id: string; status: 'active' | 'archived'; workspaceId: string }>([
    ['p1', { id: 'p1', status: 'active', workspaceId: 'ws_a' }],
    ['p2', { id: 'p2', status: 'active', workspaceId: 'ws_a' }],
    ['p3', { id: 'p3', status: 'active', workspaceId: 'ws_a' }],
    ['px', { id: 'px', status: 'active', workspaceId: 'ws_b' }],
  ]);
  const principals = new Map<string, PrincipalKind>([
    ['u_h', 'human'],
    ['u_h2', 'human'],
    ['u_sub', 'human'],
    ['agent_1', 'agent'],
    ['agent_2', 'agent'],
    ['expert_1', 'agent'],
  ]);
  // Readable attested targets (by id, or 'target:<type>:<id>'): project p1.
  const readable = new Set<string>(['p1']);
  const audit: AuditEntry[] = [];
  const decisions = new DecisionRecorder();
  const policyDocs = new Map<string, { content: string; version: number; actorId: string }>();
  const policy = options.policy === undefined ? POLICY : options.policy;
  if (policy !== null) policyDocs.set('ws_a', { content: JSON.stringify(policy), version: 1, actorId: 'u_admin' });
  const reindexed: LearningTestWorld['reindexed'] = [];
  const attestations: unknown[] = [];

  const world: LearningTestWorld = {
    executions,
    events,
    evidence,
    experts,
    projects,
    principals,
    readable,
    audit,
    decisions,
    policyDocs,
    reindexed,
    attestations,
    indexOutcome: 'indexed',
    attestationFails: false,
    ports: {
      ...refusingPorts(),
      executions: {
        async describe(workspaceId, executionId) {
          const f = executions.get(executionId);
          return f !== undefined && f.workspaceId === workspaceId ? f : null;
        },
        async appendLearningEvent(input) {
          if (events.some((e) => e.workspaceId === input.workspaceId && e.idempotencyKey === input.idempotencyKey)) return;
          events.push({ ...input, payload: { ...input.payload } });
        },
      },
      secrets: {
        async screen(fields) {
          for (const [field, value] of Object.entries(fields)) {
            const rule = secretRuleMatching(value);
            if (rule !== null) return { rule, field };
          }
          return null;
        },
      },
      principals: {
        async kindOf(_ws, id) {
          return principals.get(id) ?? null;
        },
      },
      readerAccess: {
        async canRead(_reader, target) {
          return readable.has(target.id) || readable.has(`target:${target.type}:${target.id}`);
        },
      },
      policy: {
        async current(workspaceId) {
          const doc = policyDocs.get(workspaceId);
          return doc === undefined ? null : { documentId: `pol_${workspaceId}`, version: doc.version, content: doc.content, actorId: doc.actorId, at: new Date().toISOString() };
        },
      },
      audit: {
        async record(entry) {
          audit.push(entry);
        },
      },
      decisions,
      evidence: {
        async resolve(workspaceId, ids) {
          const out = new Map<string, ResolvedEvidence>();
          if (workspaceId !== 'ws_a') return out;
          for (const id of ids) {
            const e = evidence.get(id);
            if (e !== undefined) out.set(id, e);
          }
          return out;
        },
      },
      attestations: {
        async contribute(input) {
          if (world.attestationFails) throw new Error('evidence store unavailable');
          attestations.push(input);
          return { evidenceId: `att_${attestations.length}` };
        },
      },
      index: {
        async reindex(input) {
          reindexed.push(input);
          if (world.indexOutcome === 'unbound') {
            const { GovernanceSeamUnboundError } = await import('../../src/core/errors.js');
            throw new GovernanceSeamUnboundError('EmbeddingPort is not bound (FR-CTX-013)');
          }
          if (world.indexOutcome === 'bad-request') {
            const { ValidationFailedError } = await import('../../src/core/errors.js');
            throw new ValidationFailedError('knowledge-entry has no source class (DEF-038-007)');
          }
          return { outcome: world.indexOutcome };
        },
      },
      experts: {
        async forExecution(_ws, executionId) {
          return experts.get(executionId) ?? null;
        },
      },
      projects: {
        async find(workspaceId, projectId) {
          const p = projects.get(projectId);
          return p !== undefined && p.workspaceId === workspaceId ? { id: p.id, status: p.status } : null;
        },
      },
    },
  };
  return world;
}

/** A complete, valid submission body (contract §2), overridable field by field. */
export function submission(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    executionId: 'exe_1',
    kind: 'new',
    statement: 'Integration tests need the local database started first.',
    category: 'architecture',
    subject: 'Integration test prerequisites',
    evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST } }],
    confidence: { level: 'medium', basis: 'Observed three failing runs without it.' },
    claimedScope: { kind: 'project', projectIds: ['p1'] },
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
    correlationId: 'corr_1',
    ...over,
  };
}
