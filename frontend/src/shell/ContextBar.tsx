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
import { useLocation } from 'react-router';
import { isAddressScoped, useCurrentArea, useCurrentProject, useShell } from './shell-context';

const NO_PROJECT = '';

export function ContextBar(): ReactElement {
  const { workspaceId, projects, projectSet, selectProject } = useShell();
  const project = useCurrentProject();
  const area = useCurrentArea();
  const { pathname } = useLocation();
  // `T442e` — this address scopes itself, so the selector's project is not what
  // the page is showing. Saying which project it IS would be a guess.
  const addressScoped = isAddressScoped(pathname);

  return (
    <div className="shell-context">
      {/* `UX-0012` — one breadcrumb, always the same three segments, so the
          answer to "which workspace and project am I in?" is in one place
          rather than assembled from whatever the screen happens to show. */}
      <nav aria-label="Breadcrumb" className="ds-topbar__location">
        <ol className="shell-context__crumbs">
          <li>{workspaceId === null ? 'No workspace' : `Workspace ${workspaceId}`}</li>
          <li>
            {addressScoped
              ? 'Scoped by this link'
              : project === null
                ? 'No project selected'
                : project.name}
          </li>
          <li aria-current="page">{area?.label ?? 'Not found'}</li>
        </ol>
      </nav>

      <label className="shell-context__project" htmlFor="shell-project">
        Project
        {/* Four things this control can be saying, and they are four different
            things (`T441u`, `T442b`; `FR-SHL-060`, `FR-SHL-062`):

              loading  we have not been told yet
              failed   we asked and did not get an answer
              empty    we asked, and this workspace has none
              ready    here they are

            It has been wrong twice — first collapsing loading into empty, then
            failed into empty. `DEF-007-001` is the same ambiguity one layer
            down, and `FR-SHL-062` calls the second one a defect rather than a
            fallback. The union in `ShellContext` is what makes leaving one out
            a missing branch instead of a silent default. */}
        <Select
          id="shell-project"
          value={project?.id ?? NO_PROJECT}
          loading={projectSet.kind === 'loading'}
          invalid={projectSet.kind === 'failed'}
          onChange={(event): void => {
            // `FR-SHL-022` — switching does not touch the address, so the user
            // stays in the area they were in and its content re-scopes.
            const { value } = event.target;
            selectProject(value === NO_PROJECT ? null : value);
          }}
        >
          <option value={NO_PROJECT}>
            {projectSet.kind === 'loading'
              ? 'Loading projects…'
              : projectSet.kind === 'failed'
                ? 'Projects could not be loaded'
                : projects.length === 0
                  ? 'No projects in this workspace'
                  : 'No project selected'}
          </option>
          {projects.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </Select>
      </label>

      {/* `FR-SHL-061` — what is absent AND what to do next. Rendered only when
          the set failed: a notice that is always there is not a notice. */}
      {projectSet.kind === 'failed' && (
        <p className="shell-context__error" role="alert">
          Projects could not be loaded — {projectSet.reason} Reload the page to try again.
        </p>
      )}
    </div>
  );
}
