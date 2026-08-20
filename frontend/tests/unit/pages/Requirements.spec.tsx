/**
 * T070a — the requirement register page: filter behaviour.
 * Written to FAIL before T071 exists (Constitution V).
 *
 * FR-008: filter and sort by type, priority, and status. The register is a
 * QUERY of the API, not a client-side sieve — every filter change goes back
 * through `listRequirements`, where the indexes are.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
