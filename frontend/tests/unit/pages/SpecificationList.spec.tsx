/**
 * T083c — the specification list page (FR-012).
 * Written to FAIL before T083d exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SpecificationList } from '../../../src/pages/SpecificationList';
import type { ApiClient, Specification } from '../../../src/services/api';

function spec(overrides: Partial<Specification> = {}): Specification {
  return {
    id: 's1',
    workspaceId: 'ws_a',
    projectId: 'p1',
    title: 'Payments spec',
    lifecycleState: 'draft',
    currentVersionId: 'sv1',
    engineName: 'speckit',
    engineVersion: '1.2.0',
    generatedAt: '2026-08-20T10:00:00Z',
    isOutOfDate: false,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

function api(rows: Specification[]): ApiClient {
  return {
    listSpecifications: vi.fn(async () => ({ rows, total: rows.length, page: 1, pageSize: 20 })),
    // EPIC-044: the list also reads the board and the Epics for its two new columns.
    getBoard: vi.fn(async () => ({ columns: ['Not started'], epics: [], unbound: [], packageVersion: '0.1.0', profile: 'product' })),
    listEpics: vi.fn(async () => ({ epics: [], unassigned: [] })),
    getProject: vi.fn(async () => ({ id: 'p1', ownerUserId: 'u_owner' })),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('SpecificationList (FR-012)', () => {
  it('lists the project\'s specifications with title, state, and engine', async () => {
    render(
      <SpecificationList
        api={api([spec(), spec({ id: 's2', title: 'Auth spec', lifecycleState: 'approved' })])}
        projectId="p1"
        onOpen={vi.fn()}
      />,
    );
    expect(await screen.findByText('Payments spec')).toBeDefined();
    expect(screen.getByText('Auth spec')).toBeDefined();
    expect(screen.getByText('approved')).toBeDefined();
    expect(screen.getAllByText(/speckit 1\.2\.0/).length).toBe(2);
  });

  it('flags an out-of-date specification VISIBLY, never silently (FR-032)', async () => {
    render(
      <SpecificationList api={api([spec({ isOutOfDate: true })])} projectId="p1" onOpen={vi.fn()} />,
    );
    expect(await screen.findByText(/out of date/i)).toBeDefined();
  });

  it('opens a specification on click', async () => {
    const onOpen = vi.fn();
    render(<SpecificationList api={api([spec()])} projectId="p1" onOpen={onOpen} />);
    fireEvent.click(await screen.findByText('Payments spec'));
    expect(onOpen).toHaveBeenCalledWith('s1');
  });

  it('an empty project says so instead of rendering a blank page', async () => {
    render(<SpecificationList api={api([])} projectId="p1" onOpen={vi.fn()} />);
    expect(await screen.findByText(/no specifications/i)).toBeDefined();
  });
});

describe('T1599 · Epic and Stage columns (EPIC-044, FR-EPB-050)', () => {
  const BOARD = { columns: ['Not started', 'Specified'], epics: [{ epicId: 'e2', number: 2, slug: 'review', title: 'Review', status: 'active', stage: 'Specified', missing: [], last: null, next: '/speckit-clarify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' }], unbound: [], packageVersion: '0.1.0', profile: 'product' };
  const EPICS = { epics: [{ id: 'e2', projectId: 'p1', number: 2, slug: 'review', title: 'Review', description: '', status: 'active', parentEpicId: null, splitSuffix: null, createdAt: '', updatedAt: '', closedAt: null, requirementCount: 0, specificationCount: 1 }], unassigned: [] };
  function richApi(rows: Specification[], over: Record<string, unknown> = {}): ApiClient {
    return {
      listSpecifications: vi.fn(async () => ({ rows, total: rows.length, page: 1, pageSize: 20 })),
      getBoard: vi.fn(async () => BOARD),
      listEpics: vi.fn(async () => EPICS),
      assignSpecificationEpic: vi.fn(async () => ({ id: 's1', epicId: 'e2' })),
      getProject: vi.fn(async () => ({ id: 'p1', ownerUserId: 'u_owner' })),
      ...over,
    } as unknown as ApiClient;
  }

  it('shows the Epic and its stage for a bound specification, and "no Epic" with an empty stage for an unbound one', async () => {
    render(<SpecificationList api={richApi([spec({ epicId: 'e2', epicNumber: 2, epicTitle: 'Review' }), spec({ id: 's2', title: 'Auth spec', epicId: null, epicNumber: null, epicTitle: null })])} projectId="p1" onOpen={vi.fn()} currentUserId="u_owner" />);
    const bound = (await screen.findByText('Payments spec')).closest('li')!;
    expect(bound.textContent).toContain('Epic 2 · Review');
    expect(bound.textContent).toContain('Specified');
    const unbound = screen.getByText('Auth spec').closest('li')!;
    expect(unbound.textContent).toContain('no Epic');
    expect(unbound.textContent).not.toContain('Specified');
  });

  it('filters by Epic', async () => {
    render(<SpecificationList api={richApi([spec({ epicId: 'e2', epicNumber: 2, epicTitle: 'Review' }), spec({ id: 's2', title: 'Auth spec', epicId: null })])} projectId="p1" onOpen={vi.fn()} currentUserId="u_owner" />);
    await screen.findByText('Payments spec');
    fireEvent.change(screen.getByLabelText('Filter by Epic'), { target: { value: 'e2' } });
    expect(screen.queryByText('Auth spec')).toBeNull();
    expect(screen.getByText('Payments spec')).toBeDefined();
  });

  it('an owner assigns an unbound specification to an Epic from its row', async () => {
    const api = richApi([spec({ epicId: null })]);
    render(<SpecificationList api={api} projectId="p1" onOpen={vi.fn()} currentUserId="u_owner" />);
    await screen.findByText('Payments spec');
    fireEvent.change(screen.getByLabelText('Assign Payments spec to an Epic'), { target: { value: 'e2' } });
    await waitFor(() => expect(api.assignSpecificationEpic).toHaveBeenCalledWith('s1', 'e2'));
  });

  it('a member without the grant sees the columns but no assignment control', async () => {
    render(<SpecificationList api={richApi([spec({ epicId: null })])} projectId="p1" onOpen={vi.fn()} currentUserId="u_member" />);
    await screen.findByText('Payments spec');
    expect(screen.queryByLabelText('Assign Payments spec to an Epic')).toBeNull();
    expect(screen.getByText('Payments spec').closest('li')!.textContent).toContain('no Epic');
  });
});
