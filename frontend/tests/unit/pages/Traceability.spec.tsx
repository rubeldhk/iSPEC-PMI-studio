/**
 * T133a — both traversal directions render, and retired links are flagged.
 * Written to FAIL before T134 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TraceabilityPage } from '../../../src/pages/Traceability';
import type { ApiClient } from '../../../src/services/api';

const FORWARD = {
  requirementId: 'r1',
  specifications: [
    { specificationId: 's1', retired: false, taskIds: ['t1', 't2'] },
    { specificationId: 's2', retired: false, taskIds: [] },
  ],
};

const REVERSE = {
  taskId: 't1',
  specifications: [
    {
      specificationId: 's1',
      requirements: [
        { requirementId: 'r1', retired: false },
        { requirementId: 'r_old', retired: true },
      ],
    },
  ],
};

const COVERAGE = {
  uncoveredRequirementIds: ['r_uncovered'],
  specificationsWithoutTasks: ['s2'],
  requirementCount: 3,
  specificationCount: 2,
};

function api(): ApiClient {
  return {
    getRequirementTrace: vi.fn(async () => FORWARD),
    getTaskTrace: vi.fn(async () => REVERSE),
    getProjectCoverage: vi.fn(async () => COVERAGE),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('TraceabilityPage · forward direction', () => {
  it('traces a requirement forward to specifications and their tasks', async () => {
    const client = api();
    render(<TraceabilityPage api={client} projectId="p1" />);
    fireEvent.change(screen.getByLabelText(/requirement id/i), { target: { value: 'r1' } });
    fireEvent.click(screen.getByRole('button', { name: /trace forward/i }));

    expect(await screen.findByText('s1')).toBeDefined();
    // s2 legitimately renders twice: in the forward trace AND in the coverage
    // gap list ("specifications with no tasks") — both are correct.
    expect(screen.getAllByText('s2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/t1/)).toBeDefined();
    expect(client.getRequirementTrace).toHaveBeenCalledWith('r1');
  });
});

describe('TraceabilityPage · reverse direction', () => {
  it('traces a task back to its originating requirements', async () => {
    const client = api();
    render(<TraceabilityPage api={client} projectId="p1" />);
    fireEvent.change(screen.getByLabelText(/task id/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /trace back/i }));

    expect(await screen.findByText('r1')).toBeDefined();
    expect(client.getTaskTrace).toHaveBeenCalledWith('t1');
  });

  it('a retired requirement renders FLAGGED, never omitted (US7 scenario 4)', async () => {
    render(<TraceabilityPage api={api()} projectId="p1" />);
    fireEvent.change(screen.getByLabelText(/task id/i), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: /trace back/i }));

    expect(await screen.findByText('r_old')).toBeDefined();
    expect(screen.getByText(/retired/i)).toBeDefined();
  });
});

describe('TraceabilityPage · coverage', () => {
  it('shows the gap report on load', async () => {
    render(<TraceabilityPage api={api()} projectId="p1" />);
    expect(await screen.findByText('r_uncovered')).toBeDefined();
    expect(screen.getByText(/no tasks/i)).toBeDefined();
  });
});
