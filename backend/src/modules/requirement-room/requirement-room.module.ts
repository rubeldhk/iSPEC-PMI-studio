/**
 * T337y, T338v, T338l — Requirement Room module wiring.
 *
 * Services stay framework-free (PC-1). Of the five seams declared in
 * `@pmi/room-contract`'s `ROOM_PORTS`, four are **not registered here**:
 * `EPIC-030`, `EPIC-031`, `EPIC-032` and `EPIC-028` supply them by overriding
 * the tokens at the composition root, which is this repository's platform-wide
 * pattern.
 *
 * **`RequirementRegister` is the exception, and it is bound rather than
 * defaulted.** `FR-RQR-002` and `D-33`: this Room consumes the register
 * `EPIC-007` owns, so the binding to that real service is made here, once
 * (`T338d`). What must never appear is an *in-memory* register — a second
 * requirement store that works perfectly in every test and is wrong in
 * production. `EPIC-031`'s analysis found the equivalent binding missing
 * entirely (`C2`), which is why it has its own file, its own task and its own
 * test against the real `RequirementsService`.
 *
 * **`REQUIREMENT_ROOM_STORE` defaults to in-memory, and the asymmetry is
 * `EPIC-030`'s** (`loop.module.ts`): a store that loses data fails visibly and
 * testably, while a governance seam that defaults to permitting is
 * indistinguishable at every call site from a policy that said yes.
 *
 * **The edit veto is registered, not declared.** `T338h`'s refusal only means
 * something if `EPIC-007`'s edit path consults it, so the registration is a
 * provider — eagerly constructed at bootstrap — rather than a note in a
 * comment. `EditAuthorityRegistry` comes from `RequirementsModule`; the
 * dependency runs Room → Requirements and never back.
 */
import { Module } from '@nestjs/common';
import { EditAuthorityRegistry } from '../requirements/edit-authority.js';
import { RequirementVersionService } from '../requirements/requirement-version.service.js';
import { RequirementsModule } from '../requirements/requirements.module.js';
import { RequirementsService } from '../requirements/requirements.service.js';
import { AnalysisService } from './analysis.service.js';
import { BaselineService } from './baseline.service.js';
import { ClarificationService } from './clarification.service.js';
import { IntakeService } from './intake.service.js';
import { EpicSevenRequirementRegister } from './register.adapter.js';
import { RequirementRoomController } from './requirement-room.controller.js';
import { RequirementRoomService } from './requirement-room.service.js';
import {
  InMemoryRequirementRoomStore,
  type RequirementRoomStore,
} from './requirement-room.store.js';
import { REQUIREMENT_ROOM_STORE, ROOM_REQUIREMENT_REGISTER } from './requirement-room.tokens.js';

/** Eagerly constructed so the veto is registered, not merely available. */
const EDIT_VETO_REGISTERED = Symbol('EDIT_VETO_REGISTERED');

@Module({
  imports: [RequirementsModule],
  controllers: [RequirementRoomController],
  providers: [
    {
      provide: REQUIREMENT_ROOM_STORE,
      useFactory: (): RequirementRoomStore => new InMemoryRequirementRoomStore(),
    },
    {
      provide: ROOM_REQUIREMENT_REGISTER,
      inject: [RequirementsService, RequirementVersionService],
      useFactory: (
        requirements: RequirementsService,
        versions: RequirementVersionService,
      ): EpicSevenRequirementRegister =>
        new EpicSevenRequirementRegister(requirements, versions),
    },
    {
      provide: IntakeService,
      inject: [REQUIREMENT_ROOM_STORE],
      useFactory: (store: RequirementRoomStore): IntakeService => new IntakeService(store),
    },
    {
      provide: BaselineService,
      inject: [REQUIREMENT_ROOM_STORE],
      useFactory: (store: RequirementRoomStore): BaselineService => new BaselineService(store),
    },
    {
      provide: EDIT_VETO_REGISTERED,
      inject: [EditAuthorityRegistry, BaselineService, RequirementVersionService],
      useFactory: (
        authority: EditAuthorityRegistry,
        baselines: BaselineService,
        versions: RequirementVersionService,
      ): true => {
        authority.register(async (ctx, requirement) => {
          // The join lives here: a baseline freezes VERSION ids, and which
          // versions belong to a requirement is EPIC-007's to answer. Asking
          // inside `BaselineService` would mean the Room holding the register
          // (FR-RQR-002).
          const history = await versions.listForRequirement(ctx.workspaceId, requirement.id);
          await baselines.assertEditable(
            ctx,
            requirement,
            history.map((row) => row.id),
          );
        });
        return true;
      },
    },
    {
      provide: AnalysisService,
      inject: [REQUIREMENT_ROOM_STORE],
      useFactory: (store: RequirementRoomStore): AnalysisService =>
        // No binding. `ROOM_AGENT_GATEWAY` is the one seam that DEGRADES when
        // unbound (T338m), so this is a working analysis with its AI half
        // saying, in the payload, that it did not run — not a broken one. An
        // adapter arrives at the worker's composition root; `backend/` never
        // imports one (FR-AGT-004).
        new AnalysisService(store, undefined),
    },
    {
      provide: ClarificationService,
      inject: [REQUIREMENT_ROOM_STORE],
      useFactory: (store: RequirementRoomStore): ClarificationService =>
        new ClarificationService(store),
    },
    {
      provide: RequirementRoomService,
      inject: [
        IntakeService,
        BaselineService,
        AnalysisService,
        ClarificationService,
        EDIT_VETO_REGISTERED,
        REQUIREMENT_ROOM_STORE,
      ],
      useFactory: (
        intake: IntakeService,
        baselines: BaselineService,
        analysis: AnalysisService,
        clarifications: ClarificationService,
        _veto: true,
        store: RequirementRoomStore,
      ): RequirementRoomService =>
        // No EvidenceContractSource: EPIC-032 binds it at the composition root.
        // Until it does, `readiness` reports the Contract as UNEVALUATED, which
        // blocks — "cannot tell" is never "ready" (T339g).
        new RequirementRoomService(intake, baselines, analysis, clarifications, store, undefined),
    },
  ],
  exports: [
    RequirementRoomService,
    IntakeService,
    BaselineService,
    AnalysisService,
    ClarificationService,
    REQUIREMENT_ROOM_STORE,
  ],
})
export class RequirementRoomModule {}
