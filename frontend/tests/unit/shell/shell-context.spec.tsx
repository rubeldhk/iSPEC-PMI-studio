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

    fireEvent.change(await screen.findByLabelText('Project'), { target: { value: PROJECT.id } });

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
    fireEvent.change(await screen.findByLabelText('Project'), { target: { value: PROJECT.id } });
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        'Workspace & Administration',
      ),
    );
    expect(before).toContain('Workspace & Administration');
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

    fireEvent.change(screen.getByLabelText('Project'), { target: { value: PROJECT.id } });
    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith(PROJECT.id));
    expect(within(await screen.findByRole('main')).queryByText('No project selected')).toBeNull();
  });
});
