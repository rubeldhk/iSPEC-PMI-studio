/**
 * T401 — storage connection and publish status (EPIC-025 US5).
 * Written to FAIL before T402 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StorageConnectionsPage } from '../../../src/pages/StorageConnections';
import type { ApiClient, PublishRecord, StorageConnection } from '../../../src/services/api';

function connection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: 'conn_1',
    providerName: 'fixture',
    destination: 'team-folder',
    status: 'healthy',
    authorisedById: 'u1',
    lastCheckedAt: null,
    disconnectedAt: null,
    ...overrides,
  };
}

function publishRecord(overrides: Partial<PublishRecord> = {}): PublishRecord {
  return {
    id: 'pub_1',
    projectId: 'p1',
    connectionId: 'conn_1',
    initiatedById: 'u1',
    state: 'succeeded',
    failureReason: null,
    failureMessage: null,
    artifactsIncluded: [{ artifactId: 's1', name: 's1.md', landed: true }],
    artifactsExcluded: [],
    destinationLocations: ['team-folder/p1/s1.md'],
    publishedAt: '2026-08-21T15:00:00Z',
    ...overrides,
  };
}

function api(
  connections: StorageConnection[] = [connection()],
  publishes: PublishRecord[] = [],
): ApiClient {
  return {
    listStorageConnections: vi.fn(async () => connections),
    listPublishes: vi.fn(async () => publishes),
    createStorageConnection: vi.fn(async () => connection()),
    disconnectStorageConnection: vi.fn(async () => connection({ disconnectedAt: 'now' })),
    publishProject: vi.fn(async () => publishRecord()),
    getPublishPreview: vi.fn(async () => ({ added: ['a.md'], replaced: ['b.md'], unchanged: [] })),
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('StorageConnectionsPage (US5)', () => {
  it('shows each connection with its distinct health state', async () => {
    const client = api([
      connection(),
      connection({ id: 'conn_2', destination: 'other', status: 'needs_reauthorisation' }),
      connection({ id: 'conn_3', destination: 'third', status: 'unavailable' }),
    ]);
    render(<StorageConnectionsPage api={client} workspaceId="ws1" projectId="p1" />);
    expect(await screen.findByText('Healthy')).toBeDefined();
    expect(screen.getByText('Needs re-authorisation')).toBeDefined();
    expect(screen.getByText('Unavailable')).toBeDefined();
  });

  it('connects a provider with a destination', async () => {
    const client = api([]);
    render(<StorageConnectionsPage api={client} workspaceId="ws1" projectId="p1" />);
    await screen.findByText('No storage connection yet.');
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'fixture' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'folder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(client.createStorageConnection).toHaveBeenCalledWith('ws1', {
        providerType: 'fixture',
        destination: 'folder',
      }),
    );
  });

  it('publishes the whole project — no artifact selection is offered', async () => {
    const client = api();
    render(<StorageConnectionsPage api={client} workspaceId="ws1" projectId="p1" />);
    await screen.findByText('Healthy');
    fireEvent.click(screen.getByRole('button', { name: 'Publish project' }));
    await waitFor(() => expect(client.publishProject).toHaveBeenCalledWith('p1'));
    // Nothing on this page lets a user narrow the publish to a subset.
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows the latest publish state, its named failure, and exclusions with reasons', async () => {
    const failed = publishRecord({
      state: 'failed',
      failureReason: 'quota_exceeded',
      failureMessage: 'The provider refused for lack of storage quota at the destination.',
      artifactsExcluded: [{ artifactId: 's9', name: 's9.md', reason: 'The publisher does not have access to this artifact.' }],
    });
    render(<StorageConnectionsPage api={api([connection()], [failed])} workspaceId="ws1" projectId="p1" />);
    expect(await screen.findByText('failed')).toBeDefined();
    expect(screen.getByText(/storage quota/)).toBeDefined();
    expect(screen.getByText(/does not have access/)).toBeDefined();
  });

  it('shows the republish preview — added, replaced, unchanged', async () => {
    const client = api();
    render(<StorageConnectionsPage api={client} workspaceId="ws1" projectId="p1" />);
    await screen.findByText('Healthy');
    fireEvent.click(screen.getByRole('button', { name: 'Preview republish' }));
    const note = await screen.findByRole('note');
    expect(note.textContent).toContain('1 added');
    expect(note.textContent).toContain('1 replaced');
    expect(note.textContent).toContain('0 unchanged');
  });
});
