/**
 * `T2335` (EPIC-048, `R-048-20`) — the ports whose owners are on `main`, bound
 * to their real services.
 *
 * `Executions` (`EPIC-037`), `Principals` (`EPIC-028` + the users directory),
 * `Audit` (`EPIC-004`), `LearningPolicySource` (`EPIC-019`, in
 * `learning-policy.ts`), `SecretScreen` (`EPIC-037`, in `secret.screen.ts`) and
 * `Projects` (`EPIC-006`). Each is the owner's **public** service narrowed to the
 * question this Epic asks; no other Epic's table is read here.
 *
 * The four unmerged owners (`EPIC-031`, `EPIC-032`, `EPIC-038`, `EPIC-047`) stay
 * refusing until their adapters (`adapters/`, Phase 9).
 */
import { isTerminalLifecycleEvent, type ExecutionEventType } from '@pmi/execution-registry-contract';
import { LEARNING_EVENT_TYPE } from '@pmi/learning-contract';
import type { AuditService } from '../audit/audit.service.js';
import type { ExecutionEventService } from '../executions/execution-event.service.js';
import type { ExecutionRegistrationService } from '../executions/execution-registration.service.js';
import type { ExecutionRegistryFacade } from '../executions/execution-registry.facade.js';
import type { PrincipalRegistryService } from '../agents/principal-registry.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { NotFoundError } from '../../core/errors.js';
import type { AuditPort, ExecutionsPort, PrincipalsPort, ProjectsPort } from './learning.tokens.js';

/** `R-048-17` — the governance events that mark an execution invalid (spec Edge Case). */
export const INVALIDATING_EVENTS: readonly ExecutionEventType[] = Object.freeze([
  'validation-failed',
  'transition-refused',
  'transition-inconsistent',
  'execution-reconciliation-conflicted',
]);

export function executionsPort(deps: {
  facade: Pick<ExecutionRegistryFacade, 'snapshot'>;
  registration: Pick<ExecutionRegistrationService, 'projectIdOf'>;
  events: Pick<ExecutionEventService, 'history' | 'append'>;
}): ExecutionsPort {
  return {
    async describe(workspaceId, executionId) {
      const snapshot = await deps.facade.snapshot(workspaceId, executionId);
      if (snapshot === null || snapshot.workspaceId !== workspaceId) return null;
      const history = await deps.events.history(workspaceId, executionId);
      const terminal = history.find((e) => isTerminalLifecycleEvent(e.type));
      return {
        executionId,
        workspaceId,
        projectId: await deps.registration.projectIdOf(workspaceId, executionId),
        governanceState: snapshot.governanceState,
        terminal: terminal === undefined ? null : { type: terminal.type, at: terminal.recordedAt },
        invalidatedBy: [...new Set(history.filter((e) => INVALIDATING_EVENTS.includes(e.type)).map((e) => e.type))],
      };
    },
    async appendLearningEvent(input) {
      await deps.events.append({
        workspaceId: input.workspaceId,
        executionId: input.executionId,
        type: LEARNING_EVENT_TYPE,
        payload: { ...input.payload },
        occurredAt: new Date().toISOString(),
        emittedBy: input.emittedBy,
        idempotencyKey: input.idempotencyKey,
      });
    },
  };
}

/** The users directory, narrowed to one question: is this id a person of this workspace? */
export interface UserLookup {
  isUser(workspaceId: string, userId: string): Promise<boolean>;
}

/**
 * `FR-LRN-027` — `human` only when the id resolves to a `User` **and** to no
 * `NonHumanPrincipal`. An id that is both is not a human: the safe reading.
 */
export function principalsPort(registry: Pick<PrincipalRegistryService, 'find'>, users: UserLookup): PrincipalsPort {
  return {
    async kindOf(workspaceId, id) {
      const principal = await registry.find(workspaceId, id);
      if (principal !== null) return principal.kind;
      return (await users.isUser(workspaceId, id)) ? 'human' : null;
    },
  };
}

export function auditPort(audit: Pick<AuditService, 'record'>): AuditPort {
  return {
    async record(entry, tx) {
      await audit.record(entry as Parameters<AuditService['record']>[0], tx as Parameters<AuditService['record']>[1]);
    },
  };
}

export function projectsPort(projects: Pick<ProjectsService, 'get'>): ProjectsPort {
  return {
    async find(workspaceId, projectId) {
      try {
        const p = await projects.get(workspaceId, projectId);
        return { id: p.id, status: p.status };
      } catch (err) {
        if (err instanceof NotFoundError) return null;
        throw err;
      }
    },
  };
}
