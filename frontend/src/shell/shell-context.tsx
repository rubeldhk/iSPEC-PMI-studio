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
  /**
   * The set `EPIC-004` supplies, **and how the asking went**. The shell renders
   * it and decides nothing about its contents.
   *
   * A union rather than a list plus flags, because this state has now been
   * wrong twice. `T441u` split *loading* from *empty* using a boolean and left
   * **failed** collapsed into empty, which `FR-SHL-062` calls a defect in as
   * many words. Three states that cannot be held simultaneously are three
   * variants; two booleans beside a list are four combinations, one of which is
   * a lie.
   *
   * Same shape as `HomeModel.sources` for the same reason: make the absence
   * part of the type, so it has to be rendered or deliberately discarded.
   */
  readonly projectSet: ProjectSetState;
  /** Convenience for consumers that only need the contents. Never a claim. */
  readonly projects: readonly Project[];
  readonly selectProject: (projectId: string | null) => void;
}

export type ProjectSetState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly projects: readonly Project[] }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * The set when nobody is signed in — `T442i`, third convergence pass (`F2`).
 *
 * **Not `ready` with an empty list.** That reads *"we asked, and this workspace
 * has none"*, about a workspace that does not exist and a request never made.
 * `loading` is the true statement: no answer yet, because nothing has been
 * asked.
 *
 * The difference is invisible today — `T442h` signs in for real and shows that
 * React commits the identity and the fetch together, so `ContextBar` never sees
 * the stale value. That test is a regression guard, not the reason for this
 * constant. **The reason is that the union's whole claim is that no variant is
 * a lie**, and `loading` and `failed` were each unreachable-but-wrong for
 * exactly one round before becoming reachable-and-wrong.
 */
export const NO_IDENTITY_PROJECT_SET: ProjectSetState = Object.freeze({ kind: 'loading' });

/** The contents, whatever state the set is in. */
export function projectsOf(state: ProjectSetState): readonly Project[] {
  return state.kind === 'ready' ? state.projects : [];
}

const ShellContextObject = createContext<ShellContextValue | null>(null);

export interface ShellProviderProps
  extends Omit<ShellContextValue, 'workspaceId' | 'projects'> {
  children: ReactNode;
}

export function ShellProvider({
  api,
  identity,
  projectId,
  projectSet,
  selectProject,
  children,
}: ShellProviderProps): ReactElement {
  const value = useMemo<ShellContextValue>(
    () => ({
      api,
      identity,
      workspaceId: identity?.workspace.id ?? null,
      projectId,
      projectSet,
      // Derived, so `projects` and `projectSet` cannot disagree.
      projects: projectsOf(projectSet),
      selectProject,
    }),
    [api, identity, projectId, projectSet, selectProject],
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

/**
 * Addresses whose scope comes from **their own identifier**, not from the
 * project selector — `T442e`, second convergence pass (`F3`).
 *
 * `/runs/:runId` shows one run. The shell cannot say which project that run
 * belongs to without fetching, and `FR-SHL-003` says the shell does not fetch
 * domain data. So it has three options and only one is honest:
 *
 *   - name the selected project — a guess, and `F1` again with better odds:
 *     the run may belong to another project entirely;
 *   - say "No project selected" — implies the page is unscoped when it is
 *     scoped, by the address the user followed;
 *   - **say where the scope came from.**
 *
 * Requiring a project instead, as `TasksView` does, was rejected: it makes
 * *"send me the link"* unanswerable, which is the thing `FR-SHL-017` exists to
 * fix.
 *
 * **Explicit, not a prefix rule.** `/specifications/:id/tasks` sits under the
 * same area and IS project-scoped, because `TasksPage` needs a project. Two
 * sub-views of one area, scoped differently — a rule over path shape would get
 * one of them wrong. `T442d` asserts this list against the route table.
 */
export const ADDRESS_SCOPED_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\/specifications\/[^/]+$/,
  /^\/runs\/[^/]+$/,
]);

export function isAddressScoped(pathname: string): boolean {
  return ADDRESS_SCOPED_PATTERNS.some((pattern) => pattern.test(pathname));
}

/** The current project, resolved from the set `EPIC-004` supplies. */
export function useCurrentProject(): Project | null {
  const { projectId, projects } = useShell();
  return projects.find((project) => project.id === projectId) ?? null;
}
