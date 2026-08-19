/**
 * T662 — the API is observable PER REQUEST, not merely at startup.
 *
 * DEF-001-002. `T164` promised "metrics emission for API requests and
 * generation jobs"; `requestFinished` and `correlationFor` had zero production
 * call sites, because `main.ts` installed the bundle and then nothing ran at
 * the point where a route, a status and a duration are known.
 */
import { describe, expect, it } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { buildObservability, CORRELATION_HEADER, NullMetricSink } from '@pmi/observability';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpObservabilityInterceptor } from '../../../src/modules/observability/http-observability.interceptor.js';

const here = dirname(fileURLToPath(import.meta.url));

function code(path: string): string {
  return readFileSync(resolve(here, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const apiMain = code('../../../src/main.ts');

const UUID = '11111111-1111-4111-8111-111111111111';

function harness() {
  const lines: string[] = [];
  const sink = new NullMetricSink();
  const obs = buildObservability({ service: 'api', sink, write: (l) => lines.push(l) });
  return { obs, lines, sink, interceptor: new HttpObservabilityInterceptor(obs) };
}

/** A minimal stand-in for Nest's ExecutionContext. Nothing here needs Nest. */
function ctx(opts: { headers?: Record<string, unknown>; route?: string; status?: number } = {}) {
  const request = { headers: opts.headers ?? {}, route: { path: opts.route ?? '/v1/audit' } };
  const response = { statusCode: opts.status ?? 200 };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
}

describe('T662 · the interceptor is installed', () => {
  it('main.ts registers it globally', () => {
    // Without this the class is one more built-and-unreachable module, which is
    // the entire defect it was written to close.
    expect(apiMain).toMatch(/useGlobalInterceptors\s*\(/);
    expect(apiMain).toMatch(/HttpObservabilityInterceptor/);
  });
});

describe('T662 · correlation at the API edge (PC-3)', () => {
  it('adopts a valid inbound identifier so a trace spans the caller', async () => {
    const { interceptor, lines } = harness();

    await run(interceptor, ctx({ headers: { [CORRELATION_HEADER]: UUID } }));

    expect(JSON.parse(lines[0] as string)).toMatchObject({ correlationId: UUID });
  });

  it('mints one when the header is absent', async () => {
    const { interceptor, lines } = harness();

    await run(interceptor, ctx());

    expect(JSON.parse(lines[0] as string).correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses a malformed inbound identifier rather than propagating it', async () => {
    const { interceptor, lines } = harness();

    await run(interceptor, ctx({ headers: { [CORRELATION_HEADER]: 'not-a-uuid' } }));

    const id = JSON.parse(lines[0] as string).correlationId;
    expect(id).not.toBe('not-a-uuid');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts the identifier on the request so handlers downstream carry the same one', async () => {
    const { interceptor } = harness();
    const context = ctx();

    await run(interceptor, context);

    const req = context.switchToHttp().getRequest() as { correlationId?: string };
    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('T662 · request metrics reach the sink', () => {
  it('records the templated route and status', async () => {
    const { interceptor, sink } = harness();

    await run(interceptor, ctx({ route: '/v1/projects/:id', status: 200 }));

    expect(sink.recorded.map((m) => m.name)).toEqual(['http.request', 'http.duration_ms']);
    // A concrete id in a metric attribute multiplies the series by the number
    // of rows in the table.
    expect(sink.recorded[0]?.attrs).toMatchObject({ route: '/v1/projects/:id', status: '200' });
  });

  it('measures a FAILED request too, and does not swallow the error', async () => {
    const { interceptor, sink } = harness();
    const boom = new Error('handler exploded');

    await expect(run(interceptor, ctx({ status: 500 }), boom)).rejects.toThrow('handler exploded');

    // The requests worth measuring most are the ones that failed.
    expect(sink.recorded[0]?.attrs).toMatchObject({ status: '500' });
  });
});

/**
 * Drive the interceptor's pipeline to completion.
 *
 * A real `Observable`, not a hand-rolled subscribable: the interceptor calls
 * `.pipe()`, and a double that omits it tests the double rather than the code.
 */
async function run(
  interceptor: HttpObservabilityInterceptor,
  context: ReturnType<typeof ctx>,
  throws?: Error,
): Promise<unknown> {
  const next: CallHandler = {
    handle: () => (throws ? throwError(() => throws) : of('ok')),
  };

  return firstValueFrom(interceptor.intercept(context as unknown as ExecutionContext, next));
}
