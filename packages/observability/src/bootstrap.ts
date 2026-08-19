/**
 * T657 — observability, assembled and installed.
 *
 * Convergence found `logger.ts`, `correlation.ts` and `metrics.ts` fully built,
 * fully tested, and referenced by NOTHING outside their own specs — while
 * `spec.md` claimed *"PP-010 Observability by Default · ✅ Satisfied here for the
 * whole platform."* At runtime nothing emitted a log, a metric, or a correlation
 * identifier. The claim was true of the code and false of the system.
 *
 * This is the assembly the bootstraps install. It is deliberately one bundle:
 * three separately-wired concerns is three chances to wire two of them.
 *
 * Framework-free (PC-1) — no HTTP type appears here, so `main.ts` can install it
 * and the transport-independence test still holds.
 */
import { correlationFromHeaders } from './correlation.js';
import { createLogger, type LogContext, type Logger } from './logger.js';
import { MetricsRecorder, type MetricSink } from './metrics.js';

export interface ObservabilityOptions {
  /** Distinguishes `api` from `worker` on every record. */
  service: string;
  sink: MetricSink;
  /** Overridable so tests capture without touching stdout. */
  write?: (line: string) => void;
}

export interface Observability {
  /**
   * A logger bound to one request or job.
   *
   * `LogContext` carries workspace, actor and correlation — which are per-unit-
   * of-work, not per-process — so there is no such thing as a global logger
   * here, and `buildLogRecord` throws without a correlation id by design.
   */
  loggerFor(ctx: LogContext): Logger;
  metrics: MetricsRecorder;
  /** Adopt a valid inbound correlation identifier, or mint one (PC-3). */
  correlationFor(headers: Record<string, unknown>): string;
}

export function buildObservability(options: ObservabilityOptions): Observability {
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));

  return {
    loggerFor(ctx) {
      // `service` is stamped by wrapping the sink rather than widening
      // `LogContext`, which is a per-unit-of-work shape and should stay one.
      return createLogger(ctx, (record) =>
        write(JSON.stringify({ service: options.service, ...record })),
      );
    },
    metrics: new MetricsRecorder(options.sink),
    correlationFor: (headers) => correlationFromHeaders(headers),
  };
}

/**
 * A sink that discards.
 *
 * The OpenTelemetry collector endpoint is configuration, not a Phase 1 decision
 * (`system-design.md`), so the default must be **inert rather than absent** — an
 * optional sink would make `MetricsRecorder` optional at every call site, which
 * is how metrics quietly stop being emitted.
 */
export class NullMetricSink implements MetricSink {
  readonly recorded: { name: string; value: number; attrs: Record<string, string> }[] = [];

  record(name: string, value: number, attrs: Record<string, string>): void {
    this.recorded.push({ name, value, attrs });
  }
}
