/**
 * The steering module — wiring only (T238's providing seam).
 *
 * Factory providers throughout (DEF-001-005: esbuild emits no
 * design:paramtypes, so nothing here relies on implicit class-typed
 * injection). Prisma-backed stores land with the platform composition root
 * (EPIC-014 F-11.2), the same deferral every module carries.
 */
import { Module } from '@nestjs/common';
import {
  InMemorySteeringStore,
  SteeringService,
  type SteeringDocumentRecord,
} from './steering.service.js';
import {
  SteeringController,
  STEERING_API,
  type CreateSteeringBody,
  type SteeringApi,
  type SteeringDocumentBody,
} from './steering.controller.js';

function toBody(record: SteeringDocumentRecord): SteeringDocumentBody {
  return {
    id: record.id,
    subject: record.subject,
    scope: { scopeType: record.scope.scopeType, scopeRef: record.scope.scopeRef },
    content: record.content,
    version: record.version,
    status: record.status,
  };
}

/** Adapts the framework-free service to the controller's surface. */
class ComposedSteeringApi implements SteeringApi {
  constructor(private readonly service: SteeringService) {}

  async create(
    ctx: { workspaceId: string; userId: string },
    input: CreateSteeringBody,
  ): Promise<SteeringDocumentBody> {
    return toBody(
      await this.service.create(ctx.workspaceId, {
        subject: input.subject,
        scope: {
          scopeType: input.scopeType as SteeringDocumentRecord['scope']['scopeType'],
          scopeRef: input.scopeRef,
        },
        content: input.content,
        createdById: ctx.userId,
      }),
    );
  }

  async list(workspaceId: string): Promise<SteeringDocumentBody[]> {
    return (await this.service.list(workspaceId)).map(toBody);
  }

  async get(workspaceId: string, id: string): Promise<SteeringDocumentBody> {
    return toBody(await this.service.get(workspaceId, id));
  }

  async edit(
    workspaceId: string,
    id: string,
    content: string,
    userId: string,
  ): Promise<SteeringDocumentBody> {
    return toBody(await this.service.edit(workspaceId, id, content, userId));
  }

  async retire(workspaceId: string, id: string, userId: string): Promise<SteeringDocumentBody> {
    return toBody(await this.service.retire(workspaceId, id, userId));
  }

  async history(workspaceId: string, id: string): Promise<SteeringDocumentBody[]> {
    return (await this.service.history(workspaceId, id)).map(toBody);
  }
}

@Module({
  controllers: [SteeringController],
  providers: [
    {
      provide: SteeringService,
      useFactory: (): SteeringService => new SteeringService(new InMemorySteeringStore()),
    },
    {
      provide: STEERING_API,
      inject: [SteeringService],
      useFactory: (service: SteeringService): SteeringApi => new ComposedSteeringApi(service),
    },
  ],
  exports: [SteeringService],
})
export class SteeringModule {}
