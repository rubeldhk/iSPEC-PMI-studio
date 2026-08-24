/**
 * T200d — the run list. `DEF-010-001`, `T200b`.
 *
 * **This page exists because `ReviewSession` had no parent.** Four of the five
 * unreachable pages chain off the project view, which already holds the ids
 * they need. `ReviewSession` needs a `runId`, and nothing in the product
 * produced one: `GET /projects/:projectId/runs` has existed on the backend
 * since `EPIC-023`, and no frontend surface ever called it. Routing the review
 * session without this would have meant inventing a run id in the shell.
 *
 * Written to FAIL before the page exists (Constitution V).
 *
 * `EPIC-023`'s surface, delivered under `EPIC-010`'s convergence because that
 * is where the defect was found and where the routing lives. `T200b` records
 * the decision and names the owner.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RunsPage } from '../../../src/pages/Runs';
import type { ApiClient, Run } from '../../../src/services/api';

afterEach(cleanup);

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'run_1',
    projectId: 'p1',
    mode: 'unattended',
    stopRange: 'specification',
    state: 'awaiting_review',
    stoppedAtSelectedRange: true,
    outcomeReason: null,
    startedAt: '2026-08-23T09:00:00.000Z',
    endedAt: null,
    ...over,
  };
}

function stubApi(runs: Run[] | Error): ApiClient {
  return {
    listRuns: vi.fn(async () => {
      if (runs instanceof Error) throw runs;
      return runs;
    }),
  } as unknown as ApiClient;
}

describe('T200d · the run list reaches the runs a project has', () => {
  it('asks for the runs of the project it was given', async () => {
    const api = stubApi([run()]);
    render(<RunsPage api={api} projectId="p1" onOpen={vi.fn()} />);

    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith('p1'));
  });

  it('lists each run with the state a reader needs to choose one', async () => {
    const api = stubApi([run({ id: 'run_1', state: 'awaiting_review' })]);
    render(<RunsPage api={api} projectId="p1" onOpen={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/run_1/)).toBeTruthy());
    expect(screen.getByText(/awaiting_review/)).toBeTruthy();
  });

  it('says so when a project has no runs, rather than rendering an empty page', async () => {
    const api = stubApi([]);
    render(<RunsPage api={api} projectId="p1" onOpen={vi.fn()} />);

    // "No runs yet" and "still loading" must not look the same — the whole
    // reason this page exists is that a blank surface hides its own state.
    await waitFor(() => expect(screen.getByText(/no runs yet/i)).toBeTruthy());
  });

  it('reports a failure instead of showing an empty list', async () => {
    const api = stubApi(new Error('network'));
    render(<RunsPage api={api} projectId="p1" onOpen={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});

describe('T200d · opening a run is how the review session becomes reachable', () => {
  it('hands the run id back, which is the prop ReviewSession needs', async () => {
    const onOpen = vi.fn();
    const api = stubApi([run({ id: 'run_7' })]);
    render(<RunsPage api={api} projectId="p1" onOpen={onOpen} />);

    fireEvent.click(await screen.findByRole('button', { name: /run_7/ }));

    // `ReviewSessionPage` takes `{ api, runId }`. This callback is the only
    // thing in the product that can supply one.
    expect(onOpen).toHaveBeenCalledWith('run_7');
  });

  it('offers a control per run, not one for the list', async () => {
    const api = stubApi([run({ id: 'run_1' }), run({ id: 'run_2' })]);
    render(<RunsPage api={api} projectId="p1" onOpen={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /run_1/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /run_2/ })).toBeTruthy();
  });
});
