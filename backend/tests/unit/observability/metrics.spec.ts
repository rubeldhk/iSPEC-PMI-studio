/**
 * T163 — job and request metrics.
 * Written to FAIL before T164 exists (Constitution V).
 *
 * PP-010. Metrics are what make SC-011 ("95% complete or report a named failure
 * within the limit") measurable rather than asserted.
 */
import { describe, expect, it } from 'vitest';
import {
  MetricsRecorder,
  type MetricSink,
} from '../../../src/core/observability/metrics.js';

function sink(): MetricSink & { points: { name: string; value: number; attrs: Record<string, string> }[] } {
  const points: { name: string; value: number; attrs: Record<string, string> }[] = [];
  return { points, record: (name, value, attrs) => void points.push({ name, value, attrs }) };
}

describe('job metrics', () => {
  it('counts a job by terminal state', () => {
    const s = sink();
    new MetricsRecorder(s).jobFinished({
      state: 'succeeded',
      engineName: 'fixture',
      durationMs: 120,
    });
    const counted = s.points.find((p) => p.name === 'job.finished');
    expect(counted).toMatchObject({ value: 1, attrs: { state: 'succeeded', engine: 'fixture' } });
  });

  it('records duration separately so latency is queryable', () => {
    const s = sink();
    new MetricsRecorder(s).jobFinished({ state: 'succeeded', engineName: 'fixture', durationMs: 120 });
    expect(s.points.find((p) => p.name === 'job.duration_ms')?.value).toBe(120);
  });

  it('attributes the failure reason so SC-011 is measurable', () => {
    const s = sink();
    new MetricsRecorder(s).jobFinished({
      state: 'failed',
      engineName: 'fixture',
      durationMs: 5,
      failureReason: 'engine_unavailable',
    });
    expect(s.points[0]?.attrs).toMatchObject({
      state: 'failed',
      reason: 'engine_unavailable',
    });
  });

  it('never attributes a metric with a correlation id or workspace id', () => {
    // High-cardinality attributes explode a metrics backend. They belong in
    // logs and traces, not on a counter.
    const s = sink();
    new MetricsRecorder(s).jobFinished({ state: 'succeeded', engineName: 'fixture', durationMs: 1 });
    for (const p of s.points) {
      expect(Object.keys(p.attrs)).not.toContain('correlationId');
      expect(Object.keys(p.attrs)).not.toContain('workspaceId');
    }
  });
});

describe('request metrics', () => {
  it('counts requests by route and status', () => {
    const s = sink();
    new MetricsRecorder(s).requestFinished({ route: '/v1/projects', status: 200, durationMs: 12 });
    expect(s.points.find((p) => p.name === 'http.request')?.attrs).toMatchObject({
      route: '/v1/projects',
      status: '200',
    });
  });

  it('does not put a resource id in the route attribute', () => {
    const s = sink();
    new MetricsRecorder(s).requestFinished({
      route: '/v1/projects/:id',
      status: 200,
      durationMs: 12,
    });
    expect(s.points[0]?.attrs['route']).toBe('/v1/projects/:id');
  });
});
