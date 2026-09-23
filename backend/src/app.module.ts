import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PrismaUserDirectory, UnconfiguredUserDirectory } from './modules/auth/identity-provider.js';
import { prismaClient } from './persistence/prisma.js';
import { DecisionsModule } from './modules/decisions/decisions.module.js';
import { EnginesModule } from './modules/engines/engines.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { ConnectorModule } from './modules/connector/connector.module.js';
import { GovernanceModule } from './modules/governance/governance.module.js';
import { EpicsModule } from './modules/epics/epics.module.js';
import { ArtifactsModule } from './modules/artifacts/artifacts.module.js';
import { TaskSyncModule } from './modules/task-sync/task-sync.module.js';
import { RequirementsModule } from './modules/requirements/requirements.module.js';
import { SpecificationsModule } from './modules/specifications/specifications.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { SteeringModule } from './modules/steering/steering.module.js';
import { DependenciesModule } from './modules/dependencies/dependencies.module.js';
import { TraceabilityModule } from './modules/traceability/traceability.module.js';
import { RunsModule } from './modules/runs/runs.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { AgentsModule } from './modules/agents/agents.module.js';
import { ExecutionsModule } from './modules/executions/executions.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { GOVERNED_LOOP } from './composition/governed-loop.js';
import { ChangeRoomModule } from './modules/change-room/change-room.module.js';
import { DefectRoomModule } from './modules/defect-room/defect-room.module.js';
import { ContextModule } from './modules/context/context.module.js';
import { RequirementRoomModule } from './modules/requirement-room/requirement-room.module.js';

/**
 * Application composition root.
 *
 * Note what is absent: any import of `engine-adapters/*`. Engines are supplied
 * at the WORKER's composition root, so the API never holds a reference to a
 * concrete engine (FR-017). Enforced by the architecture test.
 */
/**
 * Where the built web client lives, relative to this module.
 *
 * `CLIENT_DIST` overrides it — the image copies the build to a fixed path that
 * has nothing to do with the source layout, and hardcoding `../../frontend/dist`
 * would make the container depend on the developer's directory structure.
 * `T150g` (EPIC-014 F-11.3).
 */
function clientBuildPath(): string {
  const configured = process.env['CLIENT_DIST'];
  if (configured !== undefined && configured !== '') return resolve(configured);
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
}

@Module({
  imports: [
    // T831 / DEF-005-001 — the composition root supplies the REAL directory,
    // which is the act every module comment promised and nothing performed:
    // the composed graph resolved the refusing default, and sign-in was a 500
    // in the running application while 15/15 tasks were green (the fourth
    // built-tested-called-by-nothing, after DEF-001-001/002 and DEF-028-005).
    //
    // The conditional is configuration, not caution: with no DATABASE_URL
    // there is no directory to consult, and the refusing default is the honest
    // answer — it names the missing configuration instead of telling every
    // caller "wrong password".
    AuthModule.register({
      directory: () =>
        process.env['DATABASE_URL']
          ? new PrismaUserDirectory(prismaClient().user)
          : new UnconfiguredUserDirectory(),
    }),
    AuditModule,
    // EPIC-044 DEF-044-001 — registered before every module that pulls ConnectorModule in, so the
    // session route for `projects/:projectId/requirements` owns the path and dispatches bearer callers.
    RequirementsModule,
    EnginesModule,
    JobsModule,
    ProjectsModule,
    // EPIC-041 T1362 — connector credentials and the guard (R-041-3).
    ConnectorModule,
    // EPIC-042 T1488 — constraints, policy, renders; the Constraints screen and the two connector reads.
    GovernanceModule,
    // EPIC-044 T1571 — Epics: the entity, assignment, the derived stage and the board reads.
    EpicsModule,
    // EPIC-045 T1638 — the artifact sync and the three reads. After EpicsModule:
    // it resolves an execution's Epic through the same store the board uses.
    ArtifactsModule,
    TaskSyncModule,
    SpecificationsModule,
    TasksModule,
    SteeringModule,
    DependenciesModule,
    TraceabilityModule,
    DecisionsModule,
    RunsModule,
    ReviewModule,
    // EPIC-021's production gate capability (C2C, T1110). Registered here
    // because the Epic closed with services and no module at all.
    ReviewsModule,
    AccessModule,
    AgentsModule,
    ExecutionsModule,
    StorageModule,
    // T936 — EPIC-030. The wiring T934 exists to prove: a module built,
    // tested and never registered is the defect class DEF-005-001 shipped
    // with 15/15 tasks green.
    //
    // `T1165` — the CONFIGURED loop. `ExecutionsModule` imports the same
    // constant, so there is one instance and one store.
    GOVERNED_LOOP,
    // T337y — EPIC-033. The wiring T337x exists to prove.
    RequirementRoomModule,
    // T406w — EPIC-034. The wiring T406u exists to prove.
    ChangeRoomModule,
    DefectRoomModule,
    ContextModule,
    // T150g — EPIC-014 F-11.3. The API serves the built web client, so the
    // containerised stack is ONE origin and the client's `/v1` assumption holds
    // without the client changing (`R-014-1`).
    //
    // **`renderPath` is deliberately not set.** Its default is `*`, which sends
    // `index.html` for anything unmatched — the SPA history fallback, and the
    // whole of `R-036-3`: `EPIC-036` could not prove a deep link survives a
    // refresh because nothing here served the built client, and `EPIC-029`'s
    // UAT had to hand-roll a static server with its own `/v1` proxy.
    //
    // **`exclude` is what keeps the API reachable.** Without it every `/v1`
    // request returns `index.html` with a `200`, and the client reports a JSON
    // parse error three layers from the cause. `main.ts` sets the global prefix
    // to `v1`, so this list and that prefix must agree — `T150c` asserts it.
    //
    // Registered LAST on purpose: the static handler is the fallback, and
    // anything that should answer before it must be registered before it.
    // **No `serveStaticOptions`.** `fallthrough: true` is the *Fastify*
    // requirement — `R-014-1` says so — and this repository is on
    // `@nestjs/platform-express`, where fallthrough is already the behaviour.
    // Setting it anyway cost a `tsc` stack overflow: the Express
    // `ServeStaticOptions` generic blew the type-relation recursion limit, and
    // the failure was `RangeError: Maximum call stack size exceeded` with no
    // error location — a diagnostic that names nothing.
    // **`/v1(.*)` — and it had to be measured, not reasoned about.**
    //
    // `@nestjs/serve-static@4` matches `exclude` with **`path-to-regexp@0.2.5`**
    // (see its `dist/utils/is-route-excluded.util.js`), not with Express's own
    // router. Against that version, tested inside the running container:
    //
    //     /v1{*splat}  never matches   (Express 5 / path-to-regexp 8 syntax)
    //     /v1*         never matches
    //     /v1/*        never matches
    //     /v1(.*)      matches         ← this one
    //
    // A pattern that never matches does not throw. It silently excludes
    // nothing, so every unmatched `/v1` path returns `index.html` with a `200`
    // and the client reports a JSON parse error three layers from the cause.
    // **Two wrong patterns shipped before this one**, each of which looked
    // right and passed a check that only asked whether `/v1` was mentioned.
    // `T150c` now runs the pattern through the loader's own matcher.
    ServeStaticModule.forRoot({
      rootPath: clientBuildPath(),
      exclude: ['/v1(.*)'],
    }),
  ],
})
export class AppModule {}
