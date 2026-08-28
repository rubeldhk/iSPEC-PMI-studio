/**
 * T436k / T437m (EPIC-036) — the route tree, generated from `AREAS`.
 *
 * React Router 7 in **declarative mode** (`R-036-1`, `D-13`, Context7
 * `/remix-run/react-router`): `Routes` + `Route` + `Outlet`, imported from
 * `react-router` — **not `react-router-dom`**, which v7 supersedes. Framework
 * mode would bring its own build, file-system routes and loaders, replacing
 * Vite's role and reaching far outside this Epic.
 *
 * **Area routes are derived; sub-view routes are declared.** An area's route
 * comes from the registry, so a route cannot exist that navigation does not
 * know about — which is the defect `FR-SHL-016` exists to catch. Sub-views are
 * listed here because they are not areas: they are addresses *within* one, and
 * the registry deliberately does not model them.
 *
 * Unit tests: `frontend/tests/unit/shell/routes.spec.tsx` (T436j).
 */
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { reachableAreas } from './areas';
import {
  ProjectDetailView,
  RequirementRoomView,
  ReviewSessionView,
  SpecificationDetailView,
  TasksView,
  TraceabilityView,
} from './area-views';

/**
 * Addresses inside an area (`FR-SHL-017`, *"and every key sub-view within
 * one"*). Each is `Area.path` plus a segment, so none can drift away from an
 * area that exists.
 */
export const SUB_VIEWS: readonly { path: string; element: () => ReactElement }[] = Object.freeze([
  { path: '/projects/:projectId', element: ProjectDetailView },
  { path: '/traceability', element: TraceabilityView },
  { path: '/specifications/:specificationId', element: SpecificationDetailView },
  { path: '/specifications/:specificationId/tasks', element: TasksView },
  { path: '/runs/:runId', element: ReviewSessionView },
  { path: '/requirement-room/:roomObjectId', element: RequirementRoomView },
]);

/**
 * The whole tree: one layout, one route per delivered area, the sub-views, and
 * `*`.
 *
 * `*` answers not-found for every address that is not one of the above —
 * including one naming an area that is specified but not delivered. From an
 * address's point of view *"forbidden to build"* (`UX-0060`) and *"not built
 * yet"* are the same answer, and `NotFound` tells the reader which.
 */
export function ShellRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {reachableAreas().map((area) => {
          const Element = area.element!;
          return <Route key={area.id} path={area.path} element={<Element />} />;
        })}
        {SUB_VIEWS.map(({ path, element: Element }) => (
          <Route key={path} path={path} element={<Element />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
