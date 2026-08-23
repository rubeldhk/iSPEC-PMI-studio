/**
 * T337y — the Requirement Room's eight real entry points, per
 * `contracts/room-contract.md` §5.
 *
 * PC-1: a transport. Every capability lives in the service and is callable
 * without HTTP.
 *
 * These exist at `T337y` so Constitution XI Tier 1 has something real to reach;
 * their handlers refuse until the tasks named in the service implement them.
 */
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { RequirementRoomService, type IntakeInput } from './requirement-room.service.js';

@Controller()
export class RequirementRoomController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(RequirementRoomService) private readonly room: RequirementRoomService,
  ) {}

  @Post('rooms/requirement/intake')
  intake(@Body() body: IntakeInput): Promise<unknown> {
    return this.room.intake(body);
  }

  @Post('rooms/requirement/:id/clarifications')
  clarifications(@Param('id') id: string): Promise<unknown> {
    return this.room.clarifications(id);
  }

  @Get('rooms/requirement/:id/analysis')
  analysis(@Param('id') id: string): Promise<unknown> {
    return this.room.analysis(id);
  }

  @Post('rooms/requirement/:id/options')
  options(@Param('id') id: string): Promise<unknown> {
    return this.room.options(id);
  }

  @Post('rooms/requirement/:id/decide')
  decide(@Param('id') id: string): Promise<unknown> {
    return this.room.decide(id);
  }

  @Post('rooms/requirement/:id/baseline')
  baseline(@Param('id') id: string): Promise<unknown> {
    return this.room.baseline(id);
  }

  @Post('baselines/:version/handoff')
  handoff(@Param('version') version: string): Promise<unknown> {
    return this.room.handoff(version);
  }

  @Get('rooms/requirement/:id/readiness')
  readiness(@Param('id') id: string): Promise<unknown> {
    return this.room.readiness(id);
  }
}
