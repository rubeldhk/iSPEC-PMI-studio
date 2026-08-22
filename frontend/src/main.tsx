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
import { initTheme } from './design/theme';
import { EngineSelector } from './components/EngineSelector';
import { RequirementEditor } from './components/RequirementEditor';
import { ProjectDetail, ProjectsPage } from './pages/Projects';
import { RequirementsPage } from './pages/Requirements';
import { TraceabilityPage } from './pages/Traceability';
import { SignIn } from './pages/SignIn';
import { ApiClient, type Requirement, type WhoAmI } from './services/api';

type View =
  | { kind: 'loading' }
  | { kind: 'sign-in' }
  | { kind: 'projects' }
  | { kind: 'project'; projectId: string; editing?: Requirement | null }
  // T864 (EPIC-011) — US7 is "the user views…", four times over. The page was
  // built and reachable from nowhere; this is the route.
  | { kind: 'traceability'; projectId: string };

/**
 * Exported so the shell's own routing is testable (T863). A router arrives
 * with EPIC-010; until then this is the navigation, and it is worth asserting
 * rather than assuming.
 */
export function App({ api: injected }: { api?: ApiClient } = {}): ReactElement {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [, setIdentity] = useState<WhoAmI | null>(null);

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
              <button
                type="button"
                onClick={(): void => setView({ kind: 'traceability', projectId: view.projectId })}
              >
                Traceability
              </button>
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
            <button
              type="button"
              onClick={(): void => setView({ kind: 'project', projectId: view.projectId })}
            >
              Back to project
            </button>
            <TraceabilityPage api={api} projectId={view.projectId} />
          </main>
        );
    }
  })();

  // The theme control sits OUTSIDE the view switch deliberately: FR-DS-011
  // grants the override to the user of the application, not to one page, so
  // it must be reachable from every one of them.
  return (
    <>
      <div className="ds-app-bar">
        <ThemeControl />
      </div>
      {content}
    </>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
