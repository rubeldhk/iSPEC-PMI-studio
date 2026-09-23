/**
 * `T1488` (EPIC-042, plan §Structure Decision) — governance records get their
 * own module: a human owner surface (the Constraints screen) and a connector
 * read surface over three records with their own lifecycle. Stores come from
 * `GovernanceStoresModule` so the connector's health route can classify a
 * digest without importing this module (`R-042-5`).
 */
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { AccessGrantService } from '../access/access-grant.service.js';
import { AgentsModule } from '../agents/agents.module.js';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { ProjectContextService } from '../connector/project-context.service.js';
import { ExecutionTimelineService } from '../executions/execution-timeline.service.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ProvisioningService } from '../projects/provisioning.service.js';
import { resolveSteering } from '../steering/steering-resolver.js';
import { SteeringModule } from '../steering/steering.module.js';
import { SteeringService } from '../steering/steering.service.js';
import { ConstitutionRenderService, type ResolvedSteeringForRender } from './constitution-render.service.js';
import type { ConstitutionRenderStore } from './constitution-render.store.js';
import { DecompositionPlanService } from './decomposition-plan.service.js';
import { DecompositionPolicyService } from './decomposition-policy.service.js';
import type { DecompositionPolicyStore } from './decomposition-policy.store.js';
import { GovernanceConnectorController } from './governance-connector.controller.js';
import { GovernanceStoresModule } from './governance-stores.module.js';
import { GovernanceController } from './governance.controller.js';
import { CONSTITUTION_RENDER_STORE, DECOMPOSITION_POLICY_STORE, PROJECT_CONSTRAINT_STORE } from './governance.tokens.js';
import { OwnerGate } from './owner-gate.js';
import { ProjectConstraintService } from './project-constraint.service.js';
import type { ProjectConstraintStore } from './project-constraint.store.js';

/**
 * `EPIC-019`'s steering resolved for one project (`FR-EXT-023`): the workspace's
 * documents whose scope applies — organization (the workspace's own), the
 * workspace itself, the project — resolved narrowest-wins per subject and
 * returned broadest first. Product scope has no lineage here and is left out.
 */
export async function resolvedSteeringForProject(steering: Pick<SteeringService, 'list'>, workspaceId: string, projectId: string): Promise<ResolvedSteeringForRender[]> {
  const documents = await steering.list(workspaceId);
  const applicable = documents.filter((d) => {
    if (d.scope.scopeType === 'organization') return true;
    if (d.scope.scopeType === 'workspace') return d.scope.scopeRef === workspaceId;
    if (d.scope.scopeType === 'project') return d.scope.scopeRef === projectId;
    return false;
  });
  const resolution = resolveSteering(applicable.map((d) => ({ id: d.id, subject: d.subject, scopeType: d.scope.scopeType, content: d.content, version: d.version, status: d.status })));
  return resolution.resolved.map((r) => {
    const source = applicable.find((d) => d.subject === r.subject && d.scope.scopeType === r.scopeType && d.version === r.version);
    return { id: source?.id ?? `${r.subject}@${r.scopeType}`, subject: r.subject, scopeType: r.scopeType, content: r.content, version: r.version };
  });
}

@Module({
  // AgentsModule: `@UseGuards(ConnectorAuthGuard)` constructs the guard in this module's context, as ExecutionsModule does.
  imports: [GovernanceStoresModule, ProjectsModule, AccessModule, AgentsModule, AuditModule, SteeringModule, ConnectorModule, ExecutionsModule],
  controllers: [GovernanceController, GovernanceConnectorController],
  providers: [
    {
      provide: ProjectConstraintService,
      inject: [PROJECT_CONSTRAINT_STORE, AuditService],
      useFactory: (store: ProjectConstraintStore, audit: AuditService): ProjectConstraintService => new ProjectConstraintService({ store, audit: { record: (row) => audit.record(row as never) } }),
    },
    {
      provide: DecompositionPolicyService,
      inject: [DECOMPOSITION_POLICY_STORE, AuditService],
      useFactory: (store: DecompositionPolicyStore, audit: AuditService): DecompositionPolicyService => new DecompositionPolicyService({ store, audit: { record: (row) => audit.record(row as never) } }),
    },
    {
      provide: ConstitutionRenderService,
      inject: [CONSTITUTION_RENDER_STORE, ProjectConstraintService, DecompositionPolicyService, ProjectsService, SteeringService, AuditService],
      useFactory: (
        store: ConstitutionRenderStore,
        constraints: ProjectConstraintService,
        policy: DecompositionPolicyService,
        projects: ProjectsService,
        steering: SteeringService,
        audit: AuditService,
      ): ConstitutionRenderService =>
        new ConstitutionRenderService({
          store,
          constraints,
          policy,
          projects: { get: (workspaceId, projectId) => projects.get(workspaceId, projectId) },
          steering: { resolvedForProject: (workspaceId, projectId) => resolvedSteeringForProject(steering, workspaceId, projectId) },
          audit: { record: (row) => audit.record(row as never) },
        }),
    },
    {
      provide: DecompositionPlanService,
      inject: [ProjectContextService, DecompositionPolicyService, ExecutionTimelineService, AuditService],
      useFactory: (context: ProjectContextService, policy: DecompositionPolicyService, timeline: ExecutionTimelineService, audit: AuditService): DecompositionPlanService =>
        new DecompositionPlanService({
          context,
          policy,
          executions: {
            hasCompletedCommand: async (workspaceId, projectId, command) => {
              const page = await timeline.list(workspaceId, projectId, { state: 'completed', command, limit: 1 });
              return page.items.length > 0;
            },
            // T1544 (edge case): a first run another session registered and has not completed.
            openCommand: async (workspaceId, projectId, command) => {
              for (const state of ['registered', 'started', 'blocked']) {
                const page = await timeline.list(workspaceId, projectId, { state, command, limit: 1 });
                const open = page.items[0];
                if (open) return open.executionId;
              }
              return null;
            },
          },
          audit: { record: (row) => audit.record(row as never) },
        }),
    },
    {
      provide: OwnerGate,
      inject: [ProjectsService, AccessGrantService, AuditService],
      useFactory: (projects: ProjectsService, grants: AccessGrantService, audit: AuditService): OwnerGate =>
        new OwnerGate({
          projects: { get: (workspaceId, id) => projects.get(workspaceId, id) },
          grants: { activeGrants: (workspaceId, artifact) => grants.activeGrants(workspaceId, artifact as never) },
          audit: { record: (row) => audit.record(row as never) },
        }),
    },
    {
      provide: 'GOVERNANCE_CONNECTOR_AUDIT',
      inject: [AuditService],
      useFactory: (audit: AuditService): { record(row: Record<string, unknown>): Promise<void> } => ({ record: (row) => audit.record(row as never) }),
    },
  ],
  exports: [ProjectConstraintService, DecompositionPolicyService, ConstitutionRenderService, DecompositionPlanService],
})
export class GovernanceModule implements OnModuleInit {
  constructor(
    @Inject(ProvisioningService) private readonly provisioning: ProvisioningService,
    @Inject(ConstitutionRenderService) private readonly renders: ConstitutionRenderService,
  ) {}

  /**
   * `T1522` (`FR-EXT-028`): provisioning writes the current render into a new
   * directory. Attached here rather than injected into `ProjectsModule`, which
   * this module already imports (`ConstitutionRenderPort`).
   */
  onModuleInit(): void {
    this.provisioning.attachConstitutionRenderer({
      render: async (workspaceId, projectId, userId) => (await this.renders.current({ workspaceId, projectId, userId })).content,
    });
  }
}
