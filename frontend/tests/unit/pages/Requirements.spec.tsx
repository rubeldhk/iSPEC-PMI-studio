/**
 * T070a — the requirement register page: filter behaviour.
 * Written to FAIL before T071 exists (Constitution V).
 *
 * FR-008: filter and sort by type, priority, and status. The register is a
 * QUERY of the API, not a client-side sieve — every filter change goes back
 * through `listRequirements`, where the indexes are.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequirementsPage } from '../../../src/pages/Requirements';
import type { ApiClient, Requirement } from '../../../src/services/api';

function requirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 'r1',
    workspaceId: 'ws_a',
    projectId: 'p1',
    reference: 'REQ-001',
    description: 'The system shall sign users in.',
    type: 'functional',
    priority: 'p1',
    status: 'active',
    contentHash: 'h',
    retiredAt: null,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

afterEach(cleanup);

describe('RequirementsPage · register', () => {
  it('lists the project\'s requirements with reference, type, priority, and status', async () => {
    const api = {
      listRequirements: vi.fn(async () => [
        requirement(),
        requirement({ id: 'r2', reference: 'REQ-002', type: 'business', priority: 'p2' }),
      ]),
    } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    expect(await screen.findByText('REQ-001')).toBeDefined();
    expect(screen.getByText('REQ-002')).toBeDefined();
    expect(api.listRequirements).toHaveBeenCalledWith('p1', {});
  });

  it('a retired requirement is shown flagged, not hidden (FR-006)', async () => {
    const api = {
      listRequirements: vi.fn(async () => [
        requirement({ status: 'retired', retiredAt: '2026-08-20T10:00:00Z' }),
      ]),
    } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    expect(await screen.findByText(/retired/i)).toBeDefined();
  });
});

describe('RequirementsPage · filter behaviour (FR-008)', () => {
  it('re-queries the API when a filter changes — type, priority, then status', async () => {
    const listRequirements = vi.fn(async () => [requirement()]);
    const api = { listRequirements } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    await screen.findByText('REQ-001');

    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'functional' } });
    await vi.waitFor(() => {
      expect(listRequirements).toHaveBeenLastCalledWith('p1', { type: 'functional' });
    });

    fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: 'p1' } });
    await vi.waitFor(() => {
      expect(listRequirements).toHaveBeenLastCalledWith('p1', { type: 'functional', priority: 'p1' });
    });

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'active' } });
    await vi.waitFor(() => {
      expect(listRequirements).toHaveBeenLastCalledWith('p1', {
        type: 'functional',
        priority: 'p1',
        status: 'active',
      });
    });
  });

  it('clearing a filter removes it from the query instead of sending an empty string', async () => {
    const listRequirements = vi.fn(async () => [requirement()]);
    const api = { listRequirements } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    await screen.findByText('REQ-001');

    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'functional' } });
    await vi.waitFor(() => {
      expect(listRequirements).toHaveBeenLastCalledWith('p1', { type: 'functional' });
    });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: '' } });
    await vi.waitFor(() => {
      expect(listRequirements).toHaveBeenLastCalledWith('p1', {});
    });
  });

  it('an empty filtered register says so', async () => {
    const api = { listRequirements: vi.fn(async () => []) } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    expect(await screen.findByText(/no requirements/i)).toBeDefined();
  });
});

describe('T1580 · requirement rows name their Epic (EPIC-044, FR-EPB-023, FR-EPB-024)', () => {
  it('shows Epic <number> · <title> for an assigned requirement and unassigned for the rest', async () => {
    const api = {
      listRequirements: vi.fn(async () => [
        requirement({ id: 'r1', reference: 'REQ-001', epicId: 'e2', epicNumber: 2, epicTitle: 'Review' }),
        requirement({ id: 'r2', reference: 'REQ-002', epicId: null, epicNumber: null, epicTitle: null }),
      ]),
    } as unknown as ApiClient;
    render(<RequirementsPage api={api} projectId="p1" />);
    const rows = await screen.findAllByRole('row');
    expect(rows[0]?.textContent).toContain('Epic');
    expect(rows[1]?.textContent).toContain('Epic 2 · Review');
    expect(rows[2]?.textContent).toContain('unassigned');
  });
});

describe('T1614 · an owner assigns and unassigns from the requirement rows (EPIC-044, FR-EPB-023)', () => {
  const EPICS = { epics: [{ id: 'e2', projectId: 'p1', number: 2, slug: 'review', title: 'Review', description: '', status: 'active', parentEpicId: null, splitSuffix: null, createdAt: '', updatedAt: '', closedAt: null, requirementCount: 1, specificationCount: 0 }, { id: 'e5', projectId: 'p1', number: 5, slug: 'old', title: 'Old', description: '', status: 'closed', parentEpicId: null, splitSuffix: null, createdAt: '', updatedAt: '', closedAt: '', requirementCount: 0, specificationCount: 0 }], unassigned: [] };
  function richApi(): ApiClient {
    return {
      listRequirements: vi.fn(async () => [
        requirement({ id: 'r1', reference: 'REQ-001', epicId: 'e2', epicNumber: 2, epicTitle: 'Review' }),
        requirement({ id: 'r2', reference: 'REQ-002', epicId: null, epicNumber: null, epicTitle: null }),
      ]),
      listEpics: vi.fn(async () => EPICS),
      getProject: vi.fn(async () => ({ id: 'p1', ownerUserId: 'u_owner' })),
      assignRequirementEpic: vi.fn(async () => ({ id: 'r2', epicId: 'e2' })),
    } as unknown as ApiClient;
  }

  it('the owner assigns an unassigned requirement to an active Epic from its row, and the list re-queries', async () => {
    const api = richApi();
    render(<RequirementsPage api={api} projectId="p1" currentUserId="u_owner" />);
    const select = (await screen.findByLabelText('Assign REQ-002 to an Epic')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['unassigned', 'Epic 2 · Review']);
    fireEvent.change(select, { target: { value: 'e2' } });
    await waitFor(() => expect(api.assignRequirementEpic).toHaveBeenCalledWith('r2', 'e2'));
    await waitFor(() => expect(api.listRequirements).toHaveBeenCalledTimes(2));
  });

  it('the owner unassigns from the row by choosing unassigned', async () => {
    const api = richApi();
    render(<RequirementsPage api={api} projectId="p1" currentUserId="u_owner" />);
    const select = (await screen.findByLabelText('Assign REQ-001 to an Epic')) as HTMLSelectElement;
    expect(select.value).toBe('e2');
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(api.assignRequirementEpic).toHaveBeenCalledWith('r1', null));
  });

  it('a member without the grant sees the Epic column and no control', async () => {
    render(<RequirementsPage api={richApi()} projectId="p1" currentUserId="u_member" />);
    const rows = await screen.findAllByRole('row');
    expect(rows[1]?.textContent).toContain('Epic 2 · Review');
    expect(screen.queryByLabelText('Assign REQ-001 to an Epic')).toBeNull();
    expect(screen.queryByLabelText('Assign REQ-002 to an Epic')).toBeNull();
  });
});
