/**
 * T440c / T440e / T440g / T440i (EPIC-036) — the shell on a keyboard, at 360px,
 * and under axe.
 *
 * `BR-0193` and `UX-0040` are both MUSTs, and navigation that collapses into
 * unreachability at 360px fails `BR-0190` on the device it fails on.
 *
 * **What a machine cannot do here.** Whether focus order *makes sense* and
 * whether an announcement is *meaningful* are human judgements — `EPIC-029`
 * `T885` records the standard and why an agent cannot meet it. These assertions
 * cover the mechanical half: the order matches the visible order, the landmarks
 * exist and are named, and axe finds nothing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { expectNoViolations } from '../a11y/axe';
import { AREAS, GROUP_LABELS, deliveredAreas } from '../../../src/shell/areas';
import { navigationModel } from '../../../src/shell/navigation-model';
import { renderAt } from './harness';

/** jsdom implements no `matchMedia`; the shell treats its absence as "wide". */
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

beforeEach(() => {
  setViewport(false);
});

afterEach(cleanup);

describe('T440e · exactly one main landmark, at every address', () => {
  // The check that found a real gap: `/storage` with no project selected
  // rendered NO `<main>` at all, because six delivered pages carry their own
  // landmark and four do not, and the no-project branch hands off to neither.
  // Nesting two and having none are both faults, and only a check over every
  // address can tell which one a given screen has.
  const addresses = [
    ...deliveredAreas().map((area) => area.path),
    '/projects/p1',
    '/specifications/s1',
    '/specifications/s1/tasks',
    '/runs/run_1',
    '/traceability',
    '/governance',
    '/no-such-place',
  ];

  it('has addresses to check, or this proves nothing', () => {
    expect(addresses.length).toBeGreaterThanOrEqual(10);
  });

  it.each(addresses)('%s renders exactly one main landmark', async (path) => {
    renderAt(path);
    await waitFor(() => expect(screen.getAllByRole('main')).toHaveLength(1));
  });
});

describe('T440e · groups are announced as groups, the current area as current', () => {
  it('names every navigation landmark after its group (FR-SHL-053)', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0));
    const labels = screen
      .getAllByRole('navigation')
      .map((nav) => nav.getAttribute('aria-label'))
      .filter((label): label is string => Object.values(GROUP_LABELS).includes(label as never));
    expect(labels).toEqual(navigationModel().map((group) => group.label));
  });

  it('marks the current area with aria-current, not colour alone', async () => {
    renderAt('/runs');
    await waitFor(() => {
      const current = screen
        .getAllByRole('navigation')
        .flatMap((nav) => within(nav).queryAllByRole('button'))
        .filter((button) => button.getAttribute('aria-current') === 'page');
      expect(current.map((button) => button.textContent?.trim())).toEqual(['Runs']);
    });
  });

  it('gives the breadcrumb its own named landmark, distinct from navigation', async () => {
    renderAt('/runs');
    expect(await screen.findByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
  });
});

describe('T440c · focus order follows visible order', () => {
  it('puts navigation buttons in registry order in the tab sequence', async () => {
    // Focus order is DOM order for natively focusable controls with no
    // `tabindex` above 0. So the assertion that carries weight is that nothing
    // sets a positive tabindex — the one thing that would divorce the two.
    renderAt('/');
    await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0));

    const buttons = screen
      .getAllByRole('navigation')
      .flatMap((nav) => within(nav).queryAllByRole('button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(
      deliveredAreas().map((area) => area.label),
    );
    for (const button of buttons) {
      const tabindex = button.getAttribute('tabindex');
      expect(tabindex === null || Number(tabindex) <= 0).toBe(true);
    }
  });

  it('leaves no delivered area unreachable by keyboard', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0));
    const reachable = screen
      .getAllByRole('navigation')
      .flatMap((nav) => within(nav).queryAllByRole('button'))
      .filter((button) => !button.hasAttribute('disabled'));
    expect(reachable).toHaveLength(deliveredAreas().length);
  });
});

describe('T440i · SC-SHL-007 — every area reachable by keyboard at 360px', () => {
  it('reaches all of them through the drawer at the narrow width', async () => {
    setViewport(true);
    renderAt('/');
    const toggle = await screen.findByRole('button', { name: 'Menu' });
    expect(toggle.hasAttribute('disabled')).toBe(false);

    toggle.click();
    await waitFor(() => {
      const inDrawer = screen
        .getAllByRole('navigation')
        .flatMap((nav) => within(nav).queryAllByRole('button'))
        .map((button) => button.textContent?.trim());
      for (const area of deliveredAreas()) {
        expect(inDrawer, `${area.label} is unreachable at 360px`).toContain(area.label);
      }
    });
  });

  it('would still reach all eighteen if every area were delivered', async () => {
    // The worst case the drawer must survive, asserted over the model rather
    // than by delivering twelve areas: `FR-SHL-054` chose a scrolling grouped
    // list precisely so eighteen fit, and hiding a group is not the answer.
    const all = AREAS.map((area) => ({ ...area, status: 'delivered' as const }));
    expect(navigationModel(all).flatMap((group) => group.areas)).toHaveLength(18);
    expect(navigationModel(all)).toHaveLength(4);
  });
});

describe('T440g · SC-SHL-008 — zero axe violations on the shell', () => {
  it.each(['/', '/projects', '/runs', '/governance', '/no-such-place'])(
    '%s passes the WCAG 2.2 AA harness',
    async (path) => {
      renderAt(path);
      await waitFor(() => expect(screen.getAllByRole('main')).toHaveLength(1));
      await expectNoViolations();
    },
  );

  it('passes at the narrow width, with the drawer open', async () => {
    setViewport(true);
    renderAt('/');
    const toggle = await screen.findByRole('button', { name: 'Menu' });
    toggle.click();
    await waitFor(() => expect(screen.getAllByRole('navigation').length).toBeGreaterThan(1));
    await expectNoViolations();
  });

  it('passes with an explicit dark override applied at the root', async () => {
    // Both themes, as `SC-SHL-008` asks. Contrast itself is not axe's here —
    // jsdom computes no layout, so the harness disables `color-contrast` and
    // the token pairs are checked in `tests/governance/design-tokens.spec.ts`
    // (T872, R-029-3). What changes in the DOM is `data-theme`, and that is
    // what this exercises.
    document.documentElement.dataset['theme'] = 'dark';
    renderAt('/');
    await waitFor(() => expect(screen.getAllByRole('main')).toHaveLength(1));
    await expectNoViolations();
    delete document.documentElement.dataset['theme'];
  });
});
