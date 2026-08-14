/**
 * T656 — observability is installed by the bootstraps, not merely implemented.
 *
 * Convergence found `logger.ts`, `correlation.ts` and `metrics.ts` fully built,
 * fully tested, and referenced by NOTHING outside their own specs — while
 * `spec.md` claims *"PP-010 Observability by Default · ✅ Satisfied here for the
 * whole platform."* At runtime nothing emitted a log, a metric, or a correlation
 * identifier.
 *
 * These assertions are about INSTALLATION. `logging.spec.ts`,
 * `correlation.spec.ts` and `metrics.spec.ts` already prove the modules behave;
 * none of them can see whether a process ever calls them.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildObservability, NullMetricSink } from '../../../src/core/observability/bootstrap.js';
import { CORRELATION_HEADER } from '../../../src/core/observability/correlation.js';
import { REDACTED } from '../../../src/core/observability/logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const apiMain = readFileSync(resolve(here, '../../../src/main.ts'), 'utf8');

const CTX = { workspaceId: 'ws', actorId: 'u1', correlationId: 'cid-1' };

function capture() {
  const lines: string[] = [];
  const sink = new NullMetricSink();
  const obs = buildObservability({ service: 'api', sink, write: (l) => lines.push(l) });
  return { obs, lines, sink };
}

describe('T656 · the API bootstrap installs observability', () => {
  it('main.ts builds the observability bundle', () => {
    // The whole finding: without this the three modules are dead code.
    expect(apiMain).toMatch(/buildObservability/);
  });

  it('main.ts emits a startup record, so a running API proves it is wired', () => {
    expect(apiMain).toMatch(/loggerFor/);
  });
});

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
