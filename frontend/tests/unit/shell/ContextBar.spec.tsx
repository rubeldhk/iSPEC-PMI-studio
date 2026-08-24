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
import { afterEach, describe, expect, it } from 'vitest';
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
