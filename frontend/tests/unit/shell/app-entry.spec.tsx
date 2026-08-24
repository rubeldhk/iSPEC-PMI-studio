/**
 * T437e (EPIC-036) — the application root is a router now.
 *
 * `main.tsx` held a `useState<View>` union from `T003` until this Epic, and the
 * comment beside it said *"a router arrives with EPIC-010's full specification
 * interface"*. It did not arrive; `EPIC-010` routed five unreachable pages onto
 * buttons (`T200e`). **The assertion here is that the union is gone**, because
 * a shell with both a router and a view union would have two answers to *"where
 * am I"* and they would disagree on the first back button.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderAt, stubApi } from './harness';

const MAIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src', 'main.tsx');

afterEach(cleanup);

/** Source with comments and string literals stripped — `T337s`'s precedent. */
function code(): string {
  return readFileSync(MAIN, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

describe('T437e · the view union is gone', () => {
  it('reads the real entry module, or this check proves nothing', () => {
    expect(code().length).toBeGreaterThan(500);
    expect(code()).toContain('export function App');
  });

  it('declares no View union and switches on no view kind', () => {
    const source = code();
    expect(source, 'main.tsx still declares a View union').not.toMatch(/\btype\s+View\b/);
    expect(source, 'main.tsx still switches on a view kind').not.toMatch(/switch\s*\(\s*view\./);
    expect(source, 'main.tsx still holds the location in state').not.toMatch(/useState<View>/);
  });

  it('mounts the router at the production root', () => {
    // The router belongs OUTSIDE `App`, so tests can drive the real tree at
    // any address. This asserts production still gets one.
    const source = code();
    expect(source).toContain('BrowserRouter');
    expect(source).toContain('createRoot');
  });

  it('imports from react-router, not react-router-dom', () => {
    // v7 supersedes `react-router-dom` (`R-036-1`, `D-13`). Training-era
    // knowledge gets this wrong, and the wrong import resolves to a package
    // that is not installed — a build failure rather than a silent one, but
    // worth asserting where the reason is written down.
    expect(readFileSync(MAIN, 'utf8')).not.toContain('react-router-dom');
  });
});

describe('T437e · what the root renders', () => {
  it('resolves to sign-in with no session, and shows no shell', async () => {
    renderAt('/', stubApi({ signedIn: false }));
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDefined();
    // An unauthenticated visitor has no workspace, so a breadcrumb reading
    // `workspace / project / area` would have nothing true to say.
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('resolves to the shell with a session, at the address given', async () => {
    renderAt('/runs');
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Runs'),
    );
  });

  it('keeps the theme control reachable on every screen (FR-DS-011)', async () => {
    // It sits in `EPIC-029`'s top bar rather than inside the shell, because
    // the override belongs to the user of the application and not to one page
    // — including sign-in, where there is no shell yet.
    renderAt('/', stubApi({ signedIn: false }));
    await screen.findByRole('button', { name: /sign in/i });
    expect(screen.getByLabelText(/theme/i)).toBeDefined();
  });
});
