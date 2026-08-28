/**
 * T436g (EPIC-036) — the area registry. The one list (`R-036-2`).
 *
 * Navigation, the route tree and `FR-SHL-016`'s reachability check all read
 * this file and nothing else. `SC-SHL-004` requires an area to reach navigation
 * with **zero** shell code changes, which is only true when there is one
 * declaration rather than three lists that must agree — the shape
 * `DEF-010-001` took, where nine pages existed, four were imported, and every
 * check stayed green for five months.
 *
 * Unit tests: `frontend/tests/unit/shell/areas.spec.ts` (T436f).
 */
import type { ComponentType } from 'react';
import {
  HomeArea,
  ProjectsArea,
  RunsArea,
  SpecificationsArea,
  WorkspaceAdministrationArea,
} from './area-views';

/** PMI-DOC-006 §4.1's four groups, in its order. */
export const AREA_GROUPS = ['overview', 'intent-and-control', 'delivery', 'platform'] as const;

export type AreaGroup = (typeof AREA_GROUPS)[number];

/**
 * Four states, not three (`T1012`, Constitution XII Step B, 2026-08-25).
 *
 * **Reachability and completeness are different questions.** The three-state
 * vocabulary could only answer the first. Home renders, and carries **one of
 * the V2 prototype's three panels** — calling that `delivered` overstates the
 * product, and calling it `declared-not-delivered` denies a screen a user can
 * reach right now. The gap analysis of 2026-08-25 found this ambiguity was
 * itself the reason two published screen counts disagreed with each other.
 *
 * So `partly-delivered` joins the vocabulary, and two predicates replace one:
 * {@link reachableAreas} drives routing and navigation, {@link deliveredAreas}
 * stays strictly delivered so the delivery report cannot quietly inflate.
 *
 * **`undeclared` now has no members, deliberately.** Every area names its Epic
 * after Step B. The state is retained rather than deleted because a future area
 * may be declared before its Epic exists, and the register must be able to say
 * so honestly rather than mislabelling it.
 *
 * ## Why the original three
 *
 * The registry carried a boolean `declared` until the cross-artifact analysis
 * of 2026-08-24 (`specs/036-application-shell/analysis.md` `C1`). A boolean
 * conflates two different questions — is the area's **Epic** declared, and has
 * its **screen** been built — and four areas answer yes to the first and no to
 * the second. Under the boolean they were `declared: true`, which required an
 * `element` nothing could supply, while `FR-SHL-003` forbids this Epic
 * supplying one.
 *
 * Calling them `undeclared` instead would be false, and load-bearing false:
 * `UX-0060`'s prohibition turns on whether an *Epic* is declared, and the SRS
 * assigns all four owners. The middle state records the debt with the debtor's
 * name on it.
 */
export type AreaStatus =
  | 'delivered'
  | 'partly-delivered'
  | 'declared-not-delivered'
  | 'undeclared';

/** Whether an area renders — `delivered` or `partly-delivered` (`T1012`). */
export function isReachable(status: AreaStatus): boolean {
  return status === 'delivered' || status === 'partly-delivered';
}

export interface Area {
  /** Stable. Never reused — an address outlives a rename. */
  readonly id: string;
  readonly group: AreaGroup;
  /** What navigation shows. */
  readonly label: string;
  /** The address (`FR-SHL-017`). Unique, leading `/`. */
  readonly path: string;
  /** The Epic that owns this area's content, or null where §4.1 names none. */
  readonly epic: string | null;
  readonly status: AreaStatus;
  /**
   * What renders. Present exactly when the area is **reachable** — `delivered`
   * or `partly-delivered` (`T1012`). Scoping this to `delivered` alone would
   * strip a partly-delivered area of its route the moment it was reclassified.
   */
  readonly element?: ComponentType;
  /**
   * Why an area is not delivered, in the user's terms — shown on the not-found
   * page rather than kept for the reader of this file.
   */
  readonly note?: string;
}

/**
 * All eighteen areas of PMI-DOC-006 §4.1, in §4.1's order.
 *
 * **Two delivered, two partly delivered, thirteen owed, none undeclared**
 * (`T1013`, 2026-08-25). An undelivered area stays
 * here rather than being deleted: it is how §4.1's eighteen are recorded, and
 * how an address naming one is answered *not found* rather than *unknown path*.
 * Deleting them would make a specified area indistinguishable from a typo.
 */
export const AREAS: readonly Area[] = Object.freeze([
  // ---------------------------------------------------------------- Overview
  {
    id: 'home',
    group: 'overview',
    label: 'Home',
    path: '/',
    epic: 'EPIC-036',
    status: 'partly-delivered',
    note: 'Lifecycle health and Recent engineering activity are not built. Needs attention draws one of its three sources.',
    element: HomeArea,
  },
  {
    id: 'projects',
    group: 'overview',
    label: 'Projects',
    path: '/projects',
    epic: 'EPIC-003',
    status: 'partly-delivered',
    note: 'Per-project lifecycle health is not built (BR-0013 has no owner).',
    element: ProjectsArea,
  },
  {
    id: 'decision-inbox',
    group: 'overview',
    label: 'Decision Inbox',
    path: '/decisions',
    epic: 'EPIC-031',
    status: 'declared-not-delivered',
    note: 'Decisions and policy are specified and not built yet.',
  },
  // ------------------------------------------------------- Intent & Control
  {
    id: 'requirement-room',
    group: 'intent-and-control',
    label: 'Requirement Room',
    path: '/requirement-room',
    epic: 'EPIC-033',
    status: 'declared-not-delivered',
    // `T403n` built the Room screen and routed it at
    // `/requirement-room/:roomObjectId`. The AREA is still not delivered
    // because its landing path renders nothing — there is no index listing a
    // workspace's Room objects, and no task in Phase 8 names one.
    //
    // Left `declared-not-delivered` rather than promoted: `isReachable` requires
    // a reachable area to carry an `element`, and inventing an area landing to
    // justify a status change would be the status driving the product.
    note: 'The Requirement Room screen is built and reachable per object at /requirement-room/:roomObjectId; the area landing that would list them is not built.',
  },
  {
    id: 'specifications',
    group: 'intent-and-control',
    label: 'Specifications',
    path: '/specifications',
    epic: 'EPIC-010',
    status: 'delivered',
    element: SpecificationsArea,
  },
  {
    id: 'change-room',
    group: 'intent-and-control',
    label: 'Change Room',
    path: '/change-room',
    epic: 'EPIC-034',
    status: 'declared-not-delivered',
    note: 'The Change Room is specified and not built yet.',
  },
  {
    id: 'defect-room',
    group: 'intent-and-control',
    label: 'Defect Room',
    path: '/defect-room',
    epic: 'EPIC-035',
    status: 'declared-not-delivered',
    note: 'The Defect Room is specified and not built yet.',
  },
  {
    id: 'architecture-decisions',
    group: 'intent-and-control',
    label: 'Architecture & Decisions',
    path: '/architecture',
    epic: 'EPIC-016',
    status: 'declared-not-delivered',
    note: 'Architecture and decision records are specified and not built yet.',
  },
  // ---------------------------------------------------------------- Delivery
  {
    id: 'plan-and-tasks',
    group: 'delivery',
    label: 'Plan & Tasks',
    path: '/plan',
    epic: 'EPIC-012',
    status: 'declared-not-delivered',
    // N1 (analysis.md, 2026-08-24). EPIC-012 IS complete and `Tasks.tsx` IS
    // delivered — but it is scoped to one specification, and its only address
    // is `/specifications/:id/tasks`. Navigation renders a link to
    // `Area.path`, and `:id` is not an address, so this area cannot be a
    // primary-navigation destination as it stands. The project-level plan
    // PMI-DOC-006 §4.1 describes has no entry point, and building one here is
    // area content `FR-SHL-003` forbids. The tasks view stays reachable as a
    // sub-view of Specifications; this row is the debt, and EPIC-012 clears it
    // with a landing view and a one-line edit here (T441p).
    note: 'Tasks are reached through a specification. A project-level plan view is not built yet.',
  },
  {
    id: 'engineering-experts',
    group: 'delivery',
    label: 'Engineering Experts',
    path: '/experts',
    epic: 'EPIC-028',
    status: 'declared-not-delivered',
    note: 'Engineering Experts are specified and not built yet.',
  },
  {
    id: 'runs',
    group: 'delivery',
    label: 'Runs',
    path: '/runs',
    epic: 'EPIC-023',
    status: 'delivered',
    element: RunsArea,
  },
  {
    id: 'evidence-compliance',
    group: 'delivery',
    label: 'Evidence & Compliance',
    path: '/evidence',
    epic: 'EPIC-032',
    status: 'declared-not-delivered',
    note: 'Evidence and compliance are specified and not built yet.',
  },
  {
    id: 'qa-releases',
    group: 'delivery',
    label: 'QA & Releases',
    path: '/qa',
    epic: 'EPIC-014 · EPIC-015',
    status: 'declared-not-delivered',
    note: 'Quality gates and releases are specified and not built yet.',
  },
  // ---------------------------------------------------------------- Platform
  {
    id: 'context',
    group: 'platform',
    label: 'Context',
    path: '/context',
    epic: 'EPIC-038',
    status: 'declared-not-delivered',
    note: 'Engineering Context is owned and not scheduled yet.',
  },
  {
    id: 'integrations',
    group: 'platform',
    label: 'Integrations',
    path: '/integrations',
    epic: 'EPIC-039',
    status: 'declared-not-delivered',
    note: 'The Integration Hub is owned and not scheduled yet.',
  },
  {
    id: 'reports',
    group: 'platform',
    label: 'Reports',
    path: '/reports',
    epic: 'EPIC-040',
    status: 'declared-not-delivered',
    note: 'Metrics and reporting are owned and not scheduled yet.',
  },
  {
    id: 'governance',
    group: 'platform',
    label: 'Governance',
    path: '/governance',
    epic: 'EPIC-019 · EPIC-021 · EPIC-024',
    status: 'declared-not-delivered',
    note: 'Governance, steering and access are specified and not built yet.',
  },
  {
    id: 'workspace-administration',
    group: 'platform',
    label: 'Workspace & Administration',
    path: '/storage',
    epic: 'EPIC-004',
    status: 'delivered',
    element: WorkspaceAdministrationArea,
  },
]);

/** The areas that reach navigation and the route tree. Registry order. */
export function deliveredAreas(): readonly Area[] {
  return AREAS.filter((area) => area.status === 'delivered');
}

/**
 * Every area a user can actually open (`T1012`).
 *
 * Routing, navigation and the not-found page read **this**, not
 * {@link deliveredAreas} — a partly-delivered area is incomplete, not absent,
 * and routing it to *not found* would hide a working screen.
 */
export function reachableAreas(): readonly Area[] {
  return AREAS.filter((area) => isReachable(area.status));
}

export const GROUP_LABELS: Readonly<Record<AreaGroup, string>> = Object.freeze({
  overview: 'Overview',
  'intent-and-control': 'Intent & Control',
  delivery: 'Delivery',
  platform: 'Platform',
});
