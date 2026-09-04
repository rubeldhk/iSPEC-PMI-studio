/**
 * `T1375` (EPIC-041) — the *Generate specification* control on the project
 * screen (`FR-LPW-041`, `FR-LPW-042`, `SC-LPW-007`).
 *
 * With requirements selected the control calls the client and mounts
 * `JobProgress` for the returned job; with none selected it is disabled and
 * says why; the four `FR-SHL-060` states — loading, empty, error, ready — are
 * distinguishable.
 *
 * Written to FAIL before `T1376` exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectDetail } from '../../../src/pages/Projects';
import type { ApiClient, Job, Project, Requirement } from '../../../src/services/api';

const PROJECT = {
  id: 'p1',
  workspaceId: 'ws_a',
  name: 'Alpha',
  description: null,
  status: 'active',
  engineName: null,
  ownerUserId: 'u1',
  archivedAt: null,
  rootPath: '/projects/alpha',
  agentIntegration: 'claude',
  scriptType: 'sh',
  provisioningState: 'provisioned',
  provisionedAt: '2026-09-04T00:00:00Z',
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
} as Project;

function requirement(id: string, reference: string): Requirement {
  return {
    id,
    workspaceId: 'ws_a',
    projectId: 'p1',
    reference,
    description: `${reference} shall hold.`,
    type: 'functional',
    priority: 'p1',
    status: 'active',
    contentHash: 'h',
    retiredAt: null,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  };
}

const JOB: Job = { id: 'j1', kind: 'generate_specification', state: 'queued', failureReason: null, startedAt: null, resultRef: null };

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    listProvisioning: vi.fn(async () => []),
    listExecutions: vi.fn(async () => ({ items: [], nextCursor: null })),
    listRequirements: vi.fn(async () => [requirement('r1', 'REQ-001'), requirement('r2', 'REQ-002')]),
    generateSpecification: vi.fn(async () => JOB),
    getJob: vi.fn(async () => ({ ...JOB, state: 'running' })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1375 · Generate specification', () => {
  it('is disabled with a reason until a requirement is selected', async () => {
    render(<ProjectDetail api={api()} projectId="p1" onBack={vi.fn()} />);
    const button = await screen.findByRole('button', { name: /generate specification/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/select at least one requirement/i)).toBeDefined();
  });

  it('with requirements selected, calls the client and mounts JobProgress for the returned job', async () => {
    const client = api();
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText(/REQ-001/));
    const button = screen.getByRole('button', { name: /generate specification/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(client.generateSpecification).toHaveBeenCalledWith('p1', ['r1']);
    expect(await screen.findByText(/generate_specification: running/)).toBeDefined();
    expect(client.getJob).toHaveBeenCalledWith('j1');
  });

  it('shows the refusal body when the API refuses (FR-LPW-042)', async () => {
    const { ApiError } = await import('../../../src/services/api');
    const client = api({
      generateSpecification: vi.fn(async () => {
        throw new ApiError('validation_failed', 'The project has no engine registered.', 400);
      }),
    });
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText(/REQ-002/));
    fireEvent.click(screen.getByRole('button', { name: /generate specification/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no engine registered/);
  });
});

describe('T1375 · the four FR-SHL-060 states of the requirement picker', () => {
  it('loading — a status region while the requirements load', async () => {
    const client = api({ listRequirements: vi.fn(() => new Promise<Requirement[]>(() => undefined)) });
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    await screen.findByText('Alpha');
    expect(screen.getByText(/loading requirements/i)).toBeDefined();
  });

  it('empty — explains that there is nothing to generate from', async () => {
    const client = api({ listRequirements: vi.fn(async () => []) });
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    expect(await screen.findByText(/no requirements to generate from/i)).toBeDefined();
  });

  it('error — an alert naming the failure', async () => {
    const { ApiError } = await import('../../../src/services/api');
    const client = api({
      listRequirements: vi.fn(async () => {
        throw new ApiError('internal_error', 'Requirements could not be loaded.', 500);
      }),
    });
    render(<ProjectDetail api={client} projectId="p1" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /could not be loaded/.test(a.textContent ?? ''))).toBe(true));
  });

  it('ready — one checkbox per active requirement, labelled by reference', async () => {
    render(<ProjectDetail api={api()} projectId="p1" onBack={vi.fn()} />);
    expect(await screen.findByLabelText(/REQ-001/)).toBeDefined();
    expect(screen.getByLabelText(/REQ-002/)).toBeDefined();
  });
});
