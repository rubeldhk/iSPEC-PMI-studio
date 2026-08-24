/**
 * Web shell — the application root.
 *
 * T437f (EPIC-036) replaced the `useState` view union this file had carried
 * since `T003`. The comment it left behind said *"a router arrives with
 * EPIC-010's full specification interface"*. It did not: `EPIC-010` routed five
 * unreachable pages onto a corridor of buttons (`T200e`, `DEF-010-001`), which
 * was the smallest thing that made them reachable and visibly not a product.
 * **The router arrives here**, and `BR-0190` — *"core lifecycle capabilities
 * MUST be navigable as one coherent application"* — is the requirement it
 * satisfies.
 *
 * What stays: one `ApiClient` whose 401 handler returns to sign-in
 * (`T057`/`T058`), `me()` on load to restore a live session, and the stylesheet
 * imports below.
 *
 * What changed: the address bar is now the source of truth for where you are.
 * `App` deliberately does **not** contain the router, so tests can drive it at
 * any address through a `MemoryRouter` and still exercise the real route tree.
 *
 * Unit tests: `frontend/tests/unit/shell/app-entry.spec.tsx` (T437e).
 */
// T866 (EPIC-029) — the ONE import point for the design system's stylesheets,
// so no page can forget them. Removing either line renders every page unstyled
// while every isolated component test stays green; stylesheet-installed.spec.tsx
// (T866a) and app-root.spec.tsx (T899a) both exist to make that removal fail.
import './design/tokens.css';
import './design/themes.css';
import './design/components/components.css';
import './shell/shell.css';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router';
import { initTheme } from './design/theme';
import { ThemeControl } from './design/ThemeControl';
import { LoadingIndicator } from './design/components/LoadingIndicator';
import { SignIn } from './pages/SignIn';
import { ContextBar } from './shell/ContextBar';
import {
  NO_IDENTITY_PROJECT_SET,
  ShellProvider,
  projectIdFromPathname,
  type ProjectSetState,
} from './shell/shell-context';
import { ShellRoutes } from './shell/routes';
import { ApiClient, type WhoAmI } from './services/api';

/**
 * The application, minus the router.
 *
 * Sign-in is outside the shell on purpose: an unauthenticated visitor has no
 * workspace, so a breadcrumb reading `workspace / project / area` would have
 * nothing true to say in any of its three segments.
 */
export function App({ api: injected }: { api?: ApiClient } = {}): ReactElement {
  const [identity, setIdentity] = useState<WhoAmI | null>(null);
  /**
   * The selectable set and how the asking went — one value, three states.
   *
   * This has been wrong twice. First a bare list, which could not tell
   * *"loading"* from *"empty"*. Then a list plus a boolean, which could not
   * tell *"failed"* from *"empty"* — and a separate flag also had a lifecycle
   * of its own, briefly reading `false` before the fetch had started. A union
   * has neither problem: there is no combination to get wrong, and the failure
   * cannot be dropped without deleting a branch somebody has to look at.
   */
  const [projectSet, setProjectSet] = useState<ProjectSetState>({ kind: 'loading' });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  const api = useMemo(
    () =>
      injected ??
      new ApiClient({
        onSessionExpired: (): void => {
          setIdentity(null);
          setProjectId(null);
        },
      }),
    [injected],
  );

  // T913 — restore a stored theme override before anything paints. Without
  // this call the override in `design/theme.ts` is unreachable code and the
  // application can only ever follow the OS (convergence finding F1).
  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    let live = true;
    void (async (): Promise<void> => {
      try {
        const who = await api.me();
        if (live) setIdentity(who);
      } catch {
        if (live) setIdentity(null);
      } finally {
        if (live) setRestoring(false);
      }
    })();
    return (): void => {
      live = false;
    };
  }, [api]);

  // The selectable set comes from `EPIC-004`'s scoping, not from the shell
  // (`FR-SHL-025`). The shell asks for it and renders it; it decides nothing
  // about what may be in it.
  useEffect(() => {
    let live = true;
    if (identity === null) {
      // Not `ready, []` — see `NO_IDENTITY_PROJECT_SET`. There is no workspace
      // to have no projects.
      setProjectSet(NO_IDENTITY_PROJECT_SET);
      return (): void => {
        live = false;
      };
    }
    setProjectSet({ kind: 'loading' });
    void api
      .listProjects()
      .then((loaded) => {
        if (live) setProjectSet({ kind: 'ready', projects: loaded });
      })
      .catch((error: unknown) => {
        // `FR-SHL-062` — a failed set reports as failed. It used to land in an
        // empty list, which reads as "this workspace has no projects": a
        // statement about the workspace, made because a request did not come
        // back. No `finally` here, because there is nothing left to reset.
        if (live)
          setProjectSet({
            kind: 'failed',
            reason: error instanceof Error ? error.message : 'The projects service did not answer.',
          });
      });
    return (): void => {
      live = false;
    };
  }, [api, identity]);

  const selectProject = useCallback((next: string | null): void => {
    setProjectId(next);
  }, []);

  // T441q (EPIC-036 convergence, `F1` — not `EPIC-029`'s F1 above) — the
  // address is the stronger claim about which project the
  // user is looking at. Reaching a project by clicking selects it on the way;
  // reaching it by address did not, so a deep link rendered a project under a
  // breadcrumb reading "No project selected". `FR-SHL-021` asks for the scope
  // to be VISIBLE rather than implied, and a scope that is visibly wrong is
  // worse than one that is absent.
  //
  // This sits beside the state it corrects rather than inside the shell: the
  // shell derives what it shows, and `App` owns what is selected.
  const { pathname } = useLocation();
  const addressProjectId = projectIdFromPathname(pathname);
  useEffect(() => {
    if (addressProjectId !== null) setProjectId(addressProjectId);
  }, [addressProjectId]);

  // `EPIC-029`'s adopted frame — prototype parity row 10, held by `T924` and
  // scanned by `T930`. The theme control sits in it rather than inside the
  // shell deliberately: `FR-DS-011` grants the override to the user of the
  // application, not to one page, so it must be reachable from every one of
  // them — including sign-in, where there is no shell yet.
  const frame = (location: ReactElement, content: ReactElement): ReactElement => (
    <div className="ds-shell">
      <header className="ds-topbar">
        {location}
        <div className="ds-topbar__actions">
          <ThemeControl />
        </div>
      </header>
      <div className="ds-content">{content}</div>
    </div>
  );

  if (restoring) {
    return frame(
      <p className="ds-topbar__location">
        <span className="ds-topbar__location-context">PMI Studio / </span>Loading
      </p>,
      <LoadingIndicator label="Restoring your session…" />,
    );
  }

  if (identity === null) {
    return frame(
      <p className="ds-topbar__location">
        <span className="ds-topbar__location-context">PMI Studio / </span>Sign in
      </p>,
      <SignIn
        api={api}
        onSignedIn={(who): void => {
          setIdentity(who);
        }}
      />,
    );
  }

  return (
    <ShellProvider
      api={api}
      identity={identity}
      projectId={projectId}
      projectSet={projectSet}
      selectProject={selectProject}
    >
      {frame(<ContextBar />, <ShellRoutes />)}
    </ShellProvider>
  );
}

const el = document.getElementById('root');
if (el)
  createRoot(el).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
