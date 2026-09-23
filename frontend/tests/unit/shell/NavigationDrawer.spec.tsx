/**
 * T440a (EPIC-036) — navigation below the narrow breakpoint.
 *
 * `FR-SHL-054`, settled at clarification: a **drawer carrying the full grouped
 * list**, not an icon rail and not a per-group control. One navigation model at
 * every width, so there is one thing to build, test and describe — and the
 * grouping that makes eighteen areas legible survives the case where it matters
 * most.
 *
 * The drawer renders `ShellNavigation` itself rather than a copy. Two lists
 * that must agree is the shape `DEF-010-001` took, and a drawer that had
 * drifted from the sidebar would be that defect at one viewport width.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { reachableAreas } from '../../../src/shell/areas';
import { navigationModel } from '../../../src/shell/navigation-model';
import { clickByName, renderAt } from './harness';

function setViewport(narrow: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: narrow && query.includes('max-width'),
      media: query,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      onchange: null,
      dispatchEvent: (): boolean => false,
    }),
  });
}

function navLabels(): string[] {
  return screen
    .getAllByRole('navigation')
    .flatMap((nav) => within(nav).queryAllByRole('button'))
    .map((button) => button.textContent?.trim() ?? '');
}

afterEach(cleanup);
beforeEach(() => setViewport(true));

describe('T440a · the drawer at a narrow width', () => {
  it('offers a persistent control instead of the sidebar', async () => {
    renderAt('/');
    expect(await screen.findByRole('button', { name: 'Menu' })).toBeDefined();
    // Closed: no area is in the tab order behind an invisible surface.
    expect(navLabels()).not.toContain('Runs');
  });

  it('carries the FULL grouped list when opened', async () => {
    renderAt('/');
    await clickByName('Menu');

    await waitFor(() => {
      for (const group of navigationModel()) {
        expect(
          screen.getByRole('navigation', { name: group.label }),
          `group "${group.label}" is missing from the drawer`,
        ).toBeDefined();
      }
      // Inside the wait, not after it: the groups can be present a render
      // before their buttons are.
      for (const area of reachableAreas()) {
        expect(navLabels(), `${area.label} is unreachable at this width`).toContain(area.label);
      }
    });
  });

  it('renders the same navigation the sidebar does, not a copy of it', async () => {
    renderAt('/');
    await clickByName('Menu');
    await waitFor(() => expect(navLabels()).toContain('Runs'));
    const narrow = navLabels().sort();

    cleanup();
    setViewport(false);
    renderAt('/');
    await waitFor(() => expect(navLabels()).toContain('Runs'));
    expect(navLabels().sort()).toEqual(narrow);
  });

  it('tells assistive technology whether it is open', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Menu' });
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false');
    await clickByName('Menu');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe(
        'true',
      ),
    );
  });

  it('closes itself after a selection', async () => {
    // A drawer left open over the area it just opened hides the thing the user
    // asked for, at the width where there is least room for it.
    renderAt('/');
    await clickByName('Menu');
    await waitFor(() => expect(navLabels()).toContain('Runs'));

    const runs = screen
      .getAllByRole('navigation')
      .flatMap((nav) => within(nav).queryAllByRole('button'))
      .find((button) => button.textContent?.trim() === 'Runs');
    fireEvent.click(runs!);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Menu' })).toBeDefined());
    expect(navLabels()).not.toContain('Runs');
  });

  it('shows the sidebar and no drawer control at a wide width', async () => {
    setViewport(false);
    renderAt('/');
    await waitFor(() => expect(navLabels()).toContain('Runs'));
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });
});
