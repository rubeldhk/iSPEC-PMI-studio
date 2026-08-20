/**
 * T103a — the task list and progress view (EPIC-012 US4).
 * Written to FAIL before T104 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TasksPage } from '../../../src/pages/Tasks';
import type { ApiClient, ProjectProgress, Task } from '../../../src/services/api';

const TASKS: Task[] = [
  { id: 't1', specificationId: 's1', description: 'Create the payments table', status: 'done', engineName: 'speckit', engineVersion: '1.2.0' },
  { id: 't2', specificationId: 's1', description: 'Wire the refund endpoint', status: 'in_progress', engineName: 'speckit', engineVersion: '1.2.0' },
  { id: 't3', specificationId: 's1', description: 'Add the reconciliation job', status: 'not_started', engineName: 'speckit', engineVersion: '1.2.0' },
];

const PROGRESS: ProjectProgress = { total: 3, done: 1, inProgress: 1, notStarted: 1, percentComplete: 33 };

function api(): ApiClient {
  return {
    listTasks: vi.fn(async () => TASKS),
    getProjectProgress: vi.fn(async () => PROGRESS),
    updateTaskStatus: vi.fn(async () => ({ ...TASKS[2], status: 'in_progress' as const })),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('TasksPage (US4)', () => {
  it('lists the specification\'s tasks with their statuses', async () => {
    render(<TasksPage api={api()} specificationId="s1" projectId="p1" />);
    expect(await screen.findByText('Create the payments table')).toBeDefined();
    expect(screen.getByText('Wire the refund endpoint')).toBeDefined();
    expect(screen.getByText('Add the reconciliation job')).toBeDefined();
  });

  it('each task offers a status control; changing it calls the API (US4 scenario 4)', async () => {
    const client = api();
    render(<TasksPage api={client} specificationId="s1" projectId="p1" />);
    await screen.findByText('Add the reconciliation job');
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(3);
    const third = selects[2];
    if (third === undefined) throw new Error('third status control missing');
    fireEvent.change(third, { target: { value: 'in_progress' } });
    await waitFor(() =>
      expect(client.updateTaskStatus).toHaveBeenCalledWith('t3', 'in_progress'),
    );
  });

  it('shows project progress as a percentage with the breakdown (US4 scenario 3)', async () => {
    render(<TasksPage api={api()} specificationId="s1" projectId="p1" />);
    expect(await screen.findByText(/33%/)).toBeDefined();
    expect(screen.getByText(/1 done/i)).toBeDefined();
    expect(screen.getByText(/1 in progress/i)).toBeDefined();
    expect(screen.getByText(/1 not started/i)).toBeDefined();
  });
});
