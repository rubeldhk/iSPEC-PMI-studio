/**
 * The dependencies module — wiring only. Factory providers throughout
 * (DEF-001-005). Prisma-backed stores land with the platform composition
 * root (EPIC-014 F-11.2), the same deferral every module carries.
 */
import { Module } from '@nestjs/common';
import {
  DependenciesService,
  InMemoryDependencyStore,
  type DependencyStore,
} from './dependencies.service.js';
import { ImpactService } from './impact.service.js';
import {
  DependenciesController,
  DEPENDENCIES_API,
  type CreateEdgeBody,
  type DependenciesApi,
} from './dependencies.controller.js';

const DEPENDENCY_STORE = Symbol('DEPENDENCY_STORE');

class ComposedDependenciesApi implements DependenciesApi {
  constructor(
    private readonly dependencies: DependenciesService,
    private readonly impactService: ImpactService,
  ) {}

  async create(ctx: { workspaceId: string; userId: string }, body: CreateEdgeBody) {
    return this.dependencies.create(
      ctx.workspaceId,
      {
        source: { artifactType: body.sourceType, artifactId: body.sourceId },
        target: { artifactType: body.targetType, artifactId: body.targetId },
        dependencyType: body.dependencyType,
      },
      ctx.userId,
    );
  }

  async listForArtifact(workspaceId: string, ref: { artifactType: string; artifactId: string }) {
    return this.dependencies.listForArtifact(workspaceId, ref);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    return this.dependencies.delete(workspaceId, id);
  }

  async impact(workspaceId: string, ref: { artifactType: string; artifactId: string }) {
    return this.impactService.impact(workspaceId, ref);
  }
}

@Module({
  controllers: [DependenciesController],
  providers: [
    {
      provide: DEPENDENCY_STORE,
      useFactory: (): DependencyStore => new InMemoryDependencyStore(),
    },
    {
      provide: DependenciesService,
      inject: [DEPENDENCY_STORE],
      useFactory: (store: DependencyStore): DependenciesService => new DependenciesService(store),
    },
    {
      provide: ImpactService,
      inject: [DEPENDENCY_STORE],
      useFactory: (store: DependencyStore): ImpactService => new ImpactService(store),
    },
    {
      provide: DEPENDENCIES_API,
      inject: [DependenciesService, ImpactService],
      useFactory: (
        dependencies: DependenciesService,
        impact: ImpactService,
      ): DependenciesApi => new ComposedDependenciesApi(dependencies, impact),
    },
  ],
  exports: [DependenciesService, ImpactService],
})
export class DependenciesModule {}
