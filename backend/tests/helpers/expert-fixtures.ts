/**
 * Fixtures for `EPIC-047`'s tests.
 *
 * As in `context-fixtures.ts`, nothing here takes a hidden default that changes
 * what a test exercises: `contract()` returns one complete, valid contract, and
 * a test that wants a gap removes the field itself, at the call site.
 */
import type { ContractVersion, EngineeringExpert, ExpertContract } from '../../src/modules/experts/expert.types.js';
import type { AgentContext, AgentDescriptor, AgentInvocation } from '@pmi/agent-contract';
import type {
  ActorAccess,
  ContextAssembler,
  ContractApprovals,
  EvidenceContracts,
  ExpertExecutions,
  ExpertGateways,
  ExpertRunner,
  Resolution,
  RunReport,
} from '../../src/modules/experts/experts.tokens.js';

/** A complete contract with all twelve BR-0102 elements present. */
export function contract(over: Partial<ExpertContract> = {}): ExpertContract {
  return {
    rolePurpose: 'Writes and runs the tests a change needs before it may merge',
    models: { preferred: 'claude-opus-5-5', fallbacks: ['claude-sonnet-5-5'] },
    capabilities: ['test', 'analyze'],
    allowedTools: ['read-file', 'run-tests'],
    contextPolicy: { budgetTokens: 12000, budgetCost: 4, includeLiveState: false },
    workspaceRequirements: { executionType: 'headless' },
    permissions: [{ artifactType: 'specification', action: 'read' }],
    prohibitedActions: ['push', 'delete-branch'],
    riskClass: 'medium',
    budget: {
      time: { value: 600_000, onUnenforceable: 'proceed' },
      // `proceed`, so the default contract is dispatchable on a runner that
      // cannot stop on tokens — which is every runner today (R-047-7). Tests of
      // the clarified `refuse` default set it themselves.
      tokens: { value: 200_000, onUnenforceable: 'proceed' },
    },
    memoryPolicy: 'none',
    expectedOutputs: [{ kind: 'test-report', required: true }],
    evidenceContract: { workClass: 'implementation', contractVersion: 1 },
    delegatesTo: [],
    ...over,
  };
}

/** A contract with the named top-level fields removed — the way a client would omit them. */
export function without(c: ExpertContract, ...fields: (keyof ExpertContract)[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...c };
  for (const f of fields) delete copy[f];
  return copy;
}

export function expert(over: Partial<EngineeringExpert> = {}): EngineeringExpert {
  return {
    id: 'ex_test',
    workspaceId: 'ws_1',
    key: 'test-engineer',
    name: 'Test Engineer',
    status: 'active',
    registeredBy: 'u_1',
    registeredAt: '2026-10-09T09:00:00.000Z',
    retiredBy: null,
    retiredAt: null,
    ...over,
  };
}

export function version(over: Partial<ContractVersion> = {}): ContractVersion {
  return {
    id: 'cv_1',
    workspaceId: 'ws_1',
    expertId: 'ex_test',
    version: 1,
    contract: contract(),
    decisionId: null,
    createdBy: 'u_1',
    createdAt: '2026-10-09T09:00:00.000Z',
    ...over,
  };
}

// ------------------------------------------------------------- port doubles
// In-test bindings that record every call (`R-047-13`, analysis finding I1).
// The module's own defaults stay refusing; these exist only in tests, set up
// visibly at the call site.

/** Grants keyed `${userId}:${artifactType}:${artifactId}`. */
export function accessFrom(grants: Record<string, 'read' | 'edit'>): ActorAccess {
  return {
    async mayRead(_ws, userId, a) {
      return grants[`${userId}:${a.artifactType}:${a.artifactId}`] !== undefined;
    },
    async mayEdit(_ws, userId, a) {
      return grants[`${userId}:${a.artifactType}:${a.artifactId}`] === 'edit';
    },
  };
}

/** u_1 may author and read the registry of ws_1. */
export const authorOfWs1 = (): ActorAccess => accessFrom({ 'u_1:expert-registry:ws_1': 'edit' });

export interface RecordingApprovals extends ContractApprovals {
  readonly submitted: Parameters<ContractApprovals['submit']>[0][];
  resolve(decisionId: string, resolution: Resolution): void;
}

export function recordingApprovals(): RecordingApprovals {
  const resolutions = new Map<string, Resolution>();
  const submitted: Parameters<ContractApprovals['submit']>[0][] = [];
  return {
    submitted,
    resolve(decisionId, resolution) {
      resolutions.set(decisionId, resolution);
    },
    async submit(input) {
      submitted.push(input);
      const decisionId = `d_${submitted.length}`;
      resolutions.set(decisionId, 'pending');
      return { decisionId };
    },
    async resolutionOf(_ws, decisionId) {
      return resolutions.get(decisionId) ?? 'pending';
    },
  };
}

/** An Evidence Contract catalogue knowing exactly the given `workClass@version` keys. */
export function evidenceKnowing(...keys: string[]): EvidenceContracts {
  return {
    async exists(ref) {
      return keys.includes(`${ref.workClass}@${ref.contractVersion}`);
    },
  };
}

// ------------------------------------------------------------- dispatch world


export function descriptor(over: Partial<AgentDescriptor> = {}): AgentDescriptor {
  return {
    name: 'test-gateway',
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    executionType: 'headless',
    capabilities: ['execute', 'analyze', 'generate', 'review', 'test'],
    contextLimitTokens: 200_000,
    toolCapabilities: [],
    supportsMcp: true,
    repositoryCapabilities: ['read', 'commit'],
    securityClassification: 'external',
    supportsUnattended: true,
    ...over,
  };
}

export interface RecordingRunner extends ExpertRunner {
  readonly runs: { invocation: AgentInvocation; ctx: AgentContext }[];
}

/** A runner that answers with `report` (or computes it) and records each run. */
export function runner(
  over: Partial<AgentDescriptor> = {},
  report: RunReport | ((ctx: AgentContext) => Promise<RunReport>) = { status: 'succeeded', outputs: ['test-report'] },
): RecordingRunner {
  const runs: { invocation: AgentInvocation; ctx: AgentContext }[] = [];
  return {
    runs,
    descriptor: descriptor(over),
    async run(invocation, ctx) {
      runs.push({ invocation, ctx });
      return typeof report === 'function' ? report(ctx) : report;
    },
  };
}

/** Gateways by model name. A model absent from the table has no runner. */
export function gatewaysFor(table: Record<string, ExpertRunner[]>): ExpertGateways {
  return {
    async gatewaysFor(model) {
      return table[model] ?? [];
    },
  };
}

export interface RecordingExecutions extends ExpertExecutions {
  readonly registered: Parameters<ExpertExecutions['register']>[0][];
  readonly events: { executionId: string; kind: string; detail: Readonly<Record<string, unknown>> }[];
  readonly completed: { executionId: string; outcome: string; comment: string }[];
  readonly proposed: { executionId: string; comment: string }[];
  kindsFor(executionId: string): string[];
}

export function recordingExecutions(): RecordingExecutions {
  const registered: Parameters<ExpertExecutions['register']>[0][] = [];
  const events: RecordingExecutions['events'] = [];
  const completed: RecordingExecutions['completed'] = [];
  const proposed: RecordingExecutions['proposed'] = [];
  return {
    registered,
    events,
    completed,
    proposed,
    kindsFor: (id) => events.filter((e) => e.executionId === id).map((e) => e.kind),
    async register(input) {
      registered.push(input);
      return { executionId: `exe_${registered.length}` };
    },
    async record(_ws, executionId, kind, detail) {
      events.push({ executionId, kind, detail });
    },
    async complete(_ws, executionId, outcome, comment) {
      completed.push({ executionId, outcome, comment });
    },
    async proposeCompletion(_ws, executionId, comment) {
      proposed.push({ executionId, comment });
    },
    async eventsOf(_ws, executionId) {
      return events.filter((e) => e.executionId === executionId).map(({ kind, detail }) => ({ kind, detail }));
    },
  };
}

export interface RecordingContext extends ContextAssembler {
  readonly assembled: Parameters<ContextAssembler['assemble']>[0][];
  readonly bound: { packageId: string; executionId: string }[];
}

export function recordingContext(): RecordingContext {
  const assembled: Parameters<ContextAssembler['assemble']>[0][] = [];
  const bound: { packageId: string; executionId: string }[] = [];
  return {
    assembled,
    bound,
    async assemble(input) {
      assembled.push(input);
      return { packageId: `pkg_${assembled.length}` };
    },
    async bind(_ws, packageId, executionId) {
      bound.push({ packageId, executionId });
    },
  };
}
