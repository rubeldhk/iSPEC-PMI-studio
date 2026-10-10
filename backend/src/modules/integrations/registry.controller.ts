/**
 * `T2171` (EPIC-039, API contract §1–§2) — the registry, the vocabulary, and
 * registration. Reading needs `EPIC-024` read on the workspace's
 * `integration-registry`; registering and retiring need edit. A refusal is an
 * absence (`404`), never a confirmation that the registry exists.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Hub } from './hub.js';
import { HUB } from './hub.token.js';
import type { EntryDetail, EntryView } from './registry.service.js';
import { requireSession, type HubRequest } from './session.js';

@Controller('integrations')
export class RegistryController {
  constructor(@Inject(HUB) private readonly hub: Hub) {}

  @Get('registry')
  async list(@Req() req: HubRequest, @Query('projectId') projectId?: string): Promise<{ entries: EntryView[]; omitted: readonly { key: string; reason: string }[] }> {
    return this.hub.registry.list(requireSession(req), projectId || undefined);
  }

  @Get('registry/:entryId')
  async detail(@Req() req: HubRequest, @Param('entryId') entryId: string, @Query('projectId') projectId?: string): Promise<EntryDetail> {
    return this.hub.registry.detail(requireSession(req), entryId, projectId || undefined);
  }

  @Post('registry')
  async register(@Req() req: HubRequest, @Body() body: { key?: unknown } | undefined): Promise<EntryView> {
    return this.hub.registry.register(requireSession(req), body?.key);
  }

  @Post('registry/:entryId/retire')
  @HttpCode(200)
  async retire(@Req() req: HubRequest, @Param('entryId') entryId: string): Promise<EntryView> {
    return this.hub.registry.retire(requireSession(req), entryId);
  }

  @Get('capabilities')
  async capabilities(@Req() req: HubRequest): Promise<{ name: string; scope: string; version: string; status: string; changesState: boolean }[]> {
    return this.hub.registry.capabilities(requireSession(req));
  }

  @Get('capabilities/:name/versions/:version')
  async capabilityVersion(@Req() req: HubRequest, @Param('name') name: string, @Param('version') version: string): Promise<Record<string, unknown>> {
    return this.hub.registry.capabilityVersion(requireSession(req), name, version);
  }
}
