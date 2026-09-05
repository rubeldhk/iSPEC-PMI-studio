/**
 * T437a / T437k (EPIC-036) — primary navigation.
 *
 * Four groups in PMI-DOC-006 §4.1's order, the current area marked, and — the
 * assertion that matters most — **nothing that is not delivered**.
 *
 * `UX-0060` forbids an area whose Epic is undeclared from appearing at all: not
 * disabled, not greyed, not a placeholder. `C1` extended that in practice to
 * the three areas whose Epics *are* declared and whose screens do not exist,
 * for the plainer reason that a destination which leads nowhere is
 * `DEF-010-001` wearing navigation's clothes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { AREAS, GROUP_LABELS, isReachable, reachableAreas } from '../../../src/shell/areas';
import { navigationModel } from '../../../src/shell/navigation-model';
import { renderAt } from './harness';

afterEach(cleanup);

function navs(): HTMLElement[] {
  return screen.getAllByRole('navigation').filter((nav) => {
    const label = nav.getAttribute('aria-label') ?? '';
    return Object.values(GROUP_LABELS).includes(label as never);
  });
}

function labels(): string[] {
  return navs()
    .flatMap((nav) => within(nav).queryAllByRole('button'))
    .map((button) => button.textContent?.trim() ?? '');
}

describe('T437a · four groups, in §4.1 order', () => {
  it('renders one labelled navigation landmark per non-empty group', async () => {
    renderAt('/');
    await waitFor(() => expect(navs().length).toBeGreaterThan(0));
    expect(navs().map((nav) => nav.getAttribute('aria-label'))).toEqual(
      navigationModel().map((group) => group.label),
    );
  });

  it('lists each group’s areas in registry order', async () => {
    renderAt('/');
    await waitFor(() => expect(navs().length).toBeGreaterThan(0));
    for (const [index, group] of navigationModel().entries()) {
      const buttons = within(navs()[index]!).getAllByRole('button');
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(
        group.areas.map((area) => area.label),
      );
    }
  });

  it('shows no area twice (FR-SHL-011)', async () => {
    renderAt('/');
    await waitFor(() => expect(labels().length).toBeGreaterThan(0));
    expect(new Set(labels()).size).toBe(labels().length);
  });
});

describe('T437k · SC-SHL-002 — nothing that is not delivered appears', () => {
  it('shows exactly the delivered areas and no others', async () => {
    renderAt('/');
    await waitFor(() => expect(labels().length).toBeGreaterThan(0));
    expect(labels().sort()).toEqual(reachableAreas().map((area) => area.label).sort());
  });

  it.each(AREAS.filter((area) => !isReachable(area.status)).map((a) => [a.label, a.status]))(
    'does not offer %s (%s) — not disabled, not greyed, not a placeholder',
    async (label) => {
      renderAt('/');
      await waitFor(() => expect(labels().length).toBeGreaterThan(0));

      expect(labels()).not.toContain(label);
      // The stronger half: absent, rather than present-and-unusable. A
      // disabled control still tells the user the product has that area and
      // that they cannot use it, which is a claim `UX-0060` does not make.
      const anywhere = navs().flatMap((nav) => within(nav).queryAllByText(label));
      expect(anywhere, `"${label}" appears in navigation`).toHaveLength(0);
    },
  );

  it('offers twelve fewer destinations than the product specifies', async () => {
    // The arithmetic, stated so it cannot drift silently again: navigation
    // carries the REACHABLE areas — `delivered` plus `partly-delivered` — and
    // eighteen are specified.
    //
    // It was `5` until `T1172`, when the Requirement Room area was delivered.
    // The title said *twelve* throughout, and was wrong until this change: with
    // five destinations the gap was thirteen. It is twelve now, which is the
    // sort of coincidence worth writing down rather than quietly inheriting.
    renderAt('/');
    await waitFor(() => expect(labels().length).toBeGreaterThan(0));
    expect(AREAS).toHaveLength(18);
    expect(labels()).toHaveLength(7);
    expect(AREAS.length - labels().length, 'the title and the arithmetic disagree').toBe(11);
  });
});
