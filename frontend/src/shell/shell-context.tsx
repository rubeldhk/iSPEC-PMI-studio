/**
 * T438f (EPIC-036) — `ShellContext`: what the user is looking at.
 *
 * Session state, lost on sign-out, which is correct — it is scoped to an
 * identity. Two fields are held and one is **derived**:
 *
 *   workspaceId  from the signed-in identity (`GET /v1/auth/me`, `BR-0001`)
 *   projectId    the current project, or null
 *   areaId       DERIVED from the address, never stored beside it
 *
 * Holding `areaId` would be two answers to *"where am I"*, and they disagree
 * the first time somebody uses the back button. `EPIC-033` applied the same
 * reasoning to `BaselineReadiness`: derive, so there is no invalidation path.
 *
 * **The selectable set is not modelled here** (`FR-SHL-025`). `EPIC-004` owns
 * workspace scoping and supplies what may be selected; this shell renders the
 * control. `prototype-parity.md` declines the selector to the shell precisely
 * because *"the shell may not invent its selector"*.
 *
 * Unit tests: `frontend/tests/unit/shell/shell-context.spec.tsx` (T438e).
 */
import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { AREAS, type Area } from './areas';
import type { ApiClient, Project, WhoAmI } from '../services/api';

export interface ShellContextValue {
  readonly api: ApiClient;
  /** Null until `me()` resolves; the router does not render areas before then. */
  readonly identity: WhoAmI | null;
  /** `BR-0001` — every data-bearing screen scopes to this. */
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  /** The set `EPIC-004` supplies. The shell renders it and decides nothing. */
  readonly projects: readonly Project[];
  /**
   * Whether that set is still being fetched (`T441u`, convergence finding
   * `F3`).
   *
   * An empty `projects` means two different things — *"the workspace has none"*
   * and *"we have not been told yet"* — and the selector rendered them
   * identically. `DEF-007-001` is the same ambiguity one layer down. Carrying
   * the distinction here is what lets the control state which one it is.
   */
  readonly projectsLoading: boolean;
  readonly selectProject: (projectId: string | null) => void;
}

const ShellContextObject = createContext<ShellContextValue | null>(null);

export interface ShellProviderProps extends Omit<ShellContextValue, 'workspaceId'> {
  children: ReactNode;
}

export function ShellProvider({
  api,
  identity,
  projectId,
  projects,
  projectsLoading,
  selectProject,
  children,
}: ShellProviderProps): ReactElement {
  const value = useMemo<ShellContextValue>(
    () => ({
      api,
      identity,
      workspaceId: identity?.workspace.id ?? null,
      projectId,
      projects,
      projectsLoading,
      selectProject,
    }),
    [api, identity, projectId, projects, projectsLoading, selectProject],
  );
  return <ShellContextObject.Provider value={value}>{children}</ShellContextObject.Provider>;
}

export function useShell(): ShellContextValue {
  const value = useContext(ShellContextObject);
  if (value === null) {
    // Loud rather than undefined-shaped. A component rendered outside the shell
    // would otherwise read `null` for the workspace and quietly show another
    // tenant's emptiness — the silent failure `BR-0001` is about.
    throw new Error('useShell was called outside a ShellProvider');
  }
  return value;
}

/**
 * The area the address is in, or undefined for an address that names none.
 *
 * Longest-path-first, so `/projects/:id` resolves to Projects rather than to
 * Home. Root is exact: `/` must not swallow every address.
 */
export function areaForPathname(pathname: string): Area | undefined {
  const candidates = [...AREAS].sort((a, b) => b.path.length - a.path.length);
  return candidates.find((area) =>
    area.path === '/' ? pathname === '/' : pathname === area.path || pathname.startsWith(`${area.path}/`),
  );
}

/** `FR-SHL-012`, `FR-SHL-023` — derived per read, never held. */
export function useCurrentArea(): Area | undefined {
  const { pathname } = useLocation();
  return areaForPathname(pathname);
}

/**
 * The project an address names, when it names one — otherwise null.
 *
 * `T441q`, from the convergence finding `F1`. Reaching a project by **clicking**
 * selects it on the way; reaching it by **address** did not, so a deep link to
 * `/projects/:projectId` rendered that project under a breadcrumb reading
 * *"No project selected"*. `FR-SHL-017` added deep links in this very Epic, so
 * the entry path that broke `FR-SHL-021` is one this Epic created.
 *
 * The failure was not a missing breadcrumb. It was a breadcrumb that **said
 * something false about the screen beside it** — and `BR-0001`'s failure mode
 * is precisely a plausible screen.
 *
 * **The address wins.** When it carries a project, that is what the user is
 * looking at, and any session selection disagreeing with it is stale. When it
 * carries none, the session selection stands — which is what lets Runs and
 * Specifications stay scoped after the user leaves the project view.
 */
export function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)/.exec(pathname);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}

/** The current project, resolved from the set `EPIC-004` supplies. */
export function useCurrentProject(): Project | null {
  const { projectId, projects } = useShell();
  return projects.find((project) => project.id === projectId) ?? null;
}
