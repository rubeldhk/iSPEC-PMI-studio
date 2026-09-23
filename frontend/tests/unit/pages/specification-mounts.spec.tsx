/**
 * `T1384` (EPIC-041) — the four built-but-unmounted specification components
 * are rendered by `Specification.tsx` (`FR-LPW-044`, `R-041-11`; analysis `T3`).
 *
 * `LifecycleControls`, `ValidationFindings`, `VersionHistory` and
 * `VersionDiff` are each rendered for a loaded specification; `VersionDiff`
 * opens from a `VersionHistory` selection; and each keeps its own four states.
 *
 * Written to FAIL before `T1376` mounts them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SpecificationView } from '../../../src/pages/Specification';
import { ApiError, type ApiClient, type Specification, type SpecificationVersionInfo } from '../../../src/services/api';

const SPEC: Specification = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Payments spec',
  lifecycleState: 'review',
  currentVersionId: 'sv2',
  engineName: 'fixture',
  engineVersion: '1.0.0',
  generatedAt: '2026-09-04T10:00:00Z',
  isOutOfDate: false,
  createdAt: '2026-09-04T10:00:00Z',
  updatedAt: '2026-09-04T10:00:00Z',
};

const VERSIONS: SpecificationVersionInfo[] = [
  { id: 'sv1', versionNumber: 1, lifecycleStateAtCreation: 'draft', authoredById: 'u1', authoredAt: '2026-09-01T00:00:00Z' },
  { id: 'sv2', versionNumber: 2, lifecycleStateAtCreation: 'review', authoredById: 'u1', authoredAt: '2026-09-02T00:00:00Z' },
];

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getSpecification: vi.fn(async () => SPEC),
    listSpecificationVersions: vi.fn(async () => VERSIONS),
    getFindings: vi.fn(async () => []),
    diffSpecificationVersions: vi.fn(async () => ({ fromVersion: 1, toVersion: 2, identical: false, added: ['- FR-002'], removed: [], replaced: [], unchanged: [] })),
    transitionSpecification: vi.fn(async () => ({ ...SPEC, lifecycleState: 'approved' })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1384 · the four components are mounted for a loaded specification', () => {
  it('renders LifecycleControls for the current state', async () => {
    render(<SpecificationView api={api()} specificationId="s1" />);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined();
  });

  it('a transition refreshes the specification (LifecycleControls.onTransitioned)', async () => {
    const client = api();
    render(<SpecificationView api={client} specificationId="s1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(client.getSpecification).toHaveBeenCalledTimes(2));
  });

  it('renders ValidationFindings and VersionHistory', async () => {
    render(<SpecificationView api={api()} specificationId="s1" />);
    expect(await screen.findByRole('heading', { name: /validation findings/i })).toBeDefined();
    expect(await screen.findByRole('heading', { name: /version history/i })).toBeDefined();
    expect(screen.getByText(/no findings/i)).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();
  });

  it('VersionDiff opens from a VersionHistory selection of two versions', async () => {
    const client = api();
    render(<SpecificationView api={client} specificationId="s1" />);
    await screen.findByRole('heading', { name: /version history/i });
    expect(screen.queryByRole('heading', { name: /comparing/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /compare v1/i }));
    fireEvent.click(screen.getByRole('button', { name: /compare v2/i }));
    expect(await screen.findByRole('heading', { name: /comparing v1 to v2/i })).toBeDefined();
    expect(client.diffSpecificationVersions).toHaveBeenCalledWith('s1', 1, 2);
  });
});

describe('T1384 · each mounted component keeps its own four states', () => {
  it('loading — history and findings show their own loading text while pending', async () => {
    const client = api({
      listSpecificationVersions: vi.fn(() => new Promise<SpecificationVersionInfo[]>(() => undefined)),
      getFindings: vi.fn(() => new Promise<never>(() => undefined)),
    });
    render(<SpecificationView api={client} specificationId="s1" />);
    await screen.findByText('Payments spec');
    expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(2);
  });

  it('error — a failing history is an alert that does not take the findings down with it', async () => {
    const client = api({
      listSpecificationVersions: vi.fn(async () => {
        throw new ApiError('internal_error', 'History unavailable.', 500);
      }),
    });
    render(<SpecificationView api={client} specificationId="s1" />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/history unavailable/i);
    expect(await screen.findByText(/no findings/i)).toBeDefined();
  });

  it('empty — an archived specification says so instead of offering nothing', async () => {
    const client = api({ getSpecification: vi.fn(async () => ({ ...SPEC, lifecycleState: 'archived' })) });
    render(<SpecificationView api={client} specificationId="s1" />);
    expect(await screen.findByText(/no further transitions/i)).toBeDefined();
  });
});
