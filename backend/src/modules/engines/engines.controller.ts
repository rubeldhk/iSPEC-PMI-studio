/**
 * T140 — `GET /engines` per contracts/platform-api.md (Engines · US8).
 *
 * Registered engines WITH capabilities (FR-019): a project choosing an engine
 * needs to know what it can do — FR-021 refuses an engine missing a Phase 1
 * capability at registration, and this surface is where that becomes visible.
 *
 * Read-only by design: registration is a composition-time concern, not a
 * runtime endpoint in Phase 1. The paired test asserts no write route exists.
 *
 * PC-1: a transport. It reads the registry and shapes the answer, nothing more.
 * Per-project SELECTION is not here — the contract routes it through
 * `PATCH /projects/{id}` ("see Projects"), owned by EPIC-006's controller.
 */
import { Controller, Get, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { EngineRegistryService } from './engine-registry.service.js';

export interface EngineListing {
  name: string;
  version: string;
  capabilities: string[];
  isDefault: boolean;
}

@Controller('engines')
export class EnginesController {
  constructor(private readonly registry: EngineRegistryService) {}

  @Get()
  async list(@Req() ctx: WorkspaceContext | undefined): Promise<EngineListing[]> {
    // Universal rule: every request resolves a session. Engines are
    // deployment-scoped, so the workspace is not a filter here — but an
    // unauthenticated caller still learns nothing about the deployment.
    if (!ctx?.workspaceId) throw new UnauthenticatedError('No valid session.');

    return this.registry.listRegistered().map((descriptor) => ({
      name: descriptor.name,
      version: descriptor.version,
      capabilities: [...descriptor.capabilities],
      isDefault: descriptor.name === this.registry.defaultEngineName,
    }));
  }
}
