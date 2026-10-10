/**
 * `T1906` (EPIC-047) — the ports, and what each absence does.
 *
 * `R-047-13`. Each port with no owner **refuses** with a `503` naming itself and
 * the Epic that owes it. A permissive default would make an Expert look governed
 * while nothing governed it — an approval nobody gave, an Evidence Contract
 * nobody checked.
 *
 * Since Phase 9 (2026-10-10) `ContractApprovals` (`EPIC-031`),
 * `EvidenceContracts` (`EPIC-032`) and `ContextAssembler` (`EPIC-038`) are bound
 * to adapters under `adapters/`, and `ActorAccess` (`EPIC-024`) was bound from
 * the start. Two still refuse: `ExpertGateways`, which nothing in the programme
 * provides yet (`R-047-2`), and `ExpertExecutions`, for want of an execution
 * identity for a platform-dispatched run (`DEF-047-001`).
 */
import type { AgentContext, AgentDescriptor, AgentInvocation } from '@pmi/agent-contract';
import { GovernanceSeamUnboundError } from '../../core/errors.js';
import type { ContextPolicy, EvidenceContractRef, RiskBand } from './expert.types.js';

export const EXPERTS_STORE = Symbol('EXPERTS_STORE');
export const ACTOR_ACCESS = Symbol('ACTOR_ACCESS');
/** The ports whose owners are not on `main`, held together — see `ExpertPorts`. */
export const EXPERT_PORTS = Symbol('EXPERT_PORTS');

/**
 * What a run reports back. `toolCalls` **absent** means the provider cannot
 * report them — recorded as *unobserved*, never as *none* (`FR-EXP-024`).
 * Consumption likewise: absent is *not reported*, never zero (`FR-EXP-045`).
 */
export interface RunReport {
  readonly status: 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  /** The kinds of output the run produced, checked against the contract (`FR-EXP-021`). */
  readonly outputs: readonly string[];
  readonly toolCalls?: readonly string[];
  readonly consumption?: { readonly tokens?: number; readonly cost?: number; readonly resource?: number };
}

/**
 * One way to run a model: its descriptor, and a run that owns provisioning its
 * own environment. `DEF-047-001` — nothing provisions an `EPIC-028`
 * `ExecutionSession` for an Expert yet, so the binding that supplies a runner
 * supplies that too, and dispatch never touches it.
 */
export interface ExpertRunner {
  readonly descriptor: AgentDescriptor;
  run(invocation: AgentInvocation, ctx: AgentContext): Promise<RunReport>;
}

/** `R-047-2` — runners able to run a named model. */
export interface ExpertGateways {
  gatewaysFor(model: string): Promise<readonly ExpertRunner[]>;
}

export type Resolution = 'pending' | 'approved' | 'refused';

/** `R-047-5` — `EPIC-031`'s decision path. Read on demand; there is no callback. */
export interface ContractApprovals {
  submit(input: {
    readonly workspaceId: string;
    readonly actionType: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly objectVersion: number;
    readonly riskClass: RiskBand;
    readonly actorId: string;
  }): Promise<{ readonly decisionId: string }>;
  resolutionOf(workspaceId: string, decisionId: string): Promise<Resolution>;
}

/** `R-047-11` — does `EPIC-032` know this Evidence Contract? A fault propagates; it never reads as absent. */
export interface EvidenceContracts {
  exists(ref: EvidenceContractRef): Promise<boolean>;
}

/** `R-047-10` — `EPIC-038`'s assembly, given the Expert's context policy. */
export interface ContextAssembler {
  assemble(input: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly objective: string;
    readonly actorId: string;
    readonly actorRole: string;
    readonly policy: ContextPolicy;
  }): Promise<{ readonly packageId: string }>;
  bind?(workspaceId: string, packageId: string, executionId: string): Promise<void>;
}

/** `FR-EXP-056` — `EPIC-046`'s task store, asked only whether a task exists. */
export interface TaskLookup {
  exists(workspaceId: string, taskId: string): Promise<boolean>;
}
export const TASK_LOOKUP = Symbol('TASK_LOOKUP');

/** `R-047-9` — `EPIC-024`, asked about the requesting actor. */
export interface ActorAccess {
  mayRead(workspaceId: string, userId: string, artifact: { artifactType: string; artifactId: string }): Promise<boolean>;
  mayEdit(workspaceId: string, userId: string, artifact: { artifactType: string; artifactId: string }): Promise<boolean>;
}

/** `R-047-3`, `R-047-4` — `EPIC-037`. Every Expert run is an execution; its governance facts are events on it. */
export interface ExpertExecutions {
  register(input: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly command: string;
    readonly actorId: string;
    readonly expertKey: string;
    readonly contractVersion: number;
    readonly model: string;
    readonly objective: string;
  }): Promise<{ readonly executionId: string }>;
  record(
    workspaceId: string,
    executionId: string,
    kind: string,
    detail: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  complete(
    workspaceId: string,
    executionId: string,
    outcome: 'completed' | 'partially-completed' | 'failed' | 'cancelled' | 'timed-out',
    comment: string,
  ): Promise<void>;
  /** `FR-EXP-063` — an unattended run's completion is proposed, never applied by the Expert. */
  proposeCompletion(workspaceId: string, executionId: string, comment: string): Promise<void>;
  /** The Expert governance events recorded on an execution, oldest first. */
  eventsOf(workspaceId: string, executionId: string): Promise<readonly { kind: string; detail: Readonly<Record<string, unknown>> }[]>;
}

function unbound(port: string, owner: string, consequence: string): GovernanceSeamUnboundError {
  return new GovernanceSeamUnboundError(`${port} is not bound — ${owner} supplies it. ${consequence}`);
}

export function refusingGateways(): ExpertGateways {
  return {
    async gatewaysFor(): Promise<never> {
      throw unbound(
        'ExpertGateways',
        'nothing in the programme selects an agent gateway by model yet (EPIC-047 R-047-2; the seam is EPIC-028)',
        'No Expert run can be dispatched, because running one on an unchosen gateway is running it on a model nobody declared (FR-EXP-017)',
      );
    },
  };
}

export function refusingContractApprovals(): ContractApprovals {
  const refuse = (): never => {
    throw unbound(
      'ContractApprovals',
      'EPIC-031 (the decision and policy engine)',
      'A contract version cannot be approved here, so it stays a draft and nothing runs under it (FR-EXP-005)',
    );
  };
  return {
    async submit() {
      return refuse();
    },
    async resolutionOf() {
      return refuse();
    },
  };
}

export function refusingEvidenceContracts(): EvidenceContracts {
  return {
    async exists(): Promise<never> {
      throw unbound(
        'EvidenceContracts',
        'EPIC-032 (the evidence store and Evidence Contracts)',
        'A contract naming an Evidence Contract cannot be checked, and an unchecked reference is not accepted (FR-EXP-022)',
      );
    },
  };
}

export function refusingContextAssembler(): ContextAssembler {
  return {
    async assemble(): Promise<never> {
      throw unbound(
        'ContextAssembler',
        'EPIC-038 (engineering context)',
        "An Expert run is not dispatched without the context its contract's policy calls for (FR-EXP-015)",
      );
    },
  };
}

/**
 * The ports bound refusing until their owners land, held in one object that
 * the services read **at call time**.
 *
 * Why one mutable holder rather than one provider each: Phase 9 rebinds these
 * as `EPIC-031`, `EPIC-032` and `EPIC-038` merge, and route tests (analysis
 * finding I1) must exercise success paths through the real composed
 * application before then. They do so by replacing a member of this object in
 * the test itself, visibly, after asserting the default refuses. Production
 * code never assigns to it after composition.
 */
export interface ExpertPorts {
  gateways: ExpertGateways;
  approvals: ContractApprovals;
  evidence: EvidenceContracts;
  context: ContextAssembler;
  executions: ExpertExecutions;
}

export function refusingExecutions(): ExpertExecutions {
  const refuse = (): never => {
    throw unbound(
      'ExpertExecutions',
      'EPIC-037 (the governed execution registry), through an Expert identity adapter nothing provides yet (DEF-047-001)',
      'An Expert run is never started unregistered (Constitution XII, FR-EXP-060)',
    );
  };
  return {
    async register() {
      return refuse();
    },
    async record() {
      return refuse();
    },
    async complete() {
      return refuse();
    },
    async proposeCompletion() {
      return refuse();
    },
    async eventsOf() {
      return refuse();
    },
  };
}

export function refusingPorts(): ExpertPorts {
  return {
    gateways: refusingGateways(),
    approvals: refusingContractApprovals(),
    evidence: refusingEvidenceContracts(),
    context: refusingContextAssembler(),
    executions: refusingExecutions(),
  };
}
