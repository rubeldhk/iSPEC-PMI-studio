/**
 * T437l / T437n (EPIC-036) — `FR-SHL-017`: areas have addresses.
 *
 * *"Send me the link"* had no answer. Until this Epic the product held its
 * location in a `useState` union and **the address bar never left `/`** — so
 * nothing was bookmarkable, nothing was shareable, and the browser's back
 * control did whatever the browser does when an application ignores it.
 *
 * Three claims, asserted separately because they fail separately:
 *   1. every delivered area resolves from its own address (`SC-SHL-010`);
 *   2. back returns to the previous location;
 *   3. an address the shell does not host answers **not found** — never an
 *      empty area inside working chrome (`SC-SHL-011`).
 *
 * The third covers **both** non-delivered states. From an address's point of
 * view *"forbidden to build"* (`UX-0060`) and *"specified but not built yet"*
 * are the same answer, and only the page's wording differs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { App } from '../../../src/main';
import { AREAS, isReachable, reachableAreas } from '../../../src/shell/areas';
import { renderAt, stubApi } from './harness';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

function crumb(): string {
  return document.querySelector('.ds-topbar__location')?.textContent ?? '';
}

describe('T437l · every delivered area resolves from its own address', () => {
  it.each(reachableAreas().map((area) => [area.path, area.label] as const))(
    '%s resolves to %s',
    async (path, label) => {
      renderAt(path);
      await waitFor(() => expect(crumb()).toContain(label));
    },
  );

  it('survives a refresh — a fresh mount at the same address lands in the same area', async () => {
    // A refresh IS a fresh mount at the same URL. Nothing is carried over in
    // memory, which is exactly the property `SC-SHL-010` asks for and exactly
    // what a `useState` union could never have.
    renderAt('/runs');
    await waitFor(() => expect(crumb()).toContain('Runs'));
    cleanup();

    renderAt('/runs');
    await waitFor(() => expect(crumb()).toContain('Runs'));
  });

  it('goes back to where the user was', async () => {
    window.history.pushState({}, '', '/');
    render(
      <BrowserRouter>
        <App api={stubApi()} />
      </BrowserRouter>,
    );
    await waitFor(() => expect(crumb()).toContain('Home'));

    const runs = screen
      .getAllByRole('navigation')
      .flatMap((nav) => within(nav).queryAllByRole('button'))
      .find((button) => button.textContent?.trim() === 'Runs');
    fireEvent.click(runs!);

    await waitFor(() => expect(window.location.pathname).toBe('/runs'));

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    await waitFor(() => expect(crumb()).toContain('Home'));
  });
});

describe('T437n · an address the shell does not host answers not found', () => {
  const notDelivered = AREAS.filter((area) => !isReachable(area.status));

  it('covers both non-delivered states, or it is not the assertion it claims', () => {
    // Anti-vacuity with teeth: if the registry ever held only one kind of
    // non-delivered area, the `it.each` below would silently stop testing the
    // distinction this Epic exists to draw.
    // T1016 — after Constitution XII Step B, `undeclared` is deliberately
    // EMPTY: every area names its Epic. The unreachable set is therefore one
    // state, not two, and requiring two would force a false `undeclared` entry
    // to satisfy the assertion. What still needs teeth is that the set is not
    // empty and that `undeclared`, if it ever gains a member, is covered here.
    const states = new Set(notDelivered.map((area) => area.status));
    expect(notDelivered.length, 'no unreachable areas to check').toBeGreaterThan(0);
    expect([...states].sort()).toEqual(['declared-not-delivered']);
    expect(
      AREAS.filter((area) => area.status === 'undeclared'),
      'an area is undeclared and therefore untested here',
    ).toEqual([]);
  });

  it.each(notDelivered.map((area) => [area.path, area.label] as const))(
    '%s (%s) is not found, not an empty area',
    async (path) => {
      renderAt(path);
      await waitFor(() => expect(screen.getAllByText(/not found/i).length).toBeGreaterThan(0));
    },
  );

  it('an address naming nothing at all is not found', async () => {
    renderAt('/no-such-place');
    await waitFor(() => expect(screen.getAllByText(/not found/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/Nothing at \/no-such-place/)).toBeDefined();
  });

  it('tells a specified-but-unbuilt area apart from a typo, and names its owner', async () => {
    // `/reports` is `declared-not-delivered` (Governance was delivered by EPIC-042). "No such page" would be false
    // — it IS part of the product — and an empty Reports area would be
    // worse: a screen that looks like it works and shows nothing.
    renderAt('/reports');
    await waitFor(() => expect(screen.getByText(/Reports is not available yet/)).toBeDefined());
    expect(screen.getByText(/EPIC-040/)).toBeDefined();
  });

  it('still frames the answer — a not-found is a page, not a blank document', async () => {
    // `DEF-001-006` is `EPIC-001`'s open defect: the API answers 500 for an
    // unmatched path. The client's not-found must not add to that by
    // rendering nothing at all.
    renderAt('/no-such-place');
    await waitFor(() => expect(screen.getAllByText(/not found/i).length).toBeGreaterThan(0));
    expect(document.querySelector('.ds-topbar')).not.toBeNull();
    expect(screen.getByRole('link', { name: /go to home/i })).toBeDefined();
  });
});
