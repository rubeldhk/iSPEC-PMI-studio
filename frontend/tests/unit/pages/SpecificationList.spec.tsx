/**
 * T083c — the specification list page (FR-012).
 * Written to FAIL before T083d exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
