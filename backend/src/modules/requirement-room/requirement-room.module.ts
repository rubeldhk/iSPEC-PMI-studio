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
import { DecisionService } from './decision.service.js';
import { HandoffService } from './handoff.service.js';
import { OptionsService } from './options.service.js';
import { IntakeService } from './intake.service.js';
import { EpicSevenRequirementRegister } from './register.adapter.js';
import { RequirementRoomController } from './requirement-room.controller.js';
import { RequirementRoomService } from './requirement-room.service.js';
import { AccessModule } from '../access/access.module.js';
import { WorkspaceBoundaryService } from '../access/workspace-boundary.service.js';
import {
  InMemoryRequirementRoomStore,
  type RequirementRoomStore,
} from './requirement-room.store.js';
import { REQUIREMENT_ROOM_STORE, ROOM_REQUIREMENT_REGISTER } from './requirement-room.tokens.js';

/** Eagerly constructed so the veto is registered, not merely available. */
const EDIT_VETO_REGISTERED = Symbol('EDIT_VETO_REGISTERED');

import { GOVERNED_LOOP } from '../../composition/governed-loop.js';
import { PolicyModule, POLICY_PROVIDER, type LoopPolicyAdapter } from '../policy/policy.module.js';
import {
  PrismaEvidenceContractSource,
  type EvidencePrismaClient,
} from '../evidence/evidence-contract.source.js';
import { prismaClient } from '../../persistence/prisma.js';
import {
  PrismaRequirementRoomStore,
  type RoomPrismaClient,
} from './requirement-room.store.prisma.js';
import { LoopService } from '../loop/loop.service.js';

@Module({
  // `AccessModule` for `WorkspaceBoundaryService` — EPIC-024's authoritative
  // actor directory, consumed rather than re-implemented (`T1148`). It is what
  // turns `actor.kind` from a claim into a resolved fact.
  imports: [RequirementsModule, AccessModule, GOVERNED_LOOP, PolicyModule],
  controllers: [RequirementRoomController],
  providers: [
    {
      provide: REQUIREMENT_ROOM_STORE,
      // `T1182` — the composition seam. `DATABASE_URL` decides, as it does for
      // `PROJECT_STORE` and `LOOP_STORE`: unset in unit tests, so the in-memory
      // store stays their default.
      //
      // Until this, a baseline — the artifact `RULE-02` exists to make
      // immutable — lived only in the process that created it.
      useFactory: (): RequirementRoomStore =>
        process.env['DATABASE_URL']
          ? new PrismaRequirementRoomStore(prismaClient() as unknown as RoomPrismaClient)
          : new InMemoryRequirementRoomStore(),
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
      useFactory: (store: RequirementRoomStore): BaselineService =>
        // `T1204` — the Evidence Contract seam. `readiness` and `approve` are
        // separate consumers of it, and binding only the first is how a gate
        // reports "ready" and then refuses: the Room said nothing was
        // outstanding while `approve` still threw.
        new BaselineService(
          store,
          process.env['DATABASE_URL']
            ? new PrismaEvidenceContractSource(prismaClient() as unknown as EvidencePrismaClient)
            : undefined,
        ),
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
      provide: OptionsService,
      useFactory: (): OptionsService => new OptionsService(),
    },
    {
      provide: DecisionService,
      inject: [REQUIREMENT_ROOM_STORE, POLICY_PROVIDER],
      useFactory: (store: RequirementRoomStore, policy: LoopPolicyAdapter): DecisionService =>
        // `T1199` — the seam is bound. `EPIC-031`'s banded provider, scoped to
        // what this path needs: with no classification rules declared every
        // action is high (`FR-DPE-004`), so automation is refused and an
        // authenticated human in their own workspace may decide.
        //
        // Still not a permissive default: `FR-DPE-012`'s floor holds,
        // `FR-DPE-013` refuses an unevaluated gate, and `FR-DPE-015` refuses
        // self-approval. `FR-GEL-062` is satisfied by a policy that ANSWERS,
        // not by one that says yes.
        new DecisionService(store, policy as unknown as ConstructorParameters<typeof DecisionService>[1]),
    },
    {
      provide: HandoffService,
      inject: [REQUIREMENT_ROOM_STORE],
      useFactory: (store: RequirementRoomStore): HandoffService => new HandoffService(store),
    },
    {
      provide: RequirementRoomService,
      inject: [
        IntakeService,
        BaselineService,
        AnalysisService,
        ClarificationService,
        OptionsService,
        DecisionService,
        HandoffService,
        EDIT_VETO_REGISTERED,
        REQUIREMENT_ROOM_STORE,
        WorkspaceBoundaryService,
        LoopService,
        ROOM_REQUIREMENT_REGISTER,
      ],
      useFactory: (
        intake: IntakeService,
        baselines: BaselineService,
        analysis: AnalysisService,
        clarifications: ClarificationService,
        options: OptionsService,
        decisions: DecisionService,
        handoffs: HandoffService,
        _veto: true,
        store: RequirementRoomStore,
        principals: WorkspaceBoundaryService,
        loop: LoopService,
        register: EpicSevenRequirementRegister,
      ): RequirementRoomService =>
        // No EvidenceContractSource: EPIC-032 binds it at the composition root.
        // Until it does, `readiness` reports the Contract as UNEVALUATED, which
        // blocks — "cannot tell" is never "ready" (T339g).
        new RequirementRoomService(
          intake,
          baselines,
          analysis,
          clarifications,
          options,
          decisions,
          handoffs,
          store,
          principals,
          // `T1204` — the Evidence Contract seam, bound. `ROOM_PORTS` declares
          // it `absent: 'refuse'`, and until now nothing supplied it, so
          // `approve` threw before reading the set (`DEF-033-002`).
          //
          // Still refuses by default, and that is `FR-EVS-026`: a Contract with
          // no items satisfies nothing unless policy declared the work class
          // needs none. Binding this made the gate *evaluable*, not permissive.
          process.env['DATABASE_URL']
            ? new PrismaEvidenceContractSource(
                prismaClient() as unknown as EvidencePrismaClient,
              )
            : undefined,
          // `T1167` — the governed loop, so `openRoom` can declare the Room's
          // object. `GOVERNED_LOOP` is the one configured instance.
          loop,
          // `T1206` — `EPIC-007`'s register, for promotion.
          register,
        ),
    },
  ],
  exports: [
    RequirementRoomService,
    IntakeService,
    BaselineService,
    AnalysisService,
    ClarificationService,
    OptionsService,
    DecisionService,
    HandoffService,
    REQUIREMENT_ROOM_STORE,
  ],
})
export class RequirementRoomModule {}
