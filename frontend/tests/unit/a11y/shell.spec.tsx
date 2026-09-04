/**
 * T930 (EPIC-029, Phase 10) — the harness over the COMPOSED APPLICATION SHELL
 * (FR-DS-031, SC-DS-001).
 *
 * Why this file had to exist. Since `T923` the shell renders a `banner`
 * landmark, a breadcrumb and the theme control **on every page** — and nothing
 * scanned it:
 *
 *   - `pages.spec.tsx` (T883) renders each page component in isolation, inside
 *     its own `<main>` host. The shell is not in that tree.
 *   - `components.spec.tsx` (T894) sweeps the fifteen inventory rows. The
 *     shell is not a component.
 *   - `app-root.spec.tsx` (T899a) and `prototype-parity.spec.tsx` (T924) are
 *     the only files that mount `App` at all, and neither imports the harness.
 *
 * So the one surface a user cannot avoid was the one surface no accessibility
 * rule had ever examined. `T914` asked for exactly this ("extend T883's
 * page-level assertions to the shell") and Phase 9 shipped the shell without
 * it — the fourth built-but-unexercised finding in this Epic.
 *
 * This file mounts the REAL entry module's `App`, so what is scanned is the
 * composed tree — shell landmark, page content and all — not a reproduction
 * of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// EPIC-036 `T441q` — `App` now requires a Router in EVERY branch, not only the
// signed-in one. It reads the address to keep the shell's project selection
// honest against a deep link (convergence `F1`), so `useLocation` runs before
// the sign-in branch is chosen. Mounting it bare was always a half-truth: the
// signed-in branch has rendered `ShellRoutes` since `T437f`.
import { expectNoViolations, runWcag } from './axe';
import { App } from '../../../src/main';
import type { ApiClient, Project, WhoAmI } from '../../../src/services/api';

const project = {
  id: 'p1',
  workspaceId: 'ws_a',
  name: 'Platform',
  description: null,
  status: 'active',
  engineName: null,
  ownerUserId: 'u1',
  archivedAt: null,
  rootPath: null,
  agentIntegration: null,
  scriptType: null,
  provisioningState: 'not_provisioned',
  provisionedAt: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
} as Project;

/** No live session: the shell resolves to sign-in. */
const signedOut = {
  me: async (): Promise<never> => {
    throw new Error('no session');
  },
} as unknown as ApiClient;

/**
 * A live session: the shell resolves to Projects, and the breadcrumb moves.
 *
 * `me` is typed `Promise<WhoAmI>` deliberately, so the compiler checks this
 * stub against the real contract. `DEF-029-006` was exactly a stub of the
 * wrong shape laundered through `as unknown as`, which made the page throw
 * mid-render while the test went on passing — the cast is what hid it.
 */
const signedIn = {
  me: async (): Promise<WhoAmI> => ({
    user: { id: 'u1', email: 'uat@pmi.test', displayName: 'UAT' },
    workspace: { id: 'ws_a' },
  }),
  listProjects: vi.fn(async () => [project]),
} as unknown as ApiClient;

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset['theme'];
  window.localStorage.clear();
});

beforeEach(() => {
  delete document.documentElement.dataset['theme'];
  window.localStorage.clear();
});

// ---------------------------------------------------------------------------
// T930 — the shell, in the view states it actually has
// ---------------------------------------------------------------------------

describe('T930 · the composed shell passes the WCAG 2.2 AA harness', () => {
  it('signed out — the shell above the sign-in page', async () => {
    render(
      <MemoryRouter>
        <App api={signedOut} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    await expectNoViolations();
  });

  // EPIC-036 `T437f` moved what the top bar says. It read "PMI Studio /
  // Projects" from a `useState` view union; it now reads the breadcrumb
  // `UX-0012` requires — workspace, project, area — derived from the address.
  // The signed-in landing is Home rather than Projects for the same reason:
  // there are areas now, and one of them is the front door.
  //
  // The assertion is stronger than the one it replaces, not weaker: it checks
  // both halves of the scope `BR-0001` is about, where the old one checked a
  // single page name.
  it('signed in — the shell above Home, breadcrumb naming workspace and area', async () => {
    // The breadcrumb's area segment is derived from the address
    // (`FR-SHL-017`), which is why this one names an entry explicitly rather
    // than taking the router's default.
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App api={signedIn} />
      </MemoryRouter>,
    );
    await screen.findByText('Platform');
    const location = container.querySelector('.ds-topbar__location')?.textContent ?? '';
    expect(location, 'the breadcrumb names no workspace').toContain('ws_a');
    expect(location, 'the breadcrumb names no area').toContain('Home');
    await expectNoViolations();
  });

  it('with an explicit theme override applied at the root', async () => {
    // The override path writes `data-theme` on <html>, which is the one thing
    // a theme can change about the DOM the harness sees. Contrast itself is
    // NOT axe's here and never was: jsdom computes no layout, so
    // `color-contrast` is disabled in the harness and the token pairs are
    // computed instead, in tests/governance/design-tokens.spec.ts (T872,
    // R-029-3). Scanning "both themes" with axe would otherwise be a loop that
    // cannot fail, which this Epic treats as decoration.
    window.localStorage.setItem('pmi.theme', 'dark');
    render(
      <MemoryRouter>
        <App api={signedOut} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    await expectNoViolations();
  });

  it('the shell region itself is scanned, not merely the page inside it', async () => {
    const { container } = render(
      <MemoryRouter>
        <App api={signedOut} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    const topbar = container.querySelector('.ds-topbar');
    expect(topbar, 'the composed app rendered no .ds-topbar to scan').not.toBeNull();
    await expectNoViolations(topbar as Element);
  });
});

// ---------------------------------------------------------------------------
// T930 MUTATION — the scan can fail, and fails ON THE SHELL
// ---------------------------------------------------------------------------

describe('T930 · MUTATION — a violation planted in the shell is caught', () => {
  it('an unlabelled control injected into the REAL rendered top bar fails the scan', async () => {
    const { container } = render(
      <MemoryRouter>
        <App api={signedOut} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    const topbar = container.querySelector('.ds-topbar') as HTMLElement;

    // Injected into the live shell DOM, not into a copy of its markup: this is
    // what makes the mutation evidence that THIS scan reaches THAT element.
    const orphan = document.createElement('input');
    orphan.type = 'text';
    topbar.appendChild(orphan);

    const results = await runWcag(document.body);
    const ids = results.violations.map((v) => v.id);
    expect(ids, 'the shell scan reported nothing for an unlabelled control in the top bar').toContain(
      'label',
    );

    topbar.removeChild(orphan);
  });

  it('and passes again once the violation is removed — the failure was the input, not the shell', async () => {
    render(
      <MemoryRouter>
        <App api={signedOut} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    await expectNoViolations();
  });
});
