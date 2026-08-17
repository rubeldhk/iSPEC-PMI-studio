/**
 * T661 — observability, shared by every process that runs.
 *
 * These four modules were built under `backend/src/core/observability/` by
 * T157–T164 and installed into the API by T657. The worker could not install
 * them: it has no dependency on `@pmi/backend` and must not acquire one, since
 * that would pull NestJS, Express and Prisma into the process whose only job is
 * to consume a queue and hold a concrete engine.
 *
 * So PP-010 was satisfied in one of two long-running processes while `spec.md`
 * claimed the platform (DEF-001-001). Moving them here is what makes the claim
 * true rather than what makes it quieter.
 *
 * This package is infrastructure, not a contract — it is the fourth thing in
 * `packages/` and the first that is not a port. It stays framework-free (PC-1)
 * and vendor-free (PP-015): the OpenTelemetry meter is wired at each
 * composition root through `MetricSink`, and no SDK is imported here.
 */
export {
  buildObservability,
  NullMetricSink,
  type Observability,
  type ObservabilityOptions,
} from './bootstrap.js';

export {
  attachCorrelation,
  CORRELATION_FIELD,
  CORRELATION_HEADER,
  correlationFromHeaders,
  extractCorrelation,
  isValidCorrelationId,
  newCorrelationId,
} from './correlation.js';

export {
  buildLogRecord,
  createLogger,
  REDACTED,
  redact,
  type LogContext,
  type Logger,
  type LogLevel,
} from './logger.js';

export {
  MetricsRecorder,
  type JobFinished,
  type MetricSink,
  type RequestFinished,
} from './metrics.js';
