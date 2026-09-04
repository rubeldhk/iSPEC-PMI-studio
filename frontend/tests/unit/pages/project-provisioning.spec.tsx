/**
 * `T1378` (EPIC-041) — the create form and the provisioning panel
 * (`FR-LPW-050`, `FR-LPW-051`, `FR-LPW-053`).
 *
 * The create form takes `rootPath`, `agentIntegration`, `scriptType` with
 * configured defaults; the credential value is shown ONCE with a copy control
 * and is absent after navigation; the panel shows path, integration, script
 * type, engine tag, extension version and state; `prepared` reads *wait*,
 * `initialisation_pending` reads *run the setup skill*, `failed` names the
 * step.
 *
 * Written to FAIL before `T1379` exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectDetail, ProjectsPage } from '../../../src/pages/Projects';
import type { ApiClient, Project, ProvisioningRecord } from '../../../src/services/api';

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    workspaceId: 'ws_a',
    name: 'Alpha',
    description: null,
    status: 'active',
    engineName: null,
    ownerUserId: 'u1',
    archivedAt: null,
    rootPath: '/home/me/projects/alpha',
    agentIntegration: 'claude',
    scriptType: 'sh',
    provisioningState: 'provisioned',
    provisionedAt: '2026-09-04T00:00:00Z',
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    ...over,
  };
}

function record(over: Partial<ProvisioningRecord> = {}): ProvisioningRecord {
  return {
    id: 'prov_1',
    workspaceId: 'ws_a',
    projectId: 'p1',
    actorId: 'u1',
    correlationId: 'c1',
    startedAt: '2026-09-04T00:00:00Z',
    endedAt: '2026-09-04T00:00:01Z',
    outcome: 'succeeded',
    stepsCompleted: ['resolve_root', 'write_project_json'],
    failedStep: null,
    failureReason: null,
    engineTag: 'v0.16.4',
    bundleVersion: '0.1.0',
    filesWritten: [],
    ...over,
  };
}

function detailApi(p: Project, records: ProvisioningRecord[] = [record()]): ApiClient {
  return {
    getProject: vi.fn(async () => p),
    listProvisioning: vi.fn(async () => records),
    listRequirements: vi.fn(async () => []),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1378 · the create form', () => {
  it('takes root path, agent integration and script type, and sends only what was given', async () => {
    const createProject = vi.fn(async () => project({ provisioningState: 'prepared' }));
    const api = { listProjects: vi.fn(async () => []), createProject } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    await screen.findByText(/no projects yet/i);
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText(/root path/i), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText(/agent integration/i), { target: { value: 'copilot' } });
    fireEvent.change(screen.getByLabelText(/script type/i), { target: { value: 'ps' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ name: 'Alpha', rootPath: 'alpha', agentIntegration: 'copilot', scriptType: 'ps' }));
  });

  it('leaves integration and script type to the configured defaults when not chosen', async () => {
    const createProject = vi.fn(async () => project());
    const api = { listProjects: vi.fn(async () => []), createProject } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    await screen.findByText(/no projects yet/i);
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText(/root path/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ name: 'Alpha', rootPath: 'alpha' }));
    expect(screen.getAllByText(/platform default/i).length).toBeGreaterThan(0);
  });

  it('shows the credential value ONCE with a copy control, and it is gone after navigating into the project', async () => {
    const created = project({
      provisioningState: 'prepared',
      connectorCredential: {
        id: 'c1', workspaceId: 'ws_a', projectId: 'p1', principalId: 'pr1', tokenPrefix: 'abcdefgh', label: 'provisioning',
        createdById: 'u1', createdAt: '2026-09-04T00:00:00Z', lastUsedAt: null, revokedAt: null, revokedById: null, value: 'pmi_ct_SECRETVALUE',
      },
    });
    const listProjects = vi.fn<() => Promise<Project[]>>().mockResolvedValueOnce([]).mockResolvedValue([created]);
    const onOpen = vi.fn();
    const api = { listProjects, createProject: vi.fn(async () => created) } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={onOpen} />);
    await screen.findByText(/no projects yet/i);
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText(/root path/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    const shown = await screen.findByText('pmi_ct_SECRETVALUE');
    expect(shown).toBeDefined();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByText(/shown once/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onOpen).toHaveBeenCalledWith('p1');
    expect(screen.queryByText('pmi_ct_SECRETVALUE')).toBeNull();
  });
});

describe('T1378 · the provisioning panel', () => {
  it('shows path, integration, script type, engine tag, extension version and state', async () => {
    render(<ProjectDetail api={detailApi(project())} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toContain('/home/me/projects/alpha');
    expect(panel.textContent).toContain('claude');
    expect(panel.textContent).toContain('sh');
    expect(panel.textContent).toContain('v0.16.4');
    expect(panel.textContent).toContain('0.1.0');
    expect(panel.textContent).toMatch(/provisioned/i);
  });

  it('prepared reads wait', async () => {
    render(<ProjectDetail api={detailApi(project({ provisioningState: 'prepared' }), [record({ outcome: 'pending' })])} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toMatch(/wait/i);
  });

  it('initialisation_pending reads run the setup skill', async () => {
    render(<ProjectDetail api={detailApi(project({ provisioningState: 'initialisation_pending' }))} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toMatch(/run the setup skill/i);
    expect(panel.textContent).toMatch(/setup-PMIStudio/);
  });

  it('failed names the step', async () => {
    const failed = record({ outcome: 'failed', failedStep: 'run_engine_init', failureReason: 'initialiser_unavailable: uv is not installed' });
    render(<ProjectDetail api={detailApi(project({ provisioningState: 'failed' }), [failed])} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toMatch(/run_engine_init/);
    expect(panel.textContent).toMatch(/uv is not installed/);
  });

  it('a project without a root path says so instead of showing an empty panel', async () => {
    render(<ProjectDetail api={detailApi(project({ rootPath: null, agentIntegration: null, scriptType: null, provisioningState: 'not_provisioned', provisionedAt: null }), [])} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toMatch(/no local directory/i);
  });
});

describe('T1397 · the panel keeps its own loading and error states (FR-LPW-051, FR-SHL-060)', () => {
  it('shows its own loading status while the provisioning history loads', async () => {
    const api = {
      getProject: vi.fn(async () => project()),
      listProvisioning: vi.fn(() => new Promise<ProvisioningRecord[]>(() => undefined)),
      listRequirements: vi.fn(async () => []),
    } as unknown as ApiClient;
    render(<ProjectDetail api={api} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    expect(panel.textContent).toMatch(/loading provisioning/i);
  });

  it('shows its own alert when the history fails, without hiding the project', async () => {
    const { ApiError } = await import('../../../src/services/api');
    const api = {
      getProject: vi.fn(async () => project()),
      listProvisioning: vi.fn(async () => {
        throw new ApiError('internal_error', 'Provisioning history unavailable.', 500);
      }),
      listRequirements: vi.fn(async () => []),
    } as unknown as ApiClient;
    render(<ProjectDetail api={api} projectId="p1" onBack={vi.fn()} />);
    const panel = await screen.findByRole('region', { name: /local workspace/i });
    await waitFor(() => expect(panel.textContent).toMatch(/history unavailable/i));
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(panel.textContent).toContain('/home/me/projects/alpha');
  });
});
