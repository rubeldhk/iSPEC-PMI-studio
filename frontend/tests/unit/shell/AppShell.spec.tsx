/**
 * T437c (EPIC-036) — the frame: what stays, and what it must not contain.
 *
 * `FR-SHL-012` says navigation remains present while an area is open. That
 * sounds obvious and is exactly what the old shell could not do — it re-rendered
 * a `switch` per view, so "present" was a property of each branch rather than of
 * the frame.
 *
 * The other half is `FR-SHL-003`: **the shell renders no area's content**. The
 * area arrives through `<Outlet />` and the shell never looks inside it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { deliveredAreas } from '../../../src/shell/areas';
import { renderAt } from './harness';

afterEach(cleanup);

function navButtons(): HTMLElement[] {
  return screen.getAllByRole('navigation').flatMap((nav) => within(nav).queryAllByRole('button'));
}

describe('T437c · the frame composes navigation, context and the outlet', () => {
  it('renders EPIC-029’s adopted frame rather than a second one', async () => {
    // `.ds-shell` / `.ds-topbar` / `.ds-content` are prototype parity row 10,
    // held by `T924` and scanned by `T930`. The shell lives inside them.
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    expect(document.querySelector('.ds-shell')).not.toBeNull();
    expect(document.querySelector('.ds-topbar')).not.toBeNull();
    expect(document.querySelector('.ds-content')).not.toBeNull();
  });

  it('renders navigation, a breadcrumb and one content region', async () => {
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeDefined();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('keeps the frame across a navigation, rather than rebuilding it', async () => {
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    const sidebar = document.querySelector('.shell__sidebar');
    expect(sidebar).not.toBeNull();

    fireEvent.click(navButtons().find((b) => b.textContent?.trim() === 'Runs')!);
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Runs'),
    );

    // The SAME node, not an equivalent one: the frame stayed mounted.
    expect(document.querySelector('.shell__sidebar')).toBe(sidebar);
  });

  it('offers exactly the delivered areas, and no content of its own', async () => {
    renderAt('/');
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    expect(navButtons()).toHaveLength(deliveredAreas().length);
  });

  it('puts the theme control in the frame, not in an area', async () => {
    // `FR-DS-011` grants the override to the user of the application, not to
    // one page. It has to survive every navigation, and living in the frame is
    // what makes that structural rather than remembered.
    renderAt('/runs');
    // Wait for the shell to settle first. The control exists during the
    // restoring frame too, and a node grabbed then is stale by the time the
    // signed-in frame replaces the location segment beside it.
    await waitFor(() => expect(navButtons().length).toBeGreaterThan(0));
    const control = screen.getByLabelText(/theme/i);
    expect(document.querySelector('.ds-topbar')?.contains(control)).toBe(true);
  });
});
