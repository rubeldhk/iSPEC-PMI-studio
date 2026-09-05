/**
 * `T1433` (EPIC-043, `FR-PIC-050`–`FR-PIC-054`) — the Execution timeline panel
 * on the project screen: four `FR-SHL-060` states, rows newest first with the
 * seven fields, filters, expandable events, no control that applies or
 * approves, and a sentence saying where approval belongs.
 *
 * Written to FAIL before `T1434`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProjectDetail } from '../../../src/pages/Projects';
import { ApiError, type ApiClient, type ExecutionTimelineEntry, type Project } from '../../../src/services/api';

const PROJECT = {
  id: 'p1', workspaceId: 'ws_a', name: 'Alpha', description: null, status: 'active', engineName: null, ownerUserId: 'u1',
  archivedAt: null, rootPath: '/projects/alpha', agentIntegration: 'claude', scriptType: 'sh', provisioningState: 'provisioned',
  provisionedAt: '2026-09-04T00:00:00Z', createdAt: '2026-09-04T00:00:00Z', updatedAt: '2026-09-04T00:00:00Z',
} as Project;

function entry(over: Partial<ExecutionTimelineEntry> = {}): ExecutionTimelineEntry {
  return {
    executionId: 'exec_1', command: 'specify', surface: 'mcp-client', assurance: 'local', state: 'registered',
    initiator: { principalId: 'pr_1', kind: 'connector', label: 'laptop' }, sponsorUserId: 'u1',
    registeredAt: '2026-09-04T10:00:00Z', completedAt: null, proposal: null, ...over,
  };
}

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    listProvisioning: vi.fn(async () => []),
    listRequirements: vi.fn(async () => []),
    listRuns: vi.fn(async () => []),
    listWorkstationConnections: vi.fn(async () => []),
    listExecutions: vi.fn(async () => ({ items: [entry(), entry({ executionId: 'exec_0', state: 'completed', completedAt: '2026-09-04T09:30:00Z', registeredAt: '2026-09-04T09:00:00Z', proposal: { id: 'p1', proposedState: 'review', state: 'proposed', decidedBy: null } })], nextCursor: null })),
    getExecutionEvents: vi.fn(async () => [
      { sequence: 1, type: 'registered', category: 'lifecycle', actorId: 'pr_1', occurredAt: '2026-09-04T10:00:00Z', payload: {} },
      { sequence: 2, type: 'progress-reported', category: 'lifecycle', actorId: 'pr_1', occurredAt: '2026-09-04T10:01:00Z', payload: { taskId: 'T1' } },
    ]),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function panel(client: ApiClient) {
  render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
  await screen.findByText('Alpha');
  return screen.findByRole('region', { name: /execution timeline/i });
}

describe('T1433 · Execution timeline', () => {
  it('lists executions newest first with the seven fields and the proposal state', async () => {
    const region = await panel(api());
    await waitFor(() => expect(within(region).getAllByRole('row').length).toBeGreaterThan(2));
    const rows = within(region).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toMatch(/specify/);
    expect(rows[0]?.textContent).toMatch(/mcp-client/);
    expect(rows[0]?.textContent).toMatch(/local/);
    expect(rows[0]?.textContent).toMatch(/registered/);
    expect(rows[0]?.textContent).toMatch(/laptop/);
    expect(rows[1]?.textContent).toMatch(/completed/);
    expect(rows[1]?.textContent).toMatch(/review.*proposed|proposed.*review/);
  });

  it('expanding a row lists its events in sequence with type, actor and time', async () => {
    const client = api();
    const region = await panel(client);
    await waitFor(() => expect(within(region).getAllByRole('row').length).toBeGreaterThan(2));
    fireEvent.click(within(region).getAllByRole('button', { name: /events/i })[0] as HTMLElement);
    await waitFor(() => expect(within(region).getByText(/progress-reported/)).toBeDefined());
    expect(client.getExecutionEvents).toHaveBeenCalledWith('p1', 'exec_1');
    const list = within(region).getByRole('list', { name: /events of exec_1/i });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]?.textContent).toMatch(/1.*registered/);
    expect(items[1]?.textContent).toMatch(/2.*progress-reported.*pr_1/);
  });

  it('filters by surface, state and initiator through the client', async () => {
    const client = api();
    const region = await panel(client);
    fireEvent.change(within(region).getByLabelText(/surface/i), { target: { value: 'local-cli' } });
    await waitFor(() => expect(client.listExecutions).toHaveBeenLastCalledWith('p1', expect.objectContaining({ surface: 'local-cli' })));
    fireEvent.change(within(region).getByLabelText(/^state/i), { target: { value: 'completed' } });
    await waitFor(() => expect(client.listExecutions).toHaveBeenLastCalledWith('p1', expect.objectContaining({ state: 'completed' })));
  });

  it('offers no control that applies or approves, and says where approval belongs', async () => {
    const region = await panel(api());
    await waitFor(() => expect(within(region).getAllByRole('row').length).toBeGreaterThan(1));
    expect(within(region).queryByRole('button', { name: /approve|apply|refuse/i })).toBeNull();
    expect(region.textContent).toMatch(/approv.*(Room|PMI Studio|governed workflow)/i);
  });

  it('the four states: loading, error, empty, ready', async () => {
    const loading = api({ listExecutions: vi.fn(() => new Promise(() => undefined)) });
    let region = await panel(loading);
    expect(region.textContent).toMatch(/loading executions/i);
    cleanup();

    const failing = api({ listExecutions: vi.fn(async () => { throw new ApiError('internal_error', 'Timeline unavailable.', 500); }) });
    region = await panel(failing);
    await waitFor(() => expect(within(region).getByRole('alert').textContent).toMatch(/Timeline unavailable/));
    cleanup();

    const empty = api({ listExecutions: vi.fn(async () => ({ items: [], nextCursor: null })) });
    region = await panel(empty);
    await waitFor(() => expect(region.textContent).toMatch(/no executions yet/i));
  });
});

describe('T1515 · the Local workspace panel shows the constitution state and file differs (EPIC-042 FR-EXT-067)', () => {
  const connection = (state: string | null) => ({
    credentialId: 'cred', label: 'laptop', credentialState: 'active', firstSeenAt: '2026-09-04T00:00:00Z', lastSeenAt: '2026-09-04T00:00:00Z',
    extensionVersion: '0.2.0', toolkitVersion: 'v0.14.3', contractVersion: '1.0', serverVersion: null,
    constitutionDigest: state ? 'f'.repeat(64) : null, constitutionState: state, constitutionReportedAt: state ? '2026-09-04T12:00:00Z' : null,
  });

  it('a drifted workstation is named in a file-differs status, and each row shows its state', async () => {
    render(<ProjectDetail api={api({ listWorkstationConnections: vi.fn(async () => [connection('drift')]) })} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    const status = await screen.findByRole('status', { name: 'Constitution file differs' });
    expect(status.textContent).toContain('laptop');
    expect(status.textContent).toContain('matches no render');
    const list = await screen.findByRole('list', { name: 'Workstation connections' });
    expect(list.textContent).toContain('constitution drift');
  });

  it('a current workstation shows no warning', async () => {
    render(<ProjectDetail api={api({ listWorkstationConnections: vi.fn(async () => [connection('current')]) })} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    const list = await screen.findByRole('list', { name: 'Workstation connections' });
    expect(list.textContent).toContain('constitution current');
    expect(screen.queryByRole('status', { name: 'Constitution file differs' })).toBeNull();
  });
});
