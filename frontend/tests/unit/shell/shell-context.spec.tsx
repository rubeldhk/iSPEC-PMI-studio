/**
 * T438e / T438g (EPIC-036) — switching project keeps your place, and an area
 * with no project says so.
 *
 * `FR-SHL-022`: switching MUST NOT lose the current area. The old shell could
 * not have satisfied this — its location and its scope were the same piece of
 * state, so changing one changed the other. Separating them is the whole point
 * of deriving `areaId` from the address.
 *
 * `FR-SHL-024`: an area needing a project, entered with none selected, says so
 * and **offers the next step**. Rendering empty is the failure `DEF-007-001`
 * records one layer down — a list that cannot tell *"no such project"* from
 * *"this project is empty"*.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { areaForPathname } from '../../../src/shell/shell-context';
import { PROJECT, renderAt, stubApi } from './harness';

afterEach(cleanup);

/**
 * Choose the project, once the option for it exists.
 *
 * `fireEvent.change` naming a value the `<select>` does not yet carry is
 * **silently ignored** — the set arrives from `EPIC-004` asynchronously, so
 * under load the option can still be missing. The test then fails several
 * assertions later for a reason unrelated to what it is testing, and only
 * sometimes. Found by the full `test:unit` run, which is slower than
 * `--project frontend` alone; `DEF-030-002` is the same shape.
 */
async function chooseProject(): Promise<void> {
  const select = await screen.findByLabelText('Project');
  await waitFor(() =>
    expect(
      within(select as HTMLElement).getByRole('option', { name: PROJECT.name }),
    ).toBeTruthy(),
  );
  fireEvent.change(select, { target: { value: PROJECT.id } });
}

describe('areaForPathname · the address decides the area', () => {
  it('matches an area exactly', () => {
    expect(areaForPathname('/runs')?.id).toBe('runs');
    expect(areaForPathname('/storage')?.id).toBe('workspace-administration');
  });

  it('matches a sub-view to the area it lives in', () => {
    expect(areaForPathname('/runs/run_1')?.id).toBe('runs');
    expect(areaForPathname('/specifications/s1/tasks')?.id).toBe('specifications');
  });

  it('does not let root swallow every address', () => {
    // `/` is Home and matches exactly. A prefix match would make every
    // address Home, and the breadcrumb would be right once by accident.
    expect(areaForPathname('/')?.id).toBe('home');
    expect(areaForPathname('/no-such-place')).toBeUndefined();
  });

  it('resolves the longest match, not the first', () => {
    expect(areaForPathname('/projects')?.id).toBe('projects');
  });
});

describe('T438e · FR-SHL-022 — switching project keeps the area', () => {
  it('stays in the same area and re-scopes its content', async () => {
    const api = stubApi();
    renderAt('/runs', api);
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Runs'),
    );

    await chooseProject();

    // Still in Runs…
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Runs'),
    );
    // …and the content re-scoped to the project that was chosen.
    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith(PROJECT.id));
  });

  it('does not touch the address when the project changes', async () => {
    renderAt('/storage');
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        'Workspace & Administration',
      ),
    );
    const before = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent;
    await chooseProject();
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        'Workspace & Administration',
      ),
    );
    expect(before).toContain('Workspace & Administration');
  });
});

describe('T441r · FR-SHL-021 — a project reached by address is the project the shell names', () => {
  // The convergence finding (`F1`). Every test above arrives by CLICKING, and
  // clicking calls `selectProject` on the way. A deep link does not — and
  // `FR-SHL-017` added deep links in this very Epic, so the entry path that
  // breaks this is one this Epic created.
  //
  // The failure is not a missing breadcrumb. It is a breadcrumb that says
  // "No project selected" while the screen renders a project, which is worse:
  // `BR-0001`'s failure mode is a plausible screen, and `UX-0011` asks for the
  // scope to be visible rather than implied.
  it('names the project in the breadcrumb when its address is opened directly', async () => {
    renderAt(`/projects/${PROJECT.id}`);
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent,
        'the breadcrumb does not name the project the address opened',
      ).toContain(PROJECT.name),
    );
  });

  it('does not say "No project selected" over a rendered project', async () => {
    renderAt(`/projects/${PROJECT.id}`);
    const crumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() => expect(crumb.textContent).toContain(PROJECT.name));
    expect(crumb.textContent).not.toContain('No project selected');
  });

  it('scopes the other areas to it, so leaving the sub-view keeps the project', async () => {
    // The selection has to reach `ShellContext`, not merely the breadcrumb.
    // A breadcrumb fixed on its own would be a second answer to "which
    // project", and the two would disagree the moment the user left.
    const api = stubApi();
    renderAt(`/projects/${PROJECT.id}`, api);
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        PROJECT.name,
      ),
    );

    const runs = screen
      .getAllByRole('navigation')
      .flatMap((nav) => within(nav).queryAllByRole('button'))
      .find((button) => button.textContent?.trim() === 'Runs');
    fireEvent.click(runs!);

    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith(PROJECT.id));
  });

  it('leaves the selection alone for an address that carries no project', async () => {
    renderAt('/runs');
    const crumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() => expect(crumb.textContent).toContain('Runs'));
    expect(crumb.textContent).toContain('No project selected');
  });
});

describe('T438g · FR-SHL-024 — an area with no project says so', () => {
  it.each([
    ['/runs', 'Runs'],
    ['/specifications', 'Specifications'],
    ['/storage', 'Workspace & Administration'],
  ])('%s explains and offers the next step', async (path) => {
    renderAt(path);
    // Scoped to `<main>`: "No project selected" is also the breadcrumb's
    // middle segment and the selector's first option, and both are correct.
    // The claim here is that the AREA says it, not that the string exists.
    const main = await screen.findByRole('main');
    await waitFor(() => expect(within(main).getByText('No project selected')).toBeTruthy());
    expect(within(main).getByRole('button', { name: /choose a project/i })).toBeDefined();
  });

  it('takes the user to Projects when they accept the offer', async () => {
    renderAt('/runs');
    fireEvent.click(await screen.findByRole('button', { name: /choose a project/i }));
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        'Projects',
      ),
    );
  });

  it('renders the real area once a project is chosen', async () => {
    const api = stubApi();
    renderAt('/runs', api);
    const main = await screen.findByRole('main');
    await waitFor(() => expect(within(main).getByText('No project selected')).toBeTruthy());

    await chooseProject();
    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith(PROJECT.id));
    expect(within(await screen.findByRole('main')).queryByText('No project selected')).toBeNull();
  });
});
