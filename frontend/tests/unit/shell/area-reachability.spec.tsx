/**
 * T437h / T437i / T437j / T437p (EPIC-036) — `FR-SHL-016`, `G-UX-01`'s
 * navigation half.
 *
 * **Is every delivered area reachable from primary navigation, in the built
 * application?** Constitution XI Tier 1: this drives the real `App` through its
 * real entry point and *clicks*, rather than inspecting a list of routes.
 *
 * **What this does NOT answer, and `T200a` does.**
 * `frontend/tests/unit/design/page-reachability.spec.ts` asks a different
 * question — *is every delivered page module imported and rendered from the
 * application root?* — by walking the import graph. Its own header says it
 * cannot see route reachability. The two are kept and joined (`R-036-5`);
 * merging them would give one check that half-answers both.
 *
 * `DEF-010-001` is why this exists: nine page components, four reachable, for
 * five months, with every gate green. The failure was never in a page. It was
 * that nothing owned the composition, and so nothing tested it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AREAS, reachableAreas, type Area } from '../../../src/shell/areas';
import { navigationModel } from '../../../src/shell/navigation-model';
import { renderAt } from './harness';

afterEach(cleanup);

/** Every button inside a navigation landmark, across all four groups. */
function navButtons(): HTMLElement[] {
  return screen
    .getAllByRole('navigation')
    .flatMap((nav) => within(nav).queryAllByRole('button'));
}

function navButtonFor(area: Area): HTMLElement | undefined {
  return navButtons().find((button) => button.textContent?.trim() === area.label);
}

describe('T437h · FR-SHL-016 — every delivered area is reachable from navigation', () => {
  it('finds a navigation to drive, or this check proves nothing', async () => {
    // Anti-vacuity. `getAllByRole` throwing would be a failure; an empty
    // navigation would let every `for` below iterate over nothing.
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    expect(reachableAreas().length).toBeGreaterThan(0);
  });

  it.each(reachableAreas().map((area) => [area.label, area] as const))(
    'reaches %s by clicking primary navigation',
    async (_label, area) => {
      renderAt('/');
      await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));

      const button = navButtonFor(area);
      expect(button, `no navigation control for "${area.label}"`).toBeDefined();

      fireEvent.click(button!);

      // Reached means the shell says so: the breadcrumb's area segment is
      // derived from the address, so it can only name the area if the address
      // actually changed.
      await waitFor(() => {
        const crumb = document.querySelector('.ds-topbar__location')?.textContent ?? '';
        expect(crumb, `clicking "${area.label}" did not arrive there`).toContain(area.label);
      });
    },
  );

  it('marks the current area, and only that one (FR-SHL-012)', async () => {
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    const current = navButtons().filter((button) => button.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent?.trim()).toBe('Home');
  });

  it('keeps navigation present while an area is open (FR-SHL-012)', async () => {
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    const before = navButtons().length;
    fireEvent.click(navButtonFor(reachableAreas().find((a) => a.id === 'runs')!)!);
    await waitFor(() => {
      expect(navButtons().length).toBe(before);
    });
  });
});

describe('T437j · MUTATION — removing an area from navigation fails the check', () => {
  it('reports the area by name when it is not in navigation', async () => {
    // `SC-SHL-001` states this as a number, and `T200c` set the standard: a
    // reachability check that has never been observed failing is decoration.
    //
    // The mutation is performed on the model rather than by editing
    // `areas.ts` and reverting it — same defect, and it can run every time
    // rather than once by hand.
    const withoutRuns = AREAS.filter((area) => area.id !== 'runs');
    const reachable = navigationModel(withoutRuns).flatMap((group) =>
      group.areas.map((area) => area.id),
    );

    const missing = reachableAreas()
      .filter((area) => !reachable.includes(area.id))
      .map((area) => area.label);

    expect(missing, 'the mutation was not detected at all').toEqual(['Runs']);
  });

  it('and the unmutated registry leaves nothing unreachable', async () => {
    const reachable = navigationModel().flatMap((group) => group.areas.map((area) => area.id));
    const missing = reachableAreas()
      .filter((area) => !reachable.includes(area.id))
      .map((area) => area.label);
    expect(missing).toEqual([]);
  });
});

describe('T437p · SC-SHL-003 — any area is two actions from any other', () => {
  it('places every delivered area one click from every other', async () => {
    // Navigation is persistent (`FR-SHL-012`), so the distance between any two
    // areas is one click — one is inside the budget of two, and the budget
    // exists for the case where navigation is behind a control at narrow
    // widths (`FR-SHL-054`: open the drawer, then click).
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));

    for (const area of reachableAreas()) {
      expect(navButtonFor(area), `"${area.label}" is not one click away`).toBeDefined();
    }
    expect(navButtons()).toHaveLength(reachableAreas().length);
  });
});

describe('T1586 · EPIC-044 sub-views resolve inside their delivered areas (FR-EPB-040, FR-EPB-041)', () => {
  it('/requirement-room/epics resolves to the project-scoped Epic list (asks for a project when none is selected, never not-found)', async () => {
    renderAt('/requirement-room/epics');
    // A project-scoped sub-view entered with no project selected says so (`FR-SHL-024`);
    // a not-found answer would mean the address did not resolve at all.
    expect(await screen.findByText('This area shows one project at a time, and none is selected yet.')).toBeDefined();
    expect(screen.queryByText(/not found/i)).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('/requirement-room/epics/:epicId renders one Epic', async () => {
    renderAt('/requirement-room/epics/e1');
    expect(await screen.findByRole('heading', { name: /^Epic 1 · Intake$/ })).toBeDefined();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('/specifications/board resolves to the project-scoped board (asks for a project when none is selected, never not-found)', async () => {
    renderAt('/specifications/board');
    expect(await screen.findByText('This area shows one project at a time, and none is selected yet.')).toBeDefined();
    expect(screen.queryByText(/not found/i)).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('the shell contract documents the three sub-views', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { resolve } = require('node:path') as typeof import('node:path');
    const table = readFileSync(resolve(__dirname, '../../../../specs/036-application-shell/contracts/shell-contract.md'), 'utf8');
    const lines = table.split(/\r?\n/);
    for (const path of ['/requirement-room/epics', '/requirement-room/epics/:epicId', '/specifications/board']) {
      expect(lines.some((l) => l.startsWith(`${path} `) && l.includes('→')), `${path} is not in the route table`).toBe(true);
    }
  });
});
