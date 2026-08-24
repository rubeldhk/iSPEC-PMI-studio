/**
 * T438a / T438c (EPIC-036) — workspace and project, visible without asking.
 *
 * `BR-0001` is tenant isolation and its failure mode is **silent**: a user
 * acting on the wrong project sees a perfectly plausible screen and finds out
 * later. `UX-0010`/`UX-0011` answer that by making the scope visible rather
 * than implied, and `SC-SHL-009` puts a number on it — answerable from the
 * screen in under five seconds, without opening a menu.
 *
 * "Without opening a menu" is the testable half: the scope is **rendered**,
 * not behind a control.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { PROJECT, WORKSPACE_ID, renderAt, stubApi } from './harness';

afterEach(cleanup);

function breadcrumb(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

describe('T438a · the scope is on screen, not behind a control', () => {
  it('names the workspace and the project without any interaction', async () => {
    renderAt('/projects');
    await waitFor(() => expect(breadcrumb().textContent).toContain(WORKSPACE_ID));
  });

  it('says so plainly when no project is selected, rather than showing nothing', async () => {
    // An empty segment reads as "some project"; `DEF-007-001` is this class of
    // ambiguity one layer down.
    renderAt('/');
    await waitFor(() => expect(breadcrumb().textContent).toContain('No project selected'));
  });

  it('offers the project selector as a rendered control on every screen', async () => {
    renderAt('/runs');
    const select = await screen.findByLabelText('Project');
    // The set arrives from `EPIC-004` asynchronously; the control is rendered
    // before it does, which is correct — an absent selector would be worse
    // than an empty one.
    await waitFor(() =>
      expect(within(select as HTMLElement).getAllByRole('option').length).toBeGreaterThan(1),
    );
  });
});

describe('T441v · FR-SHL-060 — the selector tells loading from empty', () => {
  // The convergence finding (`F3`). While `listProjects()` was in flight the
  // control read "No project selected" and nothing else — the same thing it
  // reads for a workspace that genuinely has no projects. Two different facts,
  // one appearance, on a surface the user sees on every screen.
  //
  // `DEF-007-001` is this class one layer down: a project-scoped list that
  // could not tell "no such project" from "this project is empty". The
  // difference matters because only one of them is worth waiting for.
  it('marks the control busy while the set is in flight', async () => {
    const api = stubApi();
    let release: ((projects: never[]) => void) | undefined;
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => new Promise((resolve) => { release = resolve as never; }),
    );
    renderAt('/', api);
    const select = await screen.findByLabelText('Project');
    expect(select.getAttribute('aria-busy'), 'the control is not marked busy').toBe('true');
    release?.([]);
  });

  it('stops being busy once the set has arrived', async () => {
    renderAt('/');
    const select = await screen.findByLabelText('Project');
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBeNull());
  });

  it('says the workspace has no projects only once it knows that', async () => {
    // The other half: an empty answer is a real answer, and it reads
    // differently from a question that has not come back yet.
    renderAt('/', stubApi({ projects: [] }));
    const select = await screen.findByLabelText('Project');
    await waitFor(() =>
      expect(within(select as HTMLElement).getByText(/no projects in this workspace/i)).toBeTruthy(),
    );
    expect(select.getAttribute('aria-busy')).toBeNull();
  });

  it('does not claim the workspace is empty while it is still asking', async () => {
    const api = stubApi();
    let release: ((projects: never[]) => void) | undefined;
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => new Promise((resolve) => { release = resolve as never; }),
    );
    renderAt('/', api);
    const select = await screen.findByLabelText('Project');
    expect(within(select as HTMLElement).queryByText(/no projects in this workspace/i)).toBeNull();
    release?.([]);
  });
});

describe('T438c · the breadcrumb reads workspace / project / area (UX-0012)', () => {
  it('has exactly three segments, in that order', async () => {
    renderAt('/runs');
    await waitFor(() => expect(breadcrumb().textContent).toContain('Runs'));
    const segments = within(breadcrumb())
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim() ?? '');
    expect(segments).toHaveLength(3);
    expect(segments[0]).toContain(WORKSPACE_ID);
    expect(segments[2]).toBe('Runs');
  });

  it('marks the area segment as the current page', async () => {
    renderAt('/runs');
    await waitFor(() => expect(breadcrumb().textContent).toContain('Runs'));
    const current = within(breadcrumb())
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe('Runs');
  });

  it('derives the area from the address, so it cannot disagree with it', async () => {
    // The reason `areaId` is not held in state (`data-model.md` §3): two
    // answers to "where am I" disagree the first time somebody uses back.
    renderAt('/storage');
    await waitFor(() =>
      expect(breadcrumb().textContent).toContain('Workspace & Administration'),
    );
  });

  it('names the project once one is selected', async () => {
    renderAt('/');
    const select = await screen.findByLabelText('Project');
    // The option has to exist before it can be chosen: a `change` naming a
    // value the select does not have is silently ignored.
    await waitFor(() =>
      expect(within(select as HTMLElement).getByRole('option', { name: PROJECT.name })).toBeTruthy(),
    );
    fireEvent.change(select, { target: { value: PROJECT.id } });
    await waitFor(() => expect(breadcrumb().textContent).toContain(PROJECT.name));
  });

  it('says "Not found" for an address that names no area', async () => {
    renderAt('/no-such-place', stubApi());
    await waitFor(() => expect(breadcrumb().textContent).toContain('Not found'));
  });
});
