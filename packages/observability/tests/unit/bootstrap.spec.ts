/**
 * T656 (bundle behaviour) — what `buildObservability` assembles.
 *
 * Split from `backend/tests/unit/observability/bootstrap.spec.ts` by T661 when
 * these modules moved out of `backend/`. The split follows the seam the defect
 * exposed:
 *
 *   - **behaviour of the bundle** lives here, beside the code, and is asserted once
 *   - **installation into a process** lives in that process, and is asserted once
 *     PER PROCESS — see `backend/tests/unit/observability/bootstrap.spec.ts` and
 *     `worker/tests/unit/observability-installation.spec.ts`
 *
 * DEF-001-001 happened because there was one installation check for two
 * processes. Keeping bundle behaviour out of those files is what stops them
 * growing into something that looks like coverage of both.
 */
import { describe, expect, it } from 'vitest';
import { buildObservability, NullMetricSink } from '../../src/bootstrap.js';
import { CORRELATION_HEADER } from '../../src/correlation.js';
import { REDACTED } from '../../src/logger.js';

const CTX = { workspaceId: 'ws', actorId: 'u1', correlationId: 'cid-1' };

function capture(service = 'api') {
  const lines: string[] = [];
  const sink = new NullMetricSink();
  const obs = buildObservability({ service, sink, write: (l) => lines.push(l) });
  return { obs, lines, sink };
}

describe('T656 · correlation is adopted or minted (PC-3)', () => {
  it('adopts a valid inbound identifier rather than minting a new one', () => {
    const { obs } = capture();
    const id = obs.correlationFor({ [CORRELATION_HEADER]: '11111111-1111-4111-8111-111111111111' });
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('mints one when the header is absent or malformed', () => {
    const { obs } = capture();
    expect(obs.correlationFor({})).toMatch(/^[0-9a-f-]{36}$/);
    // An unvalidated header is an injection point into every log line it touches.
    expect(obs.correlationFor({ [CORRELATION_HEADER]: 'not-a-uuid' })).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('T656 · every record carries identity and service', () => {
  it('stamps correlation, workspace, actor and service', () => {
    const { obs, lines } = capture();
    obs.loggerFor(CTX).log('info', 'job.submitted');

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({
      service: 'api',
      msg: 'job.submitted',
      correlationId: 'cid-1',
      workspaceId: 'ws',
      actorId: 'u1',
    });
  });

  it('distinguishes the two processes on every record', () => {
    // T661: with one bundle shared by both, `service` is the only thing that
    // says which process a line came from.
    const { obs, lines } = capture('worker');
    obs.loggerFor(CTX).log('info', 'job.finished');
    expect(JSON.parse(lines[0] as string)).toMatchObject({ service: 'worker' });
  });

  it('refuses to build a record without a correlation id', () => {
    const { obs } = capture();
    expect(() => obs.loggerFor({ ...CTX, correlationId: '' }).log('info', 'x')).toThrow(
      /correlation id is required/i,
    );
  });

  it('never lets a credential or engine output reach the log (PC-3)', () => {
    const { obs, lines } = capture();
    obs.loggerFor(CTX).log('info', 'engine.finished', {
      token: 'sk-live-secret',
      contentRaw: 'a customer requirement',
    });

    const line = lines[0] as string;
    expect(line).not.toContain('sk-live-secret');
    expect(line).not.toContain('a customer requirement');
    expect(line).toContain(REDACTED);
  });
});

describe('T656 · metrics reach the sink', () => {
  it('records a finished job with its terminal state and engine', () => {
    const { obs, sink } = capture();
    obs.metrics.jobFinished({
      state: 'succeeded',
      engineName: 'speckit',
      durationMs: 12,
    });

    expect(sink.recorded.map((m) => m.name)).toEqual(['job.finished', 'job.duration_ms']);
    expect(sink.recorded[0]?.attrs).toMatchObject({ state: 'succeeded', engine: 'speckit' });
  });

  it('carries the failure reason when there is one (SC-005)', () => {
    const { obs, sink } = capture();
    obs.metrics.jobFinished({
      state: 'failed',
      engineName: 'speckit',
      durationMs: 3,
      failureReason: 'engine_error',
    });

    expect(sink.recorded[0]?.attrs).toMatchObject({ reason: 'engine_error' });
  });
});
