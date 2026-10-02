/**
 * `T1734` (EPIC-046, `R-046-11`, `FR-KAN-055` to `FR-KAN-058`) — the Plan &
 * Tasks landing.
 *
 * The assertion that carries the most weight is the **partial** state: one Epic
 * whose progress cannot be read must not blank the table. `FR-SHL-060` calls
 * that a state in its own right, and it is the one a table of independent reads
 * gets wrong by default — a single rejected promise takes the whole page with it
 * unless each read is caught where it happens.
 *
 * Written to FAIL before `T1735`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PlanLandingPage } from '../../../src/pages/PlanLanding';
import { ApiError, type ApiClient, type Progress } from '../../../src/services/api';

function progress(over: Partial<Progress> = {}): Progress {
  return { total: 10, done: 4, inProgress: 0, notStarted: 6, blocked: 0, percentComplete: 40, ...over };
}

function epic(id: string, number: number, title: string) {
  return {
    id, projectId: 'p1', number, slug: title.toLowerCase(), title, description: '',
    status: 'active' as const, parentEpicId: null, splitSuffix: null,
    createdAt: '', updatedAt: '', closedAt: null, requirementCount: 0, specificationCount: 0,
  };
}

const EPICS = { epics: [epic('e1', 1, 'Intake'), epic('e2', 2, 'Reports')], unassigned: [] };

function api(over: Partial<Record<string, unknown>> = {}): ApiClient {
  return {
    listEpics: vi.fn(async () => EPICS),
    getProjectTaskProgress: vi.fn(async () => progress({ total: 15, done: 9, notStarted: 6, percentComplete: 60 })),
    getEpicTaskProgress: vi.fn(async (id: string) =>
      id === 'e1' ? progress() : progress({ total: 5, done: 5, notStarted: 0, percentComplete: 100 }),
    ),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1734 · the landing lists Epics with their progress', () => {
  it('shows one row per Epic, with done, total and percent', async () => {
    render(<PlanLandingPage api={api()} projectId="p1" onOpenEpic={vi.fn()} />);
    const rows = await screen.findAllByTestId('epic-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('1 · Intake');
    expect(rows[0]?.textContent).toContain('40%');
    expect(rows[1]?.textContent).toContain('100%');
  });

  it('shows the project figure over the same rows (SC-KAN-009)', async () => {
    render(<PlanLandingPage api={api()} projectId="p1" onOpenEpic={vi.fn()} />);
    const total = await screen.findByTestId('project-progress');
    expect(total.textContent).toContain('9 of 15 done');
    expect(total.textContent).toContain('60%');
  });

  it('states that the denominator excludes what the latest parse dropped (FR-KAN-058)', async () => {
    render(<PlanLandingPage api={api()} projectId="p1" onOpenEpic={vi.fn()} />);
    expect(await screen.findByText(/exclude tasks the latest parse no longer/)).toBeTruthy();
  });

  it('opens an Epic board from its row', async () => {
    const onOpenEpic = vi.fn();
    render(<PlanLandingPage api={api()} projectId="p1" onOpenEpic={onOpenEpic} />);
    const rows = await screen.findAllByTestId('epic-row');
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Open board' }));
    expect(onOpenEpic).toHaveBeenCalledWith('e1');
  });

  it('filters by title and by number (FR-KAN-053)', async () => {
    render(<PlanLandingPage api={api()} projectId="p1" onOpenEpic={vi.fn()} />);
    await screen.findAllByTestId('epic-row');
    fireEvent.change(screen.getByLabelText('Filter Epics'), { target: { value: 'reports' } });
    await waitFor(() => expect(screen.getAllByTestId('epic-row')).toHaveLength(1));
    expect(screen.getByTestId('epic-row').textContent).toContain('Reports');
  });
});

describe('T1734 · the four states (FR-KAN-059, FR-SHL-060)', () => {
  it('states that it is loading', () => {
    render(<PlanLandingPage api={api({ listEpics: vi.fn(() => new Promise(() => undefined)) })} projectId="p1" onOpenEpic={vi.fn()} />);
    expect(screen.getByText(/Loading the plan/)).toBeTruthy();
  });

  it('says so when the project has no Epics', async () => {
    render(<PlanLandingPage api={api({ listEpics: vi.fn(async () => ({ epics: [], unassigned: [] })) })} projectId="p1" onOpenEpic={vi.fn()} />);
    expect(await screen.findByText('This project has no Epics yet.')).toBeTruthy();
  });

  it('states an error in words when the list itself cannot be read', async () => {
    const failing = api({ listEpics: vi.fn(async () => { throw new ApiError('not_found', 'No project.', 404); }) });
    render(<PlanLandingPage api={failing} projectId="p1" onOpenEpic={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No project.');
  });

  it('keeps the table standing when ONE Epic’s progress cannot be read', async () => {
    const partial = api({
      getEpicTaskProgress: vi.fn(async (id: string) => {
        if (id === 'e2') throw new ApiError('not_found', 'Progress unavailable.', 404);
        return progress();
      }),
    });
    render(<PlanLandingPage api={partial} projectId="p1" onOpenEpic={vi.fn()} />);
    const rows = await screen.findAllByTestId('epic-row');
    // Both rows are present; the one that failed says why, in its own cell.
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('40%');
    expect(rows[1]?.textContent).toContain('Progress unavailable.');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
