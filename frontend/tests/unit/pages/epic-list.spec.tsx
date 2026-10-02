/**
 * `T1576` (EPIC-044, `FR-EPB-020`, `FR-EPB-024`, `FR-EPB-027`, `FR-EPB-041`,
 * `FR-EPB-047`) — the Epic list in the Requirement Room: a filtered table with
 * number, title, status, requirement count and stage; a create form; the
 * unassigned group; the owner gate; the four states. Written to FAIL before
 * `T1577`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EpicListPage } from '../../../src/pages/EpicList';
import { ApiError, type ApiClient, type Epic } from '../../../src/services/api';

const PROJECT = { id: 'p1', workspaceId: 'ws_a', name: 'Alpha', description: '', status: 'active', engineName: 'fixture', ownerUserId: 'u_owner', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' };

function epic(over: Partial<Epic> = {}): Epic {
  return {
    id: 'e1', projectId: 'p1', number: 1, slug: 'intake', title: 'Intake', description: 'First.', status: 'active',
    parentEpicId: null, splitSuffix: null, createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z', closedAt: null,
    requirementCount: 2, specificationCount: 1, ...over,
  };
}

const EPICS = [epic(), epic({ id: 'e2', number: 2, slug: 'review', title: 'Review', requirementCount: 0, specificationCount: 0 }), epic({ id: 'e3', number: 3, slug: 'reports', title: 'Reports', status: 'closed', closedAt: '2026-09-05T01:00:00Z', requirementCount: 0 })];
const UNASSIGNED = [{ id: 'r9', reference: 'REQ-009', status: 'active', epicId: null }, { id: 'r10', reference: 'REQ-010', status: 'retired', epicId: null }];
const BOARD = {
  epics: [
    { epicId: 'e1', number: 1, slug: 'intake', title: 'Intake', status: 'active', stage: 'Specified', missing: [], unrecognised: [], last: null, next: '/speckit-clarify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' },
    { epicId: 'e2', number: 2, slug: 'review', title: 'Review', status: 'active', stage: 'Not started', missing: [], unrecognised: [], last: null, next: '/speckit-specify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' },
    { epicId: 'e3', number: 3, slug: 'reports', title: 'Reports', status: 'closed', stage: 'Not started', missing: [], unrecognised: [], last: null, next: null, readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' },
  ],
  unbound: [],
  packageVersion: '0.1.0',
  profile: 'product',
};

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    listEpics: vi.fn(async () => ({ epics: EPICS, unassigned: UNASSIGNED })),
    getBoard: vi.fn(async () => BOARD),
    createEpic: vi.fn(async () => epic({ id: 'e4', number: 4, title: 'New' })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function page(client: ApiClient, currentUserId = 'u_owner') {
  const onOpen = vi.fn();
  render(<EpicListPage api={client} projectId="p1" currentUserId={currentUserId} onOpen={onOpen} />);
  await screen.findByRole('heading', { name: 'Epics' });
  await waitFor(() => expect(screen.queryByText('Loading Epics')).toBeNull());
  return { onOpen };
}

describe('T1576 · the Epic list', () => {
  it('lists every Epic in number order with number, title, status, requirements and stage, in a filtered table', async () => {
    await page(api());
    const table = screen.getByRole('table', { name: 'Epics' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/1.*Intake.*active.*2.*Specified/),
      expect.stringMatching(/2.*Review.*active.*0.*Not started/),
      expect.stringMatching(/3.*Reports.*closed.*0.*Not started/),
    ]);
    expect(screen.getByLabelText('Filter epics')).toBeDefined();
  });

  it('opens an Epic from its row', async () => {
    const { onOpen } = await page(api());
    fireEvent.click(screen.getByRole('button', { name: 'Open Intake' }));
    expect(onOpen).toHaveBeenCalledWith('e1');
  });

  it('lists the unassigned requirements as their own group with a count, retired included (FR-EPB-024)', async () => {
    await page(api());
    const group = screen.getByRole('region', { name: 'Unassigned requirements' });
    expect(group.textContent).toContain('2 requirements');
    expect(group.textContent).toContain('REQ-009');
    expect(group.textContent).toContain('REQ-010');
  });

  it('creates an Epic from the form and reloads', async () => {
    const client = api();
    await page(client);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fourth.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Epic' }));
    await waitFor(() => expect(client.createEpic).toHaveBeenCalledWith('p1', { title: 'New', description: 'Fourth.' }));
    await waitFor(() => expect(client.listEpics).toHaveBeenCalledTimes(2));
  });

  it('disables the form for a member without the owner grant and says why; reading still works (FR-EPB-027)', async () => {
    await page(api(), 'u_member');
    expect(screen.getByRole('button', { name: 'Create Epic' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/Only the project's owner may create Epics/)).toBeDefined();
    expect(screen.getByRole('table', { name: 'Epics' })).toBeDefined();
  });

  it('four states: loading, error, empty, partial', async () => {
    render(<EpicListPage api={api()} projectId="p1" currentUserId="u_owner" onOpen={vi.fn()} />);
    expect(screen.getByText('Loading Epics')).toBeDefined();
    cleanup();

    await page(api({ listEpics: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }), getBoard: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }), getProject: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Down.');
    cleanup();

    await page(api({ listEpics: vi.fn(async () => ({ epics: [], unassigned: [] })), getBoard: vi.fn(async () => ({ ...BOARD, epics: [] })) }));
    expect(screen.getByText('No Epics yet.')).toBeDefined();
    cleanup();

    await page(api({ getBoard: vi.fn(async () => { throw new ApiError('internal_error', 'Stages down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Some of this screen did not load');
    expect(screen.getByRole('table', { name: 'Epics' })).toBeDefined();
  });
});
