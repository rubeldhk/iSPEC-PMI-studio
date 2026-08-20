/**
 * T055a — the projects pages: list, create, detail, rename, archive.
 * Written to FAIL before T056 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectDetail, ProjectsPage } from '../../../src/pages/Projects';
import { ApiError, type ApiClient, type Project } from '../../../src/services/api';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    workspaceId: 'ws_a',
    name: 'Platform',
    description: null,
    status: 'active',
    engineName: null,
    ownerUserId: 'u1',
    archivedAt: null,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

afterEach(cleanup);

describe('ProjectsPage · list', () => {
  it('lists the workspace\'s projects from the API', async () => {
    const api = {
      listProjects: vi.fn(async () => [project(), project({ id: 'p2', name: 'Studio' })]),
    } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    expect(await screen.findByText('Platform')).toBeDefined();
    expect(screen.getByText('Studio')).toBeDefined();
  });

  it('shows an empty state instead of a blank page', async () => {
    const api = { listProjects: vi.fn(async () => []) } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    expect(await screen.findByText(/no projects yet/i)).toBeDefined();
  });

  it('opens a project on click', async () => {
    const api = { listProjects: vi.fn(async () => [project()]) } as unknown as ApiClient;
    const onOpen = vi.fn();
    render(<ProjectsPage api={api} onOpen={onOpen} />);
    fireEvent.click(await screen.findByText('Platform'));
    expect(onOpen).toHaveBeenCalledWith('p1');
  });
});

describe('ProjectsPage · create', () => {
  it('creates a project and refreshes the list', async () => {
    const created = project({ id: 'p9', name: 'New one' });
    const listProjects = vi
      .fn<() => Promise<Project[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);
    const createProject = vi.fn(async () => created);
    const api = { listProjects, createProject } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    await screen.findByText(/no projects yet/i);

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'New one' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(createProject).toHaveBeenCalledWith({ name: 'New one' });
    expect(await screen.findByText('New one')).toBeDefined();
  });

  it('surfaces a duplicate-name conflict from the API', async () => {
    const api = {
      listProjects: vi.fn(async () => [project()]),
      createProject: vi.fn(async () => {
        throw new ApiError('conflict', 'A project named "Platform" already exists in this workspace.', 409);
      }),
    } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    await screen.findByText('Platform');
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Platform' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByText(/already exists/i)).toBeDefined();
  });
});

describe('ProjectDetail', () => {
  it('renders the project, renames it, and archives it — content preserved', async () => {
    const p = project({ description: 'kept through archival' });
    const getProject = vi.fn(async () => p);
    const updateProject = vi.fn(async () => ({ ...p, name: 'Renamed' }));
    const archiveProject = vi.fn(async () => ({
      ...p,
      status: 'archived' as const,
      archivedAt: '2026-08-20T10:00:00Z',
    }));
    const api = { getProject, updateProject, archiveProject } as unknown as ApiClient;
    render(<ProjectDetail api={api} projectId="p1" onBack={vi.fn()} />);

    expect(await screen.findByDisplayValue('Platform')).toBeDefined();
    expect(screen.getByText('kept through archival')).toBeDefined();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    expect(updateProject).toHaveBeenCalledWith('p1', { name: 'Renamed' });

    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(archiveProject).toHaveBeenCalledWith('p1');
    // Archived is a state you can SEE, with the content still on screen.
    expect(await screen.findByText(/archived/i)).toBeDefined();
    expect(screen.getByText('kept through archival')).toBeDefined();
  });
});
