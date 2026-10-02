import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ErrorFilter } from './core/error.filter.js';
import { configureBodyParsing } from './core/http-body.js';
import { buildObservability, newCorrelationId, NullMetricSink } from '@pmi/observability';
import { HttpObservabilityInterceptor } from './modules/observability/http-observability.interceptor.js';

/**
 * API entry point.
 *
 * PC-1: this is a transport. All capability lives in services that are callable
 * without HTTP, so an MCP surface can be added in Phase 3 without redesign.
 *
 * T657: observability is INSTALLED here. Convergence found the logger, metrics
 * and correlation modules built, tested, and called by nothing — so a running
 * API emitted no telemetry at all while `spec.md` claimed PP-010 was satisfied
 * platform-wide.
 *
 * T661: the bundle now comes from `@pmi/observability`. It lived under
 * `backend/src/core/` until the worker needed it too and could not reach it —
 * DEF-001-001. One implementation, so the redaction rules cannot fork.
 */
async function bootstrap(): Promise<void> {
  // The collector endpoint is configuration, not a Phase 1 decision
  // (system-design.md), so the default sink is inert rather than absent.
  const observability = buildObservability({ service: 'api', sink: new NullMetricSink() });

  // EPIC-045 DEF-045-001: the body limit is configuration, installed here and in
  // the test helper alike (core/http-body.ts).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureBodyParsing(app);
  app.useGlobalFilters(new ErrorFilter());
  // T663 / DEF-001-002: startup telemetry is not request telemetry. Without
  // this, `requestFinished` and `correlationFor` have no call site and an
  // inbound `x-correlation-id` is discarded.
  app.useGlobalInterceptors(new HttpObservabilityInterceptor(observability));
  // D-8 / PP-012: every path is versioned.
  app.setGlobalPrefix('v1');

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);

  // A startup record is what makes the wiring observable from outside: if this
  // line is missing from a running process, observability is not installed.
  observability
    .loggerFor({ workspaceId: 'platform', actorId: null, correlationId: newCorrelationId() })
    .log('info', 'api.started', { port });
}

void bootstrap();
