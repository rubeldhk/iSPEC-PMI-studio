/**
 * T164 — metrics for requests and generation jobs.
 *
 * PP-010. These are what make SC-011 measurable: "95% of generation requests
 * complete or report a named failure within the stated time limit" is a claim
 * about a distribution, and you cannot assert a distribution from logs alone.
 *
 * Attributes are deliberately LOW cardinality — state, engine, reason, route,
 * status. Correlation ids and workspace ids belong in logs and traces; putting
 * them on a counter multiplies its series by the number of tenants.
 *
 * The sink is a port, so the OpenTelemetry meter is wired at composition and no
 * vendor SDK reaches this file (PP-015).
 */
import type { EngineFailureReason } from '@pmi/engine-contract';

export interface MetricSink {
  record(name: string, value: number, attrs: Record<string, string>): void;
}

export interface JobFinished {
  state: 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  engineName: string;
  durationMs: number;
  failureReason?: EngineFailureReason;
}

export interface RequestFinished {
  /** Templated route — `/v1/projects/:id`, never a concrete id. */
  route: string;
  status: number;
  durationMs: number;
}

export class MetricsRecorder {
  constructor(private readonly sink: MetricSink) {}

  jobFinished(e: JobFinished): void {
    const attrs: Record<string, string> = { state: e.state, engine: e.engineName };
    if (e.failureReason) attrs['reason'] = e.failureReason;
    this.sink.record('job.finished', 1, attrs);
    this.sink.record('job.duration_ms', e.durationMs, attrs);
  }

  requestFinished(e: RequestFinished): void {
    const attrs = { route: e.route, status: String(e.status) };
    this.sink.record('http.request', 1, attrs);
    this.sink.record('http.duration_ms', e.durationMs, attrs);
  }
}
