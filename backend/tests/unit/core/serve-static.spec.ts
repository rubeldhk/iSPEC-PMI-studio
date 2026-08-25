/**
 * T150c (EPIC-014 F-11.3) — the API serves the client, with `/v1` excluded.
 *
 * `R-014-1`: one image, one origin, one port. The client never prefixes an
 * absolute API host — in development `vite.config.ts`'s `server.proxy` makes
 * two servers look like one origin, and the containerised stack must reproduce
 * **that topology**, not merely that behaviour. Otherwise the client needs a
 * base-URL concept it does not have, and this Epic has no standing to add one.
 *
 * ## The two halves, and why each is asserted separately
 *
 * **Unknown paths must return the application.** `ServeStaticModule`'s default
 * `renderPath` is `'*'`, which sends `index.html` for anything it does not
 * match — the SPA history fallback. That single behaviour is the whole of
 * `R-036-3`: `EPIC-036` could not prove deep links survive a refresh because
 * nothing in this repository served the built client, and `EPIC-029`'s UAT had
 * to hand-roll a static server with its own `/v1` proxy in a scratchpad.
 *
 * **`/v1` must NOT be swallowed.** An `exclude` that is missing or too narrow
 * turns every API call into `index.html` with a `200` — the worst possible
 * failure, because the client receives HTML where it expects JSON and reports
 * a parse error three layers from the cause.
 *
 * ## What this file deliberately does not do
 *
 * It does not boot the whole Nest application. `AppModule` opens a Prisma
 * client at import time, so a unit test that instantiated it would need a
 * database — which would make a configuration check depend on infrastructure
 * and turn a fast red into a flaky one. It reads the composed module
 * definition instead, which is where the mistake would actually live.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_MODULE = join(BACKEND, 'src', 'app.module.ts');

function appModule(): string {
  return readFileSync(APP_MODULE, 'utf8');
}

describe('T150c · the client is served from the API', () => {
  it('AppModule imports ServeStaticModule', () => {
    // Written before `T150g` wires it, so this is RED first.
    expect(
      appModule(),
      'AppModule does not import ServeStaticModule — the client is not served by the API, ' +
        'so a deep link still 404s outside the Vite dev server (R-036-3)',
    ).toMatch(/ServeStaticModule/);
  });

  it('and configures it with a rootPath', () => {
    expect(appModule(), 'ServeStaticModule has no rootPath — nothing would be served').toMatch(
      /rootPath\s*:/,
    );
  });

  it('excludes the API prefix, so /v1 is not swallowed by the static handler', () => {
    const source = appModule();
    const exclude = /exclude\s*:\s*\[([^\]]*)\]/.exec(source);
    expect(
      exclude,
      'ServeStaticModule has no `exclude` — every /v1 request would return index.html with a 200, ' +
        'and the client would report a JSON parse error three layers from the cause',
    ).not.toBeNull();
    expect(
      exclude![1],
      `the exclude list does not mention /v1: ${exclude![1]}`,
    ).toMatch(/\/v1/);
  });

  it('and the pattern actually MATCHES an API path, run through the loader’s own matcher', () => {
    // **The assertion above passed over two shipped faults**, because
    // "mentions /v1" was never the requirement — matching is.
    //
    // `/v1{*splat}` (Express 5 syntax) and then `/v1*` both looked correct, and
    // neither matches under `path-to-regexp@0.2.5`, which is what
    // `@nestjs/serve-static@4` actually uses. A non-matching pattern does not
    // throw; it excludes nothing, and every unmatched `/v1` path returns
    // `index.html` with a `200`.
    //
    // So this does not reason about syntax. It loads the **same matcher the
    // loader loads** and runs the **same comparison the loader runs** —
    // `re.exec(pathname + '/')`, from `dist/utils/is-route-excluded.util.js`.
    const loader = realpathSync(
      join(BACKEND, 'node_modules', '@nestjs', 'serve-static'),
    );
    const req = createRequire(join(loader, 'dist', 'utils', 'is-route-excluded.util.js'));
    const pathToRegexp = req('path-to-regexp') as (p: string) => RegExp;

    const patterns = /exclude\s*:\s*\[([^\]]*)\]/
      .exec(appModule())![1]!.split(',')
      .map((p) => p.trim().replace(/^['"]|['"]$/g, ''))
      .filter((p) => p !== '');

    const excludes = (pathname: string): boolean =>
      patterns.some((p) => pathToRegexp(p).exec(`${pathname}/`) !== null);

    // Excluded — these must reach the API.
    expect(excludes('/v1/auth/me'), 'the API would be swallowed by the static handler').toBe(true);
    expect(
      excludes('/v1/no-such-endpoint'),
      'an unmatched API path returns index.html with a 200 instead of the API’s own answer — ' +
        'which also hides DEF-001-006 rather than leaving it visible',
    ).toBe(true);

    // NOT excluded — these must fall through to the SPA history fallback.
    expect(excludes('/runs'), 'a routed client address is excluded — the deep link would 404').toBe(
      false,
    );
    expect(excludes('/'), 'the client root is excluded').toBe(false);
    expect(excludes('/assets/index.js'), 'client assets are excluded').toBe(false);
  });

  it('does NOT override renderPath — the default is the history fallback', () => {
    // `renderPath` defaults to '*', which is exactly the SPA behaviour wanted.
    // Setting it to anything narrower silently removes the fallback while
    // leaving every other assertion here green, so the absence is asserted.
    expect(
      appModule(),
      'renderPath is set explicitly — the default `*` IS the history fallback R-036-3 needs, ' +
        'and narrowing it removes deep-link support without failing anything else',
    ).not.toMatch(/renderPath\s*:/);
  });
});

describe('T150c · the client build the API serves', () => {
  it('vite emits to a path the API can reach, and declares no base prefix', () => {
    // `frontend/vite.config.ts` sets neither `base` nor `build.outDir`, so the
    // defaults apply: base `/` and `dist/`. Served from the API root, that is
    // correct — and a `base` added later would break every asset URL while the
    // page itself still loaded, so its absence is worth pinning.
    const vite = readFileSync(join(BACKEND, '..', 'frontend', 'vite.config.ts'), 'utf8');
    expect(vite, 'vite declares a base prefix — assets would 404 when served from the API root')
      .not.toMatch(/^\s*base\s*:/m);
  });

  it('the API still proxies nothing — one origin means there is nothing to proxy', () => {
    // `vite.config.ts`'s server.proxy is DEV ONLY and stays. What must not
    // appear is a second proxy in the API, which would be a second copy of the
    // `/v1` convention (contracts/container-stack.md §6).
    expect(existsSync(APP_MODULE)).toBe(true);
    expect(appModule(), 'the API declares a proxy — /v1 is served directly here, not forwarded')
      .not.toMatch(/createProxyMiddleware|http-proxy/);
  });
});
