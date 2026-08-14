import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ErrorFilter } from './core/error.filter.js';
import { buildObservability, NullMetricSink } from './core/observability/bootstrap.js';
import { newCorrelationId } from './core/observability/correlation.js';

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
 */
async function bootstrap(): Promise<void> {
  // The collector endpoint is configuration, not a Phase 1 decision
  // (system-design.md), so the default sink is inert rather than absent.
  const observability = buildObservability({ service: 'api', sink: new NullMetricSink() });

  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ErrorFilter());
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
