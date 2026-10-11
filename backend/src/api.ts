import 'reflect-metadata';
import { Module, type DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { buildObservability, newCorrelationId, NullMetricSink } from '@pmi/observability';
import { AppModule } from './app.module.js';
import { ExpertAgentRuntimeModule } from './composition/expert-agent-runtime.js';
import { ErrorFilter } from './core/error.filter.js';
import { configureBodyParsing } from './core/http-body.js';
import { HttpObservabilityInterceptor } from './modules/observability/http-observability.interceptor.js';
import type { AgentRuntime } from './modules/experts/adapters/runners.adapter.js';

/**
 * `@pmi/backend/api` — the API's one exported door. `T2593` (EPIC-047),
 * `DEF-047-002` option A.
 *
 * The API used to be started only by `main.ts`, inside `backend/src`, where no
 * agent adapter or execution provider may be named. A composition root outside
 * it — `@pmi/api-launcher`, on the worker's pattern — now composes what an
 * Expert run executes in and starts the API through here. `main.ts` still
 * starts it with nothing, and then Expert dispatch refuses naming
 * `DEF-047-002`, as before.
 *
 * PC-1: this is a transport. All capability lives in services that are callable
 * without HTTP.
 *
 * T657: observability is INSTALLED here. Convergence found the logger, metrics
 * and correlation modules built, tested, and called by nothing — so a running
 * API emitted no telemetry at all while `spec.md` claimed PP-010 was satisfied
 * platform-wide.
 *
 * T661: the bundle comes from `@pmi/observability`. It lived under
 * `backend/src/core/` until the worker needed it too and could not reach it —
 * DEF-001-001. One implementation, so the redaction rules cannot fork.
 */
export type { AgentRuntime, SessionTemplate } from './modules/experts/adapters/runners.adapter.js';

type ObservabilityBundle = ReturnType<typeof buildObservability>;

export interface ApiOptions {
  /** `DEF-047-002` — what an Expert run executes in. Absent: dispatch refuses, naming why. */
  readonly expertAgentRuntime?: AgentRuntime;
  readonly observability?: ObservabilityBundle;
}

/** The composition root the API is created from when a runtime is handed in. */
@Module({})
class ApiRootModule {}

function defaultObservability(): ObservabilityBundle {
  // The collector endpoint is configuration, not a Phase 1 decision
  // (system-design.md), so the default sink is inert rather than absent.
  return buildObservability({ service: 'api', sink: new NullMetricSink() });
}

/** The configured application, not yet listening. */
export async function createApi(options: ApiOptions = {}): Promise<NestExpressApplication> {
  const observability = options.observability ?? defaultObservability();
  const root: DynamicModule | typeof AppModule =
    options.expertAgentRuntime === undefined
      ? AppModule
      : { module: ApiRootModule, imports: [AppModule, ExpertAgentRuntimeModule.forRoot(options.expertAgentRuntime)] };

  // EPIC-045 DEF-045-001: the body limit is configuration, installed here and in
  // the test helper alike (core/http-body.ts).
  const app = await NestFactory.create<NestExpressApplication>(root, { bodyParser: false });
  configureBodyParsing(app);
  app.useGlobalFilters(new ErrorFilter());
  // T663 / DEF-001-002: startup telemetry is not request telemetry. Without
  // this, `requestFinished` and `correlationFor` have no call site and an
  // inbound `x-correlation-id` is discarded.
  app.useGlobalInterceptors(new HttpObservabilityInterceptor(observability));
  // D-8 / PP-012: every path is versioned.
  app.setGlobalPrefix('v1');
  return app;
}

/** Create, listen, and record that the API started. */
export async function bootstrapApi(options: ApiOptions = {}): Promise<void> {
  const observability = options.observability ?? defaultObservability();
  const app = await createApi({ ...options, observability });
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);

  // A startup record is what makes the wiring observable from outside: if this
  // line is missing from a running process, observability is not installed.
  observability
    .loggerFor({ workspaceId: 'platform', actorId: null, correlationId: newCorrelationId() })
    .log('info', 'api.started', { port, expertAgentRuntime: options.expertAgentRuntime !== undefined });
}
