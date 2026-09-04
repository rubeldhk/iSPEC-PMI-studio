/**
 * `T1380` (EPIC-041) — the connector credentials screen (`FR-LPW-052`, `UX-0040`).
 *
 * List with label, creator, created, last used, revoked; filter by revoked
 * and label (`PMI-DOC-005`); mint shows the value once; revoke asks for
 * confirmation naming the label; no cell ever renders a value or hash;
 * keyboard reachable at 360 px.
 *
 * Written to FAIL before `T1381` exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConnectorCredentialsPage } from '../../../src/pages/ConnectorCredentials';
import type { ApiClient, ConnectorCredential } from '../../../src/services/api';

function credential(over: Partial<ConnectorCredential> & { tokenHash?: string } = {}): ConnectorCredential {
  return {
    id: 'c1',
    workspaceId: 'ws_a',
    projectId: 'p1',
    principalId: 'pr1',
    tokenPrefix: 'abcdefgh',
    label: 'laptop',
    createdById: 'u_owner',
    createdAt: '2026-09-04T09:00:00Z',
    lastUsedAt: '2026-09-04T10:00:00Z',
    revokedAt: null,
    revokedById: null,
    ...over,
  };
}

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    listConnectorCredentials: vi.fn(async () => [credential(), credential({ id: 'c2', label: 'ci', revokedAt: '2026-09-04T11:00:00Z', revokedById: 'u_owner' })]),
    mintConnectorCredential: vi.fn(async (_p: string, label: string) => ({ ...credential({ id: 'c3', label }), value: 'pmi_ct_NEWVALUE' })),
    revokeConnectorCredential: vi.fn(async (id: string) => credential({ id, revokedAt: '2026-09-04T12:00:00Z', revokedById: 'u_owner' })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T1380 · the list', () => {
  it('shows label, creator, created, last used and revoked for each credential', async () => {
    render(<ConnectorCredentialsPage api={api()} projectId="p1" />);
    const table = await screen.findByRole('table');
    const text = table.textContent ?? '';
    expect(text).toContain('laptop');
    expect(text).toContain('u_owner');
    expect(text).toContain('2026-09-04T09:00:00Z');
    expect(text).toContain('2026-09-04T10:00:00Z');
    expect(text).toContain('2026-09-04T11:00:00Z');
    for (const header of [/label/i, /creator/i, /created/i, /last used/i, /revoked/i]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeDefined();
    }
  });

  it('never renders a value or a hash, even when the API leaks one', async () => {
    const leaky = api({ listConnectorCredentials: vi.fn(async () => [credential({ tokenHash: 'deadbeefdeadbeef' })]) });
    render(<ConnectorCredentialsPage api={leaky} projectId="p1" />);
    await screen.findByRole('table');
    expect(document.body.textContent).not.toContain('deadbeef');
    expect(document.body.textContent).not.toMatch(/pmi_ct_/);
  });

  it('filters by revoked and label through the client (PMI-DOC-005)', async () => {
    const client = api();
    render(<ConnectorCredentialsPage api={client} projectId="p1" />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText(/show revoked only/i));
    await waitFor(() => expect(client.listConnectorCredentials).toHaveBeenLastCalledWith('p1', { revoked: true }));
    fireEvent.change(screen.getByLabelText(/filter by label/i), { target: { value: 'ci' } });
    await waitFor(() => expect(client.listConnectorCredentials).toHaveBeenLastCalledWith('p1', { revoked: true, label: 'ci' }));
  });
});

describe('T1380 · mint and revoke', () => {
  it('mint shows the value once with a copy control, and the list refreshes', async () => {
    const client = api();
    render(<ConnectorCredentialsPage api={client} projectId="p1" />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText(/new credential label/i), { target: { value: 'ci box' } });
    fireEvent.click(screen.getByRole('button', { name: /^mint$/i }));
    expect(await screen.findByText('pmi_ct_NEWVALUE')).toBeDefined();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getAllByText(/shown once/i).length).toBeGreaterThan(0);
    expect(client.mintConnectorCredential).toHaveBeenCalledWith('p1', 'ci box');
    expect(client.listConnectorCredentials).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('pmi_ct_NEWVALUE')).toBeNull();
  });

  it('revoke asks for confirmation naming the label, then revokes', async () => {
    const client = api();
    render(<ConnectorCredentialsPage api={client} projectId="p1" />);
    const table = await screen.findByRole('table');
    fireEvent.click(within(table).getAllByRole('button', { name: /revoke/i })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('laptop');
    expect(client.revokeConnectorCredential).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /revoke/i }));
    await waitFor(() => expect(client.revokeConnectorCredential).toHaveBeenCalledWith('c1'));
  });

  it('a revoked credential offers no revoke control', async () => {
    render(<ConnectorCredentialsPage api={api()} projectId="p1" />);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('button', { name: /revoke/i })).toHaveLength(1);
  });
});

describe('T1380 · reachable by keyboard at 360 px (UX-0040)', () => {
  it('every control is in the tab order and nothing is wider than the viewport', async () => {
    render(<ConnectorCredentialsPage api={api()} projectId="p1" />);
    await screen.findByRole('table');
    const controls = [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox'), ...screen.getAllByRole('checkbox')];
    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    // No fixed width can exceed a 360 px viewport.
    for (const styled of document.querySelectorAll<HTMLElement>('[style]')) {
      const width = styled.style.width;
      if (/px$/.test(width)) expect(Number.parseFloat(width)).toBeLessThanOrEqual(360);
    }
  });
});
