/**
 * `T2562` (EPIC-047) — `ExpertExecutions` over `EPIC-037`'s registry, with an
 * identity for a run the platform itself dispatches. `DEF-047-001`,
 * `FR-EXP-060`, `R-047-3`.
 *
 * `EPIC-037` registers nothing without an authenticated principal, its identity
 * snapshot, a connector registration, a sponsor and an `execution.register`
 * delegation. A connector credential (`EPIC-043`) carries those; a run this
 * platform dispatches had none. This adapter mints them, in this order, and
 * registers before anything runs:
 *
 * 1. **The command must be governed** and the run must name a project — the
 *    registry refuses otherwise, and refusing here says why (`R-047-3`).
 * 2. **The sponsor must be able to edit the project** (`EPIC-024`). The
 *    delegation service grants whatever it is asked; an agent must not receive
 *    authority its sponsor does not hold (`BR-0003`).
 * 3. **One agent principal per (Expert, sponsor)**, minted on the workspace's
 *    `managed-sandbox` connector registration and reused after. `EPIC-028`
 *    freezes a principal's sponsor, so a second sponsor gets their own.
 * 4. **A fresh identity snapshot** per registration — the identity as it is
 *    when this run begins.
 * 5. **A delegation for `execution.register` and `execution.report`** on the
 *    project, reused while valid and granted by the sponsor otherwise. A
 *    delegation store that cannot answer is a fault, never "none, so grant".
 *
 * The refs are stored per execution, and every later call — from this process
 * or another — acts under the identity the execution registered with.
 *
 * ## Proposing a completion
 *
 * `EPIC-037`'s `proposeTransition` transitions a specification, adjudicated by
 * `EPIC-030`. An Expert run has no specification target, so an unattended run's
 * completion is recorded as a `completion-proposed` governance event and the
 * execution is left open for a person to close (`FR-EXP-063`): the Expert never
 * completes its own unattended work.
 */
import { randomUUID } from 'node:crypto';
import {
  CONTRACT_VERSION,
  GOVERNED_COMMANDS,
  isExpertGovernanceKind,
  type AppendEventRequest,
  type CompleteExecutionRequest,
  type ExecutionIdentityRefs,
  type GovernedCommand,
  type RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import { ForbiddenError, ValidationFailedError } from '../../../core/errors.js';
import { DelegationRefused } from '../../access/principal-delegation.service.js';
import { translateRefusal } from '../../executions/executions.controller.js';
import type { ExpertExecutions } from '../experts.tokens.js';
import type { ExecutionIdentity, ExpertIdentityStore } from './identity.store.js';

/** The surface an Expert run is registered on: the platform's own managed sandbox. */
export const EXPERT_SURFACE = 'managed-sandbox' as const;
/** What a sponsor delegates to an Expert's principal on the project. */
export const EXPERT_DELEGATED_ACTIONS = Object.freeze(['execution.register', 'execution.report'] as const);

type Artifact = { readonly artifactType: string; readonly artifactId: string };

/** The narrow surfaces this adapter needs from `EPIC-024`, `EPIC-028` and `EPIC-037`. */
export interface ExpertIdentityPorts {
  access: { mayEdit(workspaceId: string, userId: string, artifact: Artifact): Promise<boolean> };
  principals: {
    ensureConnector(input: {
      workspaceId: string;
      kind: typeof EXPERT_SURFACE;
      registeredByUserId: string;
    }): Promise<{ readonly connectorId: string }>;
    register(input: {
      workspaceId: string;
      kind: 'agent';
      descriptorRef: string;
      sponsorUserId: string;
      registeredByUserId: string;
      connectorRegistrationId?: string;
      correlationId: string;
      causationId: string;
    }): Promise<{ readonly principalId: string }>;
    find(
      workspaceId: string,
      principalId: string,
    ): Promise<{
      readonly principalId: string;
      readonly identityVersion: number;
      readonly sponsorUserId: string;
      readonly connectorRegistrationId?: string | null;
    } | null>;
  };
  snapshots: { capture(workspaceId: string, principalId: string): Promise<{ readonly snapshotId: string }> };
  delegations: {
    requireDelegated(input: {
      workspaceId: string;
      principalId: string;
      artifact: Artifact;
      action: string;
    }): Promise<{ readonly id: string; readonly identityVersion: number }>;
    delegate(input: {
      workspaceId: string;
      principalId: string;
      sponsorUserId: string;
      artifact: Artifact;
      actions: readonly string[];
      identityVersion: number;
      correlationId: string;
    }): Promise<{ readonly id: string; readonly identityVersion: number }>;
  };
  registry: {
    register(request: RegisterExecutionRequest): Promise<{ readonly executionId: string }>;
    appendEvent(request: AppendEventRequest): Promise<unknown>;
    complete(request: CompleteExecutionRequest): Promise<unknown>;
  };
  timeline: {
    projectIdOf(workspaceId: string, executionId: string): Promise<string | null>;
    events(
      workspaceId: string,
      projectId: string,
      executionId: string,
    ): Promise<readonly { readonly type: string; readonly payload: Readonly<Record<string, unknown>> }[]>;
  };
}

/** A registry refusal in the platform's status vocabulary; anything else unchanged. */
async function governed<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    throw translateRefusal(error);
  }
}

export function expertExecutions(ports: ExpertIdentityPorts, store: ExpertIdentityStore): ExpertExecutions {
  const identities = new Map<string, ExecutionIdentity>();

  async function identityOf(workspaceId: string, executionId: string): Promise<ExecutionIdentity> {
    const held = identities.get(executionId);
    if (held !== undefined && held.workspaceId === workspaceId) return held;
    const stored = await store.executionIdentity(workspaceId, executionId);
    if (stored === null) {
      throw new ForbiddenError(
        `execution ${executionId} was not registered for an Expert in workspace ${workspaceId}, so there is no identity to act on it under (DEF-047-001)`,
      );
    }
    identities.set(executionId, stored);
    return stored;
  }

  async function principalFor(workspaceId: string, expertKey: string, sponsorUserId: string, correlationId: string): Promise<string> {
    const known = await store.principalFor(workspaceId, expertKey, sponsorUserId);
    if (known !== null) return known;
    const { connectorId } = await ports.principals.ensureConnector({
      workspaceId,
      kind: EXPERT_SURFACE,
      registeredByUserId: sponsorUserId,
    });
    const { principalId } = await ports.principals.register({
      workspaceId,
      kind: 'agent',
      descriptorRef: `engineering-expert:${expertKey}`,
      sponsorUserId,
      registeredByUserId: sponsorUserId,
      connectorRegistrationId: connectorId,
      correlationId,
      causationId: correlationId,
    });
    return store.recordPrincipal(workspaceId, expertKey, sponsorUserId, principalId);
  }

  async function delegationFor(
    workspaceId: string,
    principalId: string,
    identityVersion: number,
    sponsorUserId: string,
    project: Artifact,
    correlationId: string,
  ): Promise<{ readonly id: string; readonly identityVersion: number }> {
    try {
      return await ports.delegations.requireDelegated({ workspaceId, principalId, artifact: project, action: 'execution.register' });
    } catch (error) {
      // Only "there is no valid delegation" leads to granting one. A store that
      // cannot answer propagates: reading it as "none" would grant blind.
      if (!(error instanceof DelegationRefused)) throw error;
    }
    return ports.delegations.delegate({
      workspaceId,
      principalId,
      sponsorUserId,
      artifact: project,
      actions: EXPERT_DELEGATED_ACTIONS,
      identityVersion,
      correlationId,
    });
  }

  async function append(workspaceId: string, executionId: string, kind: string, detail: Readonly<Record<string, unknown>>): Promise<void> {
    if (!isExpertGovernanceKind(kind)) {
      throw new ValidationFailedError(`'${kind}' is not an Expert governance kind EPIC-037 records (R-047-4)`);
    }
    const { refs } = await identityOf(workspaceId, executionId);
    await governed(
      ports.registry.appendEvent({
        executionId,
        workspaceId,
        type: 'expert-governance-recorded',
        // The kind last, so a detail can never relabel the fact it describes.
        payload: { ...detail, kind },
        occurredAt: new Date().toISOString(),
        identity: refs,
        idempotencyKey: randomUUID(),
      }),
    );
  }

  return {
    async register(input) {
      const command = input.command.trim();
      if (!(GOVERNED_COMMANDS as readonly string[]).includes(command)) {
        throw new ValidationFailedError(
          `'${input.command}' is not a governed command; an Expert run names the governed command it executes (R-047-3)`,
        );
      }
      const projectId = input.projectId.trim();
      if (projectId === '') {
        throw new ValidationFailedError('an Expert run names the project it runs on; a delegation needs something to be on (DEF-047-001)');
      }
      const project: Artifact = { artifactType: 'project', artifactId: projectId };
      if (!(await ports.access.mayEdit(input.workspaceId, input.actorId, project))) {
        throw new ForbiddenError(
          `user ${input.actorId} may not edit project ${projectId}, so may not sponsor an Expert run on it — ` +
            'an agent is never handed authority its sponsor does not hold (DEF-047-001, BR-0003)',
        );
      }

      const correlationId = randomUUID();
      const principalId = await principalFor(input.workspaceId, input.expertKey, input.actorId, correlationId);
      const principal = await ports.principals.find(input.workspaceId, principalId);
      if (principal === null) {
        throw new ForbiddenError(`the agent principal ${principalId} for Expert '${input.expertKey}' is not in workspace ${input.workspaceId}`);
      }
      const { snapshotId } = await ports.snapshots.capture(input.workspaceId, principalId);
      const delegation = await delegationFor(
        input.workspaceId,
        principalId,
        principal.identityVersion,
        input.actorId,
        project,
        correlationId,
      );

      const refs: ExecutionIdentityRefs = {
        authenticatedPrincipalId: principalId,
        agentSnapshotId: snapshotId,
        connectorRegistrationId: principal.connectorRegistrationId ?? '',
        sponsorUserId: input.actorId,
        delegationId: delegation.id,
        delegationIdentityVersion: delegation.identityVersion,
      };
      const { executionId } = await governed(
        ports.registry.register({
          workspaceId: input.workspaceId,
          projectId,
          command: command as GovernedCommand,
          argsSanitized: {
            expert: input.expertKey,
            contractVersion: input.contractVersion,
            model: input.model,
            objective: input.objective,
          },
          surface: EXPERT_SURFACE,
          identity: refs,
          input: { targetType: 'project', targetId: projectId },
          correlationId,
          idempotencyKey: randomUUID(),
          contractVersion: CONTRACT_VERSION,
        }),
      );
      const identity: ExecutionIdentity = { executionId, workspaceId: input.workspaceId, projectId, refs };
      await store.recordExecution(identity);
      identities.set(executionId, identity);
      return { executionId };
    },

    record: append,

    async complete(workspaceId, executionId, outcome, comment) {
      const { refs } = await identityOf(workspaceId, executionId);
      await governed(
        ports.registry.complete({
          executionId,
          workspaceId,
          outcome,
          identity: refs,
          idempotencyKey: randomUUID(),
          occurredAt: new Date().toISOString(),
          completionComment: comment,
          // EPIC-037: `completed` requires an output binding and nothing else may carry one.
          ...(outcome === 'completed' ? { output: {} } : {}),
        }),
      );
    },

    async proposeCompletion(workspaceId, executionId, comment) {
      await append(workspaceId, executionId, 'completion-proposed', { comment });
    },

    async eventsOf(workspaceId, executionId) {
      const projectId =
        (await store.executionIdentity(workspaceId, executionId))?.projectId ??
        (await ports.timeline.projectIdOf(workspaceId, executionId));
      if (projectId === null) return [];
      const events = await governed(ports.timeline.events(workspaceId, projectId, executionId));
      return events
        .filter((e) => e.type === 'expert-governance-recorded')
        .map((e) => {
          const { kind, ...detail } = e.payload as { kind: string } & Record<string, unknown>;
          return { kind, detail };
        });
    },
  };
}
