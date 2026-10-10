/**
 * T2513 — the Decision Inbox detail-renderer registry. `FR-DPE-027`
 * (amendment `A-031-2`, for `EPIC-048`).
 *
 * Another Epic may register how an entry for its object type is shown — the
 * learning candidate's evidence and scope, for `EPIC-048`. The registry is
 * additive: an entry with no renderer renders exactly as before, and a renderer
 * adds detail inside the entry without changing which entries appear, their
 * order, the statement of what blocks them, or the actions offered.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DecisionInboxPage } from '../../../src/pages/DecisionInbox';
import { createInboxRendererRegistry, type InboxDetailRenderer } from '../../../src/pages/decision-inbox-renderers';
import type { ApiClient, InboxEntry } from '../../../src/services/api';

afterEach(cleanup);

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    decisionId: 'd1',
    kind: 'approval',
    actionType: 'learning.promote',
    objectRef: { type: 'learning-candidate', id: 'c-1' },
    objectVersion: 'sha-1',
    projectId: 'p1',
    band: 'high',
    requestedBy: 'svc-learning',
    blockedBy: 'awaits approval by an authorized human other than svc-learning (FR-DPE-010, FR-DPE-015)',
    since: '2026-10-09T09:00:00.000Z',
    ...over,
  };
}

const release = entry({ decisionId: 'd0', actionType: 'release.promote', objectRef: { type: 'release', id: 'r-1' }, since: '2026-10-09T08:00:00.000Z' });
const candidate = entry();

function api(entries: InboxEntry[]): ApiClient {
  return {
    decisionInbox: vi.fn(async () => ({ entries })),
    approveDecision: vi.fn(),
    refuseDecision: vi.fn(),
  } as unknown as ApiClient;
}

const CandidateDetail: InboxDetailRenderer = ({ entry: e }) => <p>Candidate {e.objectRef.id} — evidence and scope</p>;

async function items(entries: InboxEntry[], registry = createInboxRendererRegistry()) {
  render(<DecisionInboxPage api={api(entries)} renderers={registry} />);
  await screen.findAllByRole('listitem');
  const html = screen.getAllByRole('listitem').map((li) => li.innerHTML);
  cleanup();
  return html;
}

describe('T2513 · FR-DPE-027 — additive: no renderer, no change', () => {
  it('renders an entry whose type has no renderer exactly as an Inbox with no registrations does', async () => {
    const registry = createInboxRendererRegistry();
    registry.register('learning-candidate', CandidateDetail);
    const [plain] = await items([release]);
    const [withRegistry] = await items([release], registry);
    expect(withRegistry).toBe(plain);
  });
});

describe('T2513 · FR-DPE-027 — a registered renderer adds detail inside its entry', () => {
  it('passes the entry to the renderer and shows it inside that entry only', async () => {
    const registry = createInboxRendererRegistry();
    const seen = vi.fn(CandidateDetail);
    registry.register('learning-candidate', seen);
    render(<DecisionInboxPage api={api([release, candidate])} renderers={registry} />);
    const [first, second] = await screen.findAllByRole('listitem');
    expect(within(second!).getByText(/Candidate c-1 — evidence and scope/)).toBeTruthy();
    expect(within(first!).queryByText(/evidence and scope/)).toBeNull();
    expect(seen.mock.calls.map(([props]) => props.entry)).toEqual([candidate]);
  });

  it('keeps membership, order, what blocks the entry, and the Approve and Reject controls', async () => {
    const registry = createInboxRendererRegistry();
    registry.register('learning-candidate', CandidateDetail);
    render(<DecisionInboxPage api={api([release, candidate])} renderers={registry} />);
    const list = await screen.findAllByRole('listitem');
    expect(list).toHaveLength(2);
    expect(within(list[0]!).getByText('release.promote')).toBeTruthy();
    const item = list[1]!;
    expect(within(item).getByText(/awaits approval by an authorized human/)).toBeTruthy();
    expect(within(item).getByRole('button', { name: 'Approve learning.promote on learning-candidate c-1' })).toBeTruthy();
    expect(within(item).getByRole('button', { name: 'Reject learning.promote on learning-candidate c-1' })).toBeTruthy();
  });

  it('refuses a second renderer for the same type — one owner per type', () => {
    const registry = createInboxRendererRegistry();
    registry.register('learning-candidate', CandidateDetail);
    expect(() => registry.register('learning-candidate', CandidateDetail)).toThrow(/learning-candidate/);
  });
});
