/**
 * EPIC-044 `T1571` (`R-044-7`) — Epics: the entity, assignment, decision
 * reconciliation and the derived stage. Imports the stores-only
 * `EpicStoresModule` (shared with `ConnectorModule`), the projects and access
 * modules the owner gate needs, and the audit module. Reads the executions
 * registry's tables directly for evidence and decisions, so `ExecutionsModule`
 * is consumed, not changed.
 */
import { Module } from '@nestjs/common';
import { AccessGrantService } from '../access/access-grant.service.js';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { OwnerGate } from '../governance/owner-gate.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { prismaClient } from '../../persistence/prisma.js';
import {
  InMemoryRequirementAssignments,
  InMemorySpecificationAssignments,
  PrismaDecisionCommentReader,
  PrismaRequirementAssignments,
  PrismaSpecificationAssignments,
  type AssignmentDelegate,
  type AssignableRequirement,
  type AssignableSpecification,
  type DecisionCommentReader,
  type RawDb,
  type RequirementAssignmentPort,
  type SpecificationAssignmentPort,
} from './assignment.ports.js';
import { EpicStageService, PrismaExecutionEvidenceReader, type ExecutionEvidenceReader } from './epic-stage.service.js';
import { EpicService } from './epic.service.js';
import type { EpicStore } from './epic.store.js';
import { EpicStoresModule } from './epic-stores.module.js';
import { EpicsController } from './epics.controller.js';
import { EPIC_STORE } from './epics.tokens.js';

export const REQUIREMENT_ASSIGNMENTS = Symbol('REQUIREMENT_ASSIGNMENTS');
export const SPECIFICATION_ASSIGNMENTS = Symbol('SPECIFICATION_ASSIGNMENTS');
export const DECISION_COMMENTS = Symbol('DECISION_COMMENTS');
export const EXECUTION_EVIDENCE = Symbol('EXECUTION_EVIDENCE');
export const EPICS_OWNER_GATE = Symbol('EPICS_OWNER_GATE');

const configured = (): boolean => Boolean(process.env['DATABASE_URL']);

@Module({
  imports: [EpicStoresModule, ProjectsModule, AccessModule, AuditModule],
  controllers: [EpicsController],
  providers: [
    {
      provide: REQUIREMENT_ASSIGNMENTS,
      useFactory: (): RequirementAssignmentPort =>
        configured() ? new PrismaRequirementAssignments(prismaClient().requirement as unknown as AssignmentDelegate<AssignableRequirement>) : new InMemoryRequirementAssignments(),
    },
    {
      provide: SPECIFICATION_ASSIGNMENTS,
      useFactory: (): SpecificationAssignmentPort =>
        configured() ? new PrismaSpecificationAssignments(prismaClient().specification as unknown as AssignmentDelegate<AssignableSpecification>) : new InMemorySpecificationAssignments(),
    },
    {
      provide: DECISION_COMMENTS,
      useFactory: (): DecisionCommentReader => (configured() ? new PrismaDecisionCommentReader(prismaClient() as unknown as RawDb) : { decisionsForProject: async () => [] }),
    },
    {
      provide: EXECUTION_EVIDENCE,
      useFactory: (): ExecutionEvidenceReader => (configured() ? new PrismaExecutionEvidenceReader(prismaClient() as unknown as RawDb) : { forProject: async () => [] }),
    },
    {
      provide: EPICS_OWNER_GATE,
      inject: [ProjectsService, AccessGrantService, AuditService],
      useFactory: (projects: ProjectsService, grants: AccessGrantService, audit: AuditService): OwnerGate =>
        new OwnerGate({
          projects: { get: (workspaceId, id) => projects.get(workspaceId, id) },
          grants: { activeGrants: (workspaceId, artifact) => grants.activeGrants(workspaceId, artifact as never) },
          audit: { record: (row) => audit.record(row as never) },
        }),
    },
    {
      provide: EpicService,
      inject: [EPIC_STORE, REQUIREMENT_ASSIGNMENTS, SPECIFICATION_ASSIGNMENTS, DECISION_COMMENTS, EPICS_OWNER_GATE, AuditService],
      useFactory: (store: EpicStore, requirements: RequirementAssignmentPort, specifications: SpecificationAssignmentPort, decisions: DecisionCommentReader, gate: OwnerGate, audit: AuditService): EpicService =>
        new EpicService({ store, requirements, specifications, decisions, gate, audit: { record: (row) => audit.record(row as never) } }),
    },
    {
      provide: EpicStageService,
      inject: [EPIC_STORE, EXECUTION_EVIDENCE],
      useFactory: (epics: EpicStore, evidence: ExecutionEvidenceReader): EpicStageService => new EpicStageService({ epics, evidence }),
    },
  ],
  exports: [EpicService, EpicStageService],
})
export class EpicsModule {}
