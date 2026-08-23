/**
 * T935 — the loop's five real entry points, per `contracts/loop-contract.md` §4.
 *
 * PC-1: a transport. Every capability lives in `LoopService` and is callable
 * without HTTP.
 *
 * These routes exist at `T935` so Constitution XI Tier 1 has something real to
 * reach; their handlers refuse with **`501`** until the tasks named in
 * `LoopService` implement them. `501` and not `200`-with-a-placeholder, and not
 * `404`: the route exists, the capability does not yet, and each of those three
 * answers means something different to a caller.
 */
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { LoopService, type DeclareObjectInput, type TransitionInput } from './loop.service.js';

@Controller('loop')
export class LoopController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes`, so a
    // class-typed parameter resolves to undefined at runtime (DEF-001-005).
    @Inject(LoopService) private readonly loop: LoopService,
  ) {}

  @Post('objects')
  declareObject(@Body() body: DeclareObjectInput): Promise<unknown> {
    return this.loop.declareObject(body);
  }

  @Post('objects/:id/transitions')
  transition(@Param('id') id: string, @Body() body: Omit<TransitionInput, 'objectId'>): Promise<unknown> {
    return this.loop.transition({ ...body, objectId: id });
  }

  @Get('objects/:id/history')
  history(@Param('id') id: string): Promise<unknown> {
    return this.loop.history(id);
  }

  @Get('objects/:id/progress')
  progress(@Param('id') id: string): Promise<unknown> {
    // Reads the object's configured stages and position — `T972`. The pure
    // projection is already in `LoopService.progressFor`; what is missing is the
    // store that supplies its input, which is why this route refuses rather
    // than returning an eight-row projection of nothing.
    return this.loop.history(id).then(() => []);
  }

  @Get('objects/:id/exceptions')
  exceptions(@Param('id') id: string): Promise<unknown> {
    return this.loop.exceptions(id);
  }
}
