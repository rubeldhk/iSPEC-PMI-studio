/**
 * Web shell (T003) — pages arrived with EPIC-005/006/007 when PMI-DOC-004
 * released the product surface (2026-08-20).
 *
 * Session handling lives here (T057/T058): one ApiClient whose 401 handler
 * returns the shell to sign-in, `me()` on load to restore a live session, and
 * state-based navigation — the smallest thing that connects the pages; a
 * router arrives with EPIC-010's full specification interface.
 */
// T866 (EPIC-029) — the ONE import point for the design system's stylesheets,
// so no page can forget them. Removing either line renders every page unstyled
// while every isolated component test stays green; stylesheet-installed.spec.tsx
// (T866a) and app-root.spec.tsx (T899a) both exist to make that removal fail.
import './design/tokens.css';
import './design/themes.css';
import './design/components/components.css';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeControl } from './design/ThemeControl';
import { Button } from './design/components/Button';
import { initTheme } from './design/theme';
import { EngineSelector } from './components/EngineSelector';
import { RequirementEditor } from './components/RequirementEditor';
import { ProjectDetail, ProjectsPage } from './pages/Projects';
import { RequirementsPage } from './pages/Requirements';
import { TraceabilityPage } from './pages/Traceability';
import { SignIn } from './pages/SignIn';
// T200e (DEF-010-001) — the five that nothing imported. `page-reachability`
// (T200a) is the check that keeps this list honest.
import { SpecificationList } from './pages/SpecificationList';
import { SpecificationView } from './pages/Specification';
import { TasksPage } from './pages/Tasks';
import { RunsPage } from './pages/Runs';
import { ReviewSessionPage } from './pages/ReviewSession';
import { StorageConnectionsPage } from './pages/StorageConnections';
import { ApiClient, type Requirement, type WhoAmI } from './services/api';

/**
 * T200e — the way back, once.
 *
 * Six new views each need one, and six copies of the same button is how one of
 * them ends up going somewhere else after a refactor.
 */
function BackToProject({ onBack }: { onBack: () => void }): ReactElement {
  return (
    <Button variant="secondary" onClick={onBack}>
      Back to project
    </Button>
  );
}

type View =
  | { kind: 'loading' }
  | { kind: 'sign-in' }
  | { kind: 'projects' }
  | { kind: 'project'; projectId: string; editing?: Requirement | null }
  // T864 (EPIC-011) — US7 is "the user views…", four times over. The page was
  // built and reachable from nowhere; this is the route.
  | { kind: 'traceability'; projectId: string }
  // T200e (EPIC-010, DEF-010-001) — the same defect five times over. These five
  // pages were imported by NOTHING anywhere in src/, so five delivered
  // capabilities could not be used at all. `T200b` decided route-over-remove
  // for each; `T200a` is the check that keeps a sixth from happening.
  //
  // The review session is the one that needed more than a route: it takes a
  // `runId`, and no surface produced one until `RunsPage` (T200d).
  | { kind: 'specifications'; projectId: string }
  | { kind: 'specification'; projectId: string; specificationId: string }
  | { kind: 'tasks'; projectId: string; specificationId: string }
  | { kind: 'storage'; projectId: string }
  | { kind: 'runs'; projectId: string }
  | { kind: 'review-session'; projectId: string; runId: string };

/**
 * Exported so the shell's own routing is testable (T863). A router arrives
 * with EPIC-010; until then this is the navigation, and it is worth asserting
 * rather than assuming.
 */
export function App({ api: injected }: { api?: ApiClient } = {}): ReactElement {
  const [view, setView] = useState<View>({ kind: 'loading' });
  // T200e — read, not discarded. `StorageConnectionsPage` needs a workspace id
  // and the shell had already fetched one; throwing it away is why that page
  // looked like it needed a prop nothing could supply.
  const [identity, setIdentity] = useState<WhoAmI | null>(null);

  const api = useMemo(
    () =>
      injected ??
      new ApiClient({
        onSessionExpired: (): void => {
          setIdentity(null);
          setView({ kind: 'sign-in' });
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
    void (async (): Promise<void> => {
      try {
        setIdentity(await api.me());
        setView({ kind: 'projects' });
      } catch {
        setView({ kind: 'sign-in' });
      }
    })();
  }, [api]);

  const content = ((): ReactElement => {
    switch (view.kind) {
      case 'loading':
        return <main>Loading…</main>;
      case 'sign-in':
        return (
          <SignIn
            api={api}
            onSignedIn={(who): void => {
              setIdentity(who);
              setView({ kind: 'projects' });
            }}
          />
        );
      case 'projects':
        return (
          <ProjectsPage api={api} onOpen={(projectId): void => setView({ kind: 'project', projectId })} />
        );
      case 'project':
        return (
          <ProjectDetail api={api} projectId={view.projectId} onBack={(): void => setView({ kind: 'projects' })}>
            <>
              <EngineSelector api={api} projectId={view.projectId} value={null} />
              {/* T914/T923 (DEF-029-003) — this control carried no class and
                  rendered browser-default beside fully styled components. The
                  lint rule provably cannot see it: an ABSENCE of styling
                  contains no literal value. */}
              <Button
                variant="secondary"
                onClick={(): void => setView({ kind: 'traceability', projectId: view.projectId })}
              >
                Traceability
              </Button>
              {/* T200e (DEF-010-001) — the three ways in that did not exist.
                  Each opens a page that was built, tested in isolation, and
                  reachable from nowhere. */}
              <Button
                variant="secondary"
                onClick={(): void => setView({ kind: 'specifications', projectId: view.projectId })}
              >
                Specifications
              </Button>
              <Button
                variant="secondary"
                onClick={(): void => setView({ kind: 'runs', projectId: view.projectId })}
              >
                Runs
              </Button>
              <Button
                variant="secondary"
                onClick={(): void => setView({ kind: 'storage', projectId: view.projectId })}
              >
                Storage connections
              </Button>
              <RequirementsPage
                api={api}
                projectId={view.projectId}
                onEdit={(requirement): void => setView({ ...view, editing: requirement })}
              />
              <RequirementEditor
                key={view.editing?.id ?? 'new'}
                api={api}
                projectId={view.projectId}
                {...(view.editing ? { requirement: view.editing } : {})}
                onSaved={(): void => setView({ kind: 'project', projectId: view.projectId })}
              />
            </>
          </ProjectDetail>
        );
      case 'traceability':
        return (
          <main>
            {/* T914/T923 (DEF-029-003) — the second of the two unstyled shell
                controls. Same fix, same reason. */}
            <Button
              variant="secondary"
              onClick={(): void => setView({ kind: 'project', projectId: view.projectId })}
            >
              Back to project
            </Button>
            <TraceabilityPage api={api} projectId={view.projectId} />
          </main>
        );
      // T200e (DEF-010-001) — the five routes. Every one carries a way back:
      // a view reachable exactly once per session is its own kind of
      // unreachable.
      case 'specifications':
        return (
          <main>
            <BackToProject onBack={(): void => setView({ kind: 'project', projectId: view.projectId })} />
            <SpecificationList
              api={api}
              projectId={view.projectId}
              onOpen={(specificationId): void =>
                setView({ kind: 'specification', projectId: view.projectId, specificationId })
              }
            />
          </main>
        );
      case 'specification':
        return (
          <main>
            <BackToProject onBack={(): void => setView({ kind: 'specifications', projectId: view.projectId })} />
            <Button
              variant="secondary"
              onClick={(): void =>
                setView({
                  kind: 'tasks',
                  projectId: view.projectId,
                  specificationId: view.specificationId,
                })
              }
            >
              Tasks
            </Button>
            <SpecificationView api={api} specificationId={view.specificationId} />
          </main>
        );
      case 'tasks':
        return (
          <main>
            <BackToProject
              onBack={(): void =>
                setView({
                  kind: 'specification',
                  projectId: view.projectId,
                  specificationId: view.specificationId,
                })
              }
            />
            <TasksPage
              api={api}
              specificationId={view.specificationId}
              projectId={view.projectId}
            />
          </main>
        );
      case 'storage':
        return (
          <main>
            <BackToProject onBack={(): void => setView({ kind: 'project', projectId: view.projectId })} />
            {/* The workspace comes from the signed-in identity. Until T200e the
                shell fetched it and threw it away. */}
            {identity === null ? (
              <p>Loading…</p>
            ) : (
              <StorageConnectionsPage
                api={api}
                workspaceId={identity.workspace.id}
                projectId={view.projectId}
              />
            )}
          </main>
        );
      case 'runs':
        return (
          <main>
            <BackToProject onBack={(): void => setView({ kind: 'project', projectId: view.projectId })} />
            <RunsPage
              api={api}
              projectId={view.projectId}
              onOpen={(runId): void =>
                setView({ kind: 'review-session', projectId: view.projectId, runId })
              }
            />
          </main>
        );
      case 'review-session':
        return (
          <main>
            <BackToProject onBack={(): void => setView({ kind: 'runs', projectId: view.projectId })} />
            <ReviewSessionPage api={api} runId={view.runId} />
          </main>
        );
    }
  })();

  // T923 (parity row 10) — the prototype's frame: a sticky top bar carrying
  // where you are on the left and what is globally available on the right,
  // above a bounded content column. It is the prototype's `.topbar` and
  // `.content` and nothing else — the sidebar's seventeen destinations belong
  // to the Epics that own those screens (PMI-DOC-006 UX-0060), which is why
  // contracts/prototype-parity.md declines them by name.
  //
  // The theme control sits here, OUTSIDE the view switch, deliberately:
  // FR-DS-011 grants the override to the user of the application, not to one
  // page, so it must be reachable from every one of them.
  return (
    <div className="ds-shell">
      <header className="ds-topbar">
        <p className="ds-topbar__location">
          <span className="ds-topbar__location-context">PMI Studio / </span>
          {LOCATION[view.kind]}
        </p>
        <div className="ds-topbar__actions">
          <ThemeControl />
        </div>
      </header>
      <div className="ds-content">{content}</div>
    </div>
  );
}

/**
 * Where the shell says you are. The prototype's breadcrumb reads
 * "Acme / Payments / Home"; the workspace and project halves belong to
 * EPIC-004's scoping, which this Epic may not invent, so the shell states the
 * half it actually knows.
 */
const LOCATION: Record<View['kind'], string> = {
  loading: 'Loading',
  'sign-in': 'Sign in',
  projects: 'Projects',
  project: 'Project',
  traceability: 'Traceability',
  // T200e — `Record<View['kind'], …>` made this exhaustive, so adding the six
  // routes would not compile until the shell could say where each one is. That
  // is the type doing the job a convention would have forgotten.
  specifications: 'Specifications',
  specification: 'Specification',
  tasks: 'Tasks',
  storage: 'Storage connections',
  runs: 'Runs',
  'review-session': 'Review session',
};

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
