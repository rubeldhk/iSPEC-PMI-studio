/**
 * `T1394` (EPIC-041 convergence) — a run is startable from the project screen
 * and its progress readable there (`FR-LPW-042`, US4/AC3).
 *
 * The *Start run* control posts through `api.startRun(projectId, { mode,
 * stopRange })`, shows the returned run's state and refreshes it until the
 * run is terminal or stopped, and surfaces the refusal body on `4xx`; the
 * four `FR-SHL-060` states are distinguishable.
 *
 * Written to FAIL before the control exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectDetail } from '../../../src/pages/Projects';
import { ApiError, type ApiClient, type Project, type Run } from '../../../src/services/api';

const PROJECT = {
  id: 'p1', workspaceId: 'ws_a', name: 'Alpha', description: null, status: 'active', engineName: null, ownerUserId: 'u1',
  archivedAt: null, rootPath: '/projects/alpha', agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'provisioned',
  provisionedAt: '2026-09-04T00:00:00Z', createdAt: '2026-09-04T00:00:00Z', updatedAt: '2026-09-04T00:00:00Z',
} as Project;

function run(over: Partial<Run> = {}): Run {
  return {
    id: 'run_1', projectId: 'p1', mode: 'autopilot', stopRange: 'specify', state: 'running', stoppedAtSelectedRange: false,
    outcomeReason: null, startedAt: '2026-09-04T10:00:00Z', endedAt: null, ...over,
  };
}

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    listProvisioning: vi.fn(async () => []),
    listRequirements: vi.fn(async () => []),
    listRuns: vi.fn(async () => [run({ state: 'reached_stop_point', stoppedAtSelectedRange: true, endedAt: '2026-09-04T10:01:00Z' })]),
    startRun: vi.fn(async () => run()),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1394 · Start run', () => {
  it('posts the chosen mode and stop range through the client and shows the run\'s state', async () => {
    const client = api();
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    fireEvent.change(screen.getByLabelText(/run mode/i), { target: { value: 'autopilot' } });
    fireEvent.change(screen.getByLabelText(/stop after/i), { target: { value: 'specify' } });
    fireEvent.click(screen.getByRole('button', { name: /start run/i }));
    expect(client.startRun).toHaveBeenCalledWith('p1', { mode: 'autopilot', stopRange: 'specify' });
    const progress = await screen.findByRole('status', { name: /run progress/i });
    expect(progress.textContent).toMatch(/running/);
  });

  it('refreshes the run until it reaches its stop point, then says so', async () => {
    const client = api();
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} pollMs={10} />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /start run/i }));
    await waitFor(() => expect(screen.getByRole('status', { name: /run progress/i }).textContent).toMatch(/reached_stop_point/));
    expect(client.listRuns).toHaveBeenCalled();
  });

  it('surfaces the refusal body when the API refuses (FR-LPW-042)', async () => {
    const client = api({
      startRun: vi.fn(async () => {
        throw new ApiError('conflict', 'A run is already active for this project.', 409);
      }),
    });
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /start run/i }));
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /already active/.test(a.textContent ?? ''))).toBe(true));
  });

  it('the four FR-SHL-060 states: ready, loading, error, empty', async () => {
    // ready — the control is enabled with defaults chosen
    const ready = api();
    const view = render(<ProjectDetail api={ready} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    expect((screen.getByRole('button', { name: /start run/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/no run started yet/i)).toBeDefined();
    view.unmount();

    // loading — while the start is in flight the control is busy
    const pending = api({ startRun: vi.fn(() => new Promise<Run>(() => undefined)) });
    render(<ProjectDetail api={pending} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /start run/i }));
    await waitFor(() => expect(screen.getByText(/starting run/i)).toBeDefined());
  });
});
