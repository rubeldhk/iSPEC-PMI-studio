/**
 * Web shell (T003) — pages arrived with EPIC-005/006/007 when PMI-DOC-004
 * released the product surface (2026-08-20).
 *
 * Session handling lives here (T057/T058): one ApiClient whose 401 handler
 * returns the shell to sign-in, `me()` on load to restore a live session, and
 * state-based navigation — the smallest thing that connects the pages; a
 * router arrives with EPIC-010's full specification interface.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { RequirementEditor } from './components/RequirementEditor';
import { ProjectDetail, ProjectsPage } from './pages/Projects';
import { RequirementsPage } from './pages/Requirements';
import { SignIn } from './pages/SignIn';
import { ApiClient, type Requirement, type WhoAmI } from './services/api';

type View =
  | { kind: 'loading' }
  | { kind: 'sign-in' }
  | { kind: 'projects' }
  | { kind: 'project'; projectId: string; editing?: Requirement | null };

function App(): ReactElement {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [, setIdentity] = useState<WhoAmI | null>(null);

  const api = useMemo(
    () =>
      new ApiClient({
        onSessionExpired: (): void => {
          setIdentity(null);
          setView({ kind: 'sign-in' });
        },
      }),
    [],
  );

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
  }
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
