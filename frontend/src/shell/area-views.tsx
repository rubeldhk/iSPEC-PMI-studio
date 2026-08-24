/**
 * T436g / T437m (EPIC-036) — what each area renders.
 *
 * **The shell hosts screens and implements none** (`FR-SHL-003`). Every view
 * below is a thin binding: it reads workspace and project from `ShellContext`,
 * reads parameters from the address, and hands both to a page some other Epic
 * built. Nothing here fetches, decides or renders product content.
 *
 * That is also why `EPIC-010`'s `T200e` buttons go: those pages were reachable
 * only from a corridor of buttons on the project view, and navigation replaces
 * them (`R-036-5`).
 *
 * Unit tests: `frontend/tests/unit/shell/area-reachability.spec.tsx` (T437h)
 * drives every one of these through the real `App`.
 */
import { useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../design/components/Button';
import { EmptyState } from '../design/components/EmptyState';
import { EngineSelector } from '../components/EngineSelector';
import { RequirementEditor } from '../components/RequirementEditor';
import { ProjectDetail, ProjectsPage } from '../pages/Projects';
import { RequirementsPage } from '../pages/Requirements';
import { ReviewSessionPage } from '../pages/ReviewSession';
import { RunsPage } from '../pages/Runs';
import { SpecificationList } from '../pages/SpecificationList';
import { SpecificationView } from '../pages/Specification';
import { StorageConnectionsPage } from '../pages/StorageConnections';
import { TasksPage } from '../pages/Tasks';
import { TraceabilityPage } from '../pages/Traceability';
import { Home } from './Home';
import { useShell } from './shell-context';
import type { Requirement } from '../services/api';

/**
 * `FR-SHL-024` — an area needing a project, entered with none selected, says
 * so and offers the next step. It does **not** render empty.
 *
 * `DEF-007-001` is the same class one layer down: a project-scoped list that
 * could not tell *"no such project"* from *"this project is empty"*. A screen
 * that renders nothing because its scope is unset looks exactly like a screen
 * that renders nothing because there is nothing — and only one of those is the
 * user's problem to fix.
 */
export function RequireProject({
  children,
}: {
  children: (projectId: string) => ReactElement;
}): ReactElement {
  const { projectId } = useShell();
  const navigate = useNavigate();
  if (projectId === null) {
    // The landmark belongs to THIS branch, not to the caller. Whether a
    // `<main>` is needed depends on which branch renders — the fulfilled one
    // may hand off to a page that carries its own — so a wrapper around the
    // whole component would nest one landmark or leave the other with none.
    // `T440e` found exactly that at `/storage`.
    return (
      <main>
        <EmptyState
          title="No project selected"
          explanation="This area shows one project at a time, and none is selected yet."
          actionLabel="Choose a project"
          onAction={(): void => {
            void navigate('/projects');
          }}
        />
      </main>
    );
  }
  return children(projectId);
}

/**
 * The `<main>` landmark, for the pages that do not carry one.
 *
 * **Six of the delivered pages render their own `<main>` and four do not.**
 * That is not a convention the shell can assume either way: nesting two
 * landmarks and having none are both accessibility faults, and the old
 * `main.tsx` handled it by wrapping some views by hand and not others — a
 * per-page correspondence nobody could see was wrong.
 *
 * So the shell frame renders a plain `<div>`, each binding says whether its
 * page needs the landmark, and **`T440e` asserts exactly one `<main>` at every
 * delivered address**. The check is the control; this component is only how the
 * answer is supplied. Wrapping `FR-SHL-003` the other way — editing another
 * Epic's page to add a landmark — is what the shell may not do.
 */
function MainLandmark({ children }: { children: ReactElement }): ReactElement {
  return <main>{children}</main>;
}

// ---------------------------------------------------------------- the areas

export function HomeArea(): ReactElement {
  return <Home />;
}

export function ProjectsArea(): ReactElement {
  const { api, selectProject } = useShell();
  const navigate = useNavigate();
  return (
    <ProjectsPage
      api={api}
      onOpen={(projectId): void => {
        // Opening a project selects it, so every other area re-scopes with it
        // (`FR-SHL-021`). Navigating without selecting is how a breadcrumb
        // ends up naming a project the content is not about.
        selectProject(projectId);
        void navigate(`/projects/${encodeURIComponent(projectId)}`);
      }}
    />
  );
}

export function SpecificationsArea(): ReactElement {
  const { api } = useShell();
  const navigate = useNavigate();
  return (
    <RequireProject>
      {(projectId): ReactElement => (
        <MainLandmark>
          <SpecificationList
            api={api}
            projectId={projectId}
            onOpen={(specificationId): void => {
              void navigate(`/specifications/${encodeURIComponent(specificationId)}`);
            }}
          />
        </MainLandmark>
      )}
    </RequireProject>
  );
}

export function RunsArea(): ReactElement {
  const { api } = useShell();
  const navigate = useNavigate();
  return (
    <RequireProject>
      {(projectId): ReactElement => (
        <MainLandmark>
          <RunsPage
            api={api}
            projectId={projectId}
            onOpen={(runId): void => {
              void navigate(`/runs/${encodeURIComponent(runId)}`);
            }}
          />
        </MainLandmark>
      )}
    </RequireProject>
  );
}

export function WorkspaceAdministrationArea(): ReactElement {
  const { api, workspaceId } = useShell();
  if (workspaceId === null) {
    return (
      <main>
        <EmptyState
          title="No workspace"
          explanation="The signed-in identity carries no workspace, so there is nothing to administer."
        />
      </main>
    );
  }
  return (
    <RequireProject>
      {(projectId): ReactElement => (
        <StorageConnectionsPage api={api} workspaceId={workspaceId} projectId={projectId} />
      )}
    </RequireProject>
  );
}

// ------------------------------------------------------------- the sub-views

export function ProjectDetailView(): ReactElement {
  const { api } = useShell();
  const navigate = useNavigate();
  const { projectId = '' } = useParams();
  const [editing, setEditing] = useState<Requirement | null>(null);

  return (
    <ProjectDetail
      api={api}
      projectId={projectId}
      onBack={(): void => {
        void navigate('/projects');
      }}
    >
      <>
        <EngineSelector api={api} projectId={projectId} value={null} />
        {/* `T200e`'s three buttons are gone — Specifications, Runs and Storage
            are primary-navigation areas now, not a corridor on this page
            (`R-036-5`, `T437g`).

            **Traceability's is not**, and that is the difference rather than an
            oversight. It is `T864`'s control, not `T200e`'s, and PMI-DOC-006
            §4.1 names no Traceability area — the contract's route table records
            it as *"within Projects"*. So it has no navigation entry to inherit,
            and removing this link would put `EPIC-011`'s whole US7 back where
            `/speckit-converge` found it: built, tested, and reachable from
            nowhere. */}
        <Button
          variant="secondary"
          onClick={(): void => {
            void navigate('/traceability');
          }}
        >
          Traceability
        </Button>
        <RequirementsPage api={api} projectId={projectId} onEdit={setEditing} />
        <RequirementEditor
          key={editing?.id ?? 'new'}
          api={api}
          projectId={projectId}
          {...(editing ? { requirement: editing } : {})}
          onSaved={(): void => {
            setEditing(null);
          }}
        />
      </>
    </ProjectDetail>
  );
}

export function TraceabilityView(): ReactElement {
  const { api } = useShell();
  return (
    <RequireProject>
      {(projectId): ReactElement => (
        <MainLandmark>
          <TraceabilityPage api={api} projectId={projectId} />
        </MainLandmark>
      )}
    </RequireProject>
  );
}

export function SpecificationDetailView(): ReactElement {
  const { api } = useShell();
  const { specificationId = '' } = useParams();
  return <SpecificationView api={api} specificationId={specificationId} />;
}

/**
 * The tasks view — a sub-view of a specification, not an area.
 *
 * `N1` (analysis.md, 2026-08-24): `EPIC-012` delivered `Tasks.tsx`, and it is
 * scoped to one specification. Its only address is this one, so *Plan & Tasks*
 * cannot be a primary-navigation destination — a nav link to
 * `/specifications/:id/tasks` has no `:id` to use. The area is recorded
 * `declared-not-delivered` against `EPIC-012` and this view stays reachable.
 */
export function TasksView(): ReactElement {
  const { api } = useShell();
  const { specificationId = '' } = useParams();
  return (
    <RequireProject>
      {(projectId): ReactElement => (
        <TasksPage api={api} specificationId={specificationId} projectId={projectId} />
      )}
    </RequireProject>
  );
}

export function ReviewSessionView(): ReactElement {
  const { api } = useShell();
  const { runId = '' } = useParams();
  return <ReviewSessionPage api={api} runId={runId} />;
}
