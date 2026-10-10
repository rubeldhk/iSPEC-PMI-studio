/**
 * T757 — the Decision Inbox page, written to fail first. `FR-DPE-020`,
 * `FR-DPE-021`, `FR-DPE-023`, `FR-DPE-025`, `FR-DPE-026`, `UX-0051`.
 *
 * Four defined states — loading, empty, populated, error — and an empty state
 * that **says so** rather than rendering blank: an Inbox that shows nothing
 * because there is nothing looks exactly like one that shows nothing because it
 * broke, unless it tells you which.
 *
 * Populated: every entry names the action and the object it concerns
 * (`FR-DPE-023`) and what would unblock it (`FR-DPE-025`), without opening the
 * artifact (`FR-DPE-021`). An approval can be approved from here; a refusal of
 * that approval shows its reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DecisionInboxPage } from '../../../src/pages/DecisionInbox';
import { ApiError, type ApiClient, type InboxEntry } from '../../../src/services/api';

afterEach(cleanup);

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    decisionId: 'd1',
    kind: 'approval',
    actionType: 'release.promote',
    objectRef: { type: 'release', id: 'r-1' },
    objectVersion: '4',
    projectId: 'p1',
    band: 'high',
    requestedBy: 'u_alice',
    blockedBy: 'awaits approval by an authorized human other than u_alice (FR-DPE-010, FR-DPE-015)',
    since: '2026-10-08T09:00:00.000Z',
    ...over,
  };
}

function stubApi(inbox: InboxEntry[][] | Error, approve?: () => Promise<unknown>): ApiClient {
  let call = 0;
  return {
    decisionInbox: vi.fn(async () => {
      if (inbox instanceof Error) throw inbox;
      const entries = inbox[Math.min(call, inbox.length - 1)]!;
      call += 1;
      return { entries };
    }),
    approveDecision: vi.fn(approve ?? (async () => ({ outcome: 'approved' }))),
  } as unknown as ApiClient;
}

describe('T757 · FR-DPE-026 — four defined states', () => {
  it('shows a loading state while the Inbox is read', () => {
    render(<DecisionInboxPage api={stubApi([[]])} />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('says it is empty, rather than rendering blank', async () => {
    render(<DecisionInboxPage api={stubApi([[]])} />);
    expect(await screen.findByText(/nothing is waiting for you/i)).toBeTruthy();
  });

  it('shows the failure, and what to do about it, when the Inbox cannot be read', async () => {
    render(<DecisionInboxPage api={stubApi(new ApiError('provider_unavailable', 'The decision engine could not be reached.', 502))} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/could not be reached/)).toBeTruthy();
  });
});

describe('T757 · populated — everything awaiting you, without opening an artifact', () => {
  it('names the action, the object, its version, the band and the requester (FR-DPE-021, FR-DPE-023)', async () => {
    render(<DecisionInboxPage api={stubApi([[entry()]])} />);
    const item = await screen.findByRole('listitem');
    expect(within(item).getByText('release.promote')).toBeTruthy();
    expect(within(item).getByText(/release r-1/)).toBeTruthy();
    expect(within(item).getByText(/v4/)).toBeTruthy();
    expect(within(item).getByText(/high/i)).toBeTruthy();
    expect(within(item).getByText('u_alice')).toBeTruthy();
  });

  it('names what would unblock a blocked item (FR-DPE-025)', async () => {
    const blocked = entry({ decisionId: 'd2', kind: 'blocked', blockedBy: 'gate tests-green is violation — no GateProvider is bound' });
    render(<DecisionInboxPage api={stubApi([[blocked]])} />);
    expect(await screen.findByText(/gate tests-green is violation/)).toBeTruthy();
  });

  it('separates approvals from blocked work', async () => {
    render(<DecisionInboxPage api={stubApi([[entry(), entry({ decisionId: 'd2', kind: 'blocked', blockedBy: 'policy refused' })]])} />);
    expect(await screen.findByRole('heading', { name: /awaiting your approval/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /blocked/i })).toBeTruthy();
  });

  it('offers approve only on approvals', async () => {
    render(<DecisionInboxPage api={stubApi([[entry({ decisionId: 'd2', kind: 'blocked', blockedBy: 'policy refused' })]])} />);
    await screen.findByText(/policy refused/);
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
  });
});

describe('T757 · approving from the Inbox', () => {
  it('approves, then re-reads — the decided item leaves (FR-DPE-024)', async () => {
    const api = stubApi([[entry()], []]);
    render(<DecisionInboxPage api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: /approve release\.promote/i }));
    await waitFor(() => expect(api.approveDecision).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText(/nothing is waiting for you/i)).toBeTruthy();
  });

  it('shows why an approval was refused, from the decision’s own explanation', async () => {
    const refused = new ApiError('forbidden', 'You may not approve this decision.', 403, {
      decisionId: 'd1',
      result: { explanation: { authorityApplied: 'u_alice requested this and may not approve it (FR-DPE-015)' } },
    });
    const api = stubApi([[entry()]], async () => {
      throw refused;
    });
    render(<DecisionInboxPage api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: /approve release\.promote/i }));
    // On the item itself, beside the action it refused — and announced as well.
    const item = await screen.findByRole('listitem');
    expect(await within(item).findByText(/may not approve it \(FR-DPE-015\)/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Approval refused/);
  });
});
