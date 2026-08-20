/**
 * T834 · `DEF-001-004` — a failed request must be reported with the status the
 * caller actually received.
 *
 * **Why this is an integration test and not a unit test.** `T662`'s unit suite
 * already asserts that a failing request is measured — and it passes today,
 * while the defect ships. Its fake context is constructed as
 * `ctx({ status: 500 })`, so the stand-in response *already carries 500* before
 * the handler throws. Express does not: at the moment the interceptor's error
 * arm runs, `statusCode` is still 200, because Nest's exception filter has not
 * mapped the exception yet.
 *
 * A fake can be given any status; only the real pair — interceptor plus
 * `ErrorFilter`, over a real HTTP server — can show which one arrives first.
 * That ordering is the whole defect, so this file is the only place a test can
 * fail for it.
 *
 * Requires no database: the fault lives entirely at the transport seam.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { buildObservability, NullMetricSink } from '@pmi/observability';
import { ErrorFilter } from '../../src/core/error.filter.js';
import { HttpObservabilityInterceptor } from '../../src/modules/observability/http-observability.interceptor.js';
import { UnauthenticatedError } from '../../src/core/errors.js';

/** Routes that fail the two ways the taxonomy distinguishes. */
@Controller('probe')
class ProbeController {
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }

  /** A PlatformError the filter maps to 401. */
  @Get('unauthenticated')
  unauthenticated(): never {
    throw new UnauthenticatedError('Invalid email or password.');
  }

  /** Anything else: the filter maps it to 500 and hides its text. */
  @Get('boom')
  boom(): never {
    throw new Error('a connection string must never reach the client');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

const lines: string[] = [];
const sink = new NullMetricSink();
let app: INestApplication;
let base = '';

beforeAll(async () => {
  const observability = buildObservability({
    service: 'api-test',
    sink,
    write: (l) => lines.push(l),
  });

  // The same three installations `main.ts` performs, in the same order. If that
  // wiring changes, this test should change with it — deliberately not mocked.
  app = await NestFactory.create(ProbeModule, { logger: false });
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalInterceptors(new HttpObservabilityInterceptor(observability));
  app.setGlobalPrefix('v1');

  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
}, 60_000);

afterAll(async () => {
  await app?.close();
});

/** The log record this request produced, parsed. */
function recordFor(route: string): { status: number; level: string; msg: string } {
  const found = lines
    .map((l) => JSON.parse(l) as { route?: string; status: number; level: string; msg: string })
    .filter((r) => r.msg === 'http.request' && r.route?.endsWith(route));
  expect(found.length, `no http.request record for ${route}`).toBeGreaterThan(0);
  return found[found.length - 1]!;
}

describe('T834 · DEF-001-004 · the reported status is the status the caller received', () => {
  it('reports 200 for a request that succeeded', async () => {
    // The control. If this ever fails, the defect is not what this file says.
    const res = await fetch(`${base}/v1/probe/ok`);
    expect(res.status).toBe(200);
    expect(recordFor('/ok').status).toBe(200);
  });

  it('reports 401 — not 200 — for a refused request', async () => {
    const res = await fetch(`${base}/v1/probe/unauthenticated`);
    expect(res.status, 'the caller must receive 401').toBe(401);

    const record = recordFor('/unauthenticated');
    expect(
      record.status,
      'the interceptor recorded a status the caller never saw: reading response.statusCode on the ' +
        'error arm reads it before ErrorFilter has mapped the exception (DEF-001-004)',
    ).toBe(401);
  });

  it('reports 500 for an unexpected failure', async () => {
    const res = await fetch(`${base}/v1/probe/boom`);
    expect(res.status).toBe(500);
    expect(recordFor('/boom').status).toBe(500);
  });

  it('meters the failed request with the real status, so an error rate can exist', async () => {
    // The metric is the half with no other witness: a dashboard built on
    // `requestFinished` reads flat at zero while the API refuses every call.
    await fetch(`${base}/v1/probe/unauthenticated`);

    const metered = sink.recorded.filter((m) =>
      String((m.attrs as Record<string, unknown>)['route'] ?? '').endsWith('/unauthenticated'),
    );
    expect(metered.length).toBeGreaterThan(0);
    expect(metered[metered.length - 1]?.attrs).toMatchObject({ status: '401' });
  });

  it('logs a 500 at error level and a 401 at info', async () => {
    // T836 asserts this at unit level too. It is here as well because the level
    // is derived from the same value the defect corrupts: with status stuck at
    // 200, a 500 was logged at `info` and no alert built on level could fire.
    await fetch(`${base}/v1/probe/boom`);
    await fetch(`${base}/v1/probe/unauthenticated`);

    expect(recordFor('/boom').level).toBe('error');
    expect(recordFor('/unauthenticated').level).toBe('info');
  });
});
