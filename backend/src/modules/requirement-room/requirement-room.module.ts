/**
 * T337y — Requirement Room module wiring.
 *
 * Services stay framework-free (PC-1). The five seams declared in
 * `@pmi/room-contract`'s `ROOM_PORTS` are **not registered here**: `EPIC-030`,
 * `EPIC-031`, `EPIC-032`, `EPIC-007` and `EPIC-028` supply them by overriding
 * the tokens at the composition root, which is this repository's platform-wide
 * pattern.
 *
 * **Nothing is defaulted, and `RequirementRegister` least of all.** `FR-RQR-002`
 * and `D-33`: this Room consumes the register `EPIC-007` owns. An in-memory
 * default here would be a second requirement store that works perfectly in
 * every test and is wrong in production — the boundary the contract's own
 * comment calls the one most likely to be crossed.
 */
import { Module } from '@nestjs/common';
import { RequirementRoomController } from './requirement-room.controller.js';
import { RequirementRoomService } from './requirement-room.service.js';

@Module({
  controllers: [RequirementRoomController],
  providers: [
    {
      provide: RequirementRoomService,
      useFactory: (): RequirementRoomService => new RequirementRoomService(),
    },
  ],
  exports: [RequirementRoomService],
})
export class RequirementRoomModule {}
