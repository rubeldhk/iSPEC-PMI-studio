/**
 * T760 — the Inbox by keyboard alone. `BR-0193`, `UX-0021`.
 *
 * Every action is a native control in reading order, each named for the item it
 * acts on (*"Approve release.promote on release r-1"*, not *"Approve"* five
 * times), the result of an action is announced in a live region, and focus is
 * never dropped on the floor: after an item leaves, focus moves to the Inbox
 * heading rather than to the document body.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DecisionInboxPage } from '../../../src/pages/DecisionInbox';
import type { ApiClient, InboxEntry } from '../../../src/services/api';

afterEach(cleanup);

const entry = (id: string, actionType: string): InboxEntry => ({
  decisionId: id,
  kind: 'approval',
  actionType,
  objectRef: { type: 'release', id: `r-${id}` },
  objectVersion: '1',
  projectId: 'p1',
  band: 'high',
  requestedBy: 'u_alice',
  blockedBy: 'awaits approval',
  since: '2026-10-08T09:00:00.000Z',
});

function api(pages: InboxEntry[][]): ApiClient {
  let call = 0;
  return {
    decisionInbox: vi.fn(async () => ({ entries: pages[Math.min(call++, pages.length - 1)]! })),
    approveDecision: vi.fn(async () => ({ outcome: 'approved' })),
  } as unknown as ApiClient;
}

describe('T760 · BR-0193 — operable by keyboard alone', () => {
  it('names every action for the item it acts on, so a screen reader can tell them apart', async () => {
    render(<DecisionInboxPage api={api([[entry('1', 'release.promote'), entry('2', 'loop.configuration.change')]])} />);
    expect(await screen.findByRole('button', { name: 'Approve release.promote on release r-1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve loop.configuration.change on release r-2' })).toBeTruthy();
  });

  it('uses native buttons — reachable by Tab and activated by Enter or Space without custom key handling', async () => {
    render(<DecisionInboxPage api={api([[entry('1', 'release.promote')]])} />);
    const button = await screen.findByRole('button', { name: /approve/i });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('tabindex')).not.toBe('-1');
  });

  it('announces the result in a live region', async () => {
    render(<DecisionInboxPage api={api([[entry('1', 'release.promote')], []])} />);
    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toMatch(/approved release\.promote/i));
  });

  it('moves focus to the Inbox heading after an item leaves, never to the body', async () => {
    render(<DecisionInboxPage api={api([[entry('1', 'release.promote')], []])} />);
    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: /decision inbox/i })));
  });

  it('labels the lists so each is announced with what it contains', async () => {
    render(<DecisionInboxPage api={api([[entry('1', 'release.promote')]])} />);
    expect(await screen.findByRole('list', { name: /awaiting your approval/i })).toBeTruthy();
  });
});
