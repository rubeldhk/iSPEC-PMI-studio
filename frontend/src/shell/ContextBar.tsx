/**
 * T438b / T438d (EPIC-036) — workspace and project, visible at all times.
 *
 * `BR-0001` is tenant isolation and its failure mode is silent: a user acting
 * on the wrong project sees a perfectly plausible screen. `UX-0010` and
 * `UX-0011` answer that by making the scope visible rather than implied, and
 * `UX-0012` fixes the shape — `workspace / project / area`.
 *
 * **The shell renders the selector and defines nothing about it** (`FR-SHL-025`).
 * `EPIC-004` owns workspace scoping and supplies what may be selected;
 * `prototype-parity.md` declines this control to the shell precisely because
 * *"the shell may not invent its selector"*. Rendering a control whose contents
 * and rules come from elsewhere is not inventing one.
 *
 * The breadcrumb's area segment is **derived from the address** — never held
 * beside it (`data-model.md` §3). Two answers to *"where am I"* disagree the
 * first time somebody uses the back button.
 *
 * Unit tests: `frontend/tests/unit/shell/ContextBar.spec.tsx` (T438a, T438c).
 */
import type { ReactElement } from 'react';
import { Select } from '../design/components/Select';
import { useCurrentArea, useCurrentProject, useShell } from './shell-context';

const NO_PROJECT = '';

export function ContextBar(): ReactElement {
  const { workspaceId, projects, selectProject } = useShell();
  const project = useCurrentProject();
  const area = useCurrentArea();

  return (
    <div className="shell-context">
      {/* `UX-0012` — one breadcrumb, always the same three segments, so the
          answer to "which workspace and project am I in?" is in one place
          rather than assembled from whatever the screen happens to show. */}
      <nav aria-label="Breadcrumb" className="ds-topbar__location">
        <ol className="shell-context__crumbs">
          <li>{workspaceId === null ? 'No workspace' : `Workspace ${workspaceId}`}</li>
          <li>{project === null ? 'No project selected' : project.name}</li>
          <li aria-current="page">{area?.label ?? 'Not found'}</li>
        </ol>
      </nav>

      <label className="shell-context__project" htmlFor="shell-project">
        Project
        <Select
          id="shell-project"
          value={project?.id ?? NO_PROJECT}
          emptyMessage="No projects in this workspace"
          onChange={(event): void => {
            // `FR-SHL-022` — switching does not touch the address, so the user
            // stays in the area they were in and its content re-scopes.
            const { value } = event.target;
            selectProject(value === NO_PROJECT ? null : value);
          }}
        >
          <option value={NO_PROJECT}>No project selected</option>
          {projects.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
