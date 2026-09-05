/**
 * `T1513` (EPIC-042, `FR-EXT-065`–`FR-EXT-068`) — the Constraints screen: the
 * Governance area is delivered; three filtered tables with add, edit, reorder
 * and retire; the policy form; the read-only preview with version and digest
 * and the Governed Execution section marked owned by PMI Studio; *file differs*
 * from a drifted workstation; forms disabled for a non-owner with the reason;
 * the four states. Written to FAIL before `T1514`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConstraintsPage } from '../../../src/pages/Constraints';
import { AREAS } from '../../../src/shell/areas';
import { ApiError, type ApiClient, type Project, type ProjectConstraint } from '../../../src/services/api';

const PROJECT = { id: 'p1', workspaceId: 'ws_a', name: 'Alpha', ownerUserId: 'u_owner', status: 'active' } as Project;

function entry(over: Partial<ProjectConstraint>): ProjectConstraint {
  return { id: 'c1', workspaceId: 'ws_a', projectId: 'p1', kind: 'principle', title: 'Spec first', body: 'Write it down.', order: 1, version: 1, status: 'active', createdById: 'u_owner', createdAt: '2026-09-04T00:00:00Z', updatedAt: '2026-09-04T00:00:00Z', ...over };
}

const ENTRIES = [entry({}), entry({ id: 'c2', title: 'Then build', body: 'Only then.', order: 2 }), entry({ id: 'c3', kind: 'constraint', title: 'Postgres 16', body: 'Nothing else.' }), entry({ id: 'c4', kind: 'non_goal', title: 'No mobile', body: '' })];

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    listConstraints: vi.fn(async () => ENTRIES),
    getPolicy: vi.fn(async () => ({ oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict', version: 1 })),
    getConstitution: vi.fn(async () => ({ version: 3, digest: 'a'.repeat(64), renderedAt: '2026-09-04T12:00:00Z', content: '<!-- GENERATED -->\n# Alpha Constitution\n\n## Governed Execution\n\nOffline mode: strict\n', inputs: {} })),
    listWorkstationConnections: vi.fn(async () => []),
    createConstraint: vi.fn(async () => entry({ id: 'c9' })),
    updateConstraint: vi.fn(async () => entry({})),
    reorderConstraint: vi.fn(async () => entry({})),
    retireConstraint: vi.fn(async () => entry({ status: 'retired' })),
    putPolicy: vi.fn(async () => ({ oneSpecPerEpic: true, taskCeiling: 40, splitRequiresConfirmation: true, offlineMode: 'provisional', version: 2 })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function page(client: ApiClient, currentUserId = 'u_owner') {
  render(<ConstraintsPage api={client} projectId="p1" currentUserId={currentUserId} />);
  await screen.findByRole('heading', { name: 'Constraints' });
  await waitFor(() => expect(screen.queryByText('Loading constraints')).toBeNull());
}

describe('T1513 · the Governance area', () => {
  it('is delivered and reachable at /governance', () => {
    const governance = AREAS.find((a) => a.id === 'governance');
    expect(governance?.status).toBe('delivered');
    expect(governance?.path).toBe('/governance');
    expect(governance?.element).toBeDefined();
  });
});

describe('T1513 · the Constraints screen', () => {
  it('shows three filtered tables by kind, in order, with add, edit, reorder and retire', async () => {
    await page(api());
    for (const caption of ['Principles', 'Constraints', 'Non-goals']) {
      const section = screen.getByRole('region', { name: caption });
      expect(within(section).getByLabelText(`Filter ${caption.toLowerCase()}`)).toBeDefined();
    }
    const principles = screen.getByRole('region', { name: 'Principles' });
    const rows = within(principles).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[1]?.textContent)).toEqual(['Spec first', 'Then build']);
    expect(within(principles).getByRole('button', { name: 'Edit Spec first' })).toBeDefined();
    expect(within(principles).getByRole('button', { name: 'Move down Spec first' })).toBeDefined();
    expect(within(principles).getByRole('button', { name: 'Retire Spec first' })).toBeDefined();
  });

  it('adds an entry through the form and reloads', async () => {
    const client = api();
    await page(client);
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'non_goal' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No SSO' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Not in v1.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() => expect(client.createConstraint).toHaveBeenCalledWith('p1', { kind: 'non_goal', title: 'No SSO', body: 'Not in v1.' }));
    await waitFor(() => expect(client.listConstraints).toHaveBeenCalledTimes(2));
  });

  it('edits, reorders and retires', async () => {
    const client = api();
    await page(client);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Spec first' }));
    const form = screen.getByRole('form', { name: 'Edit Spec first' });
    fireEvent.change(within(form).getByLabelText('Body'), { target: { value: 'Write it down, then build.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(client.updateConstraint).toHaveBeenCalledWith('p1', 'c1', { title: 'Spec first', body: 'Write it down, then build.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down Spec first' }));
    await waitFor(() => expect(client.reorderConstraint).toHaveBeenCalledWith('p1', 'c1', 2));
    expect(client.reorderConstraint).toHaveBeenCalledWith('p1', 'c2', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Retire Postgres 16' }));
    await waitFor(() => expect(client.retireConstraint).toHaveBeenCalledWith('p1', 'c3'));
  });

  it('shows the policy with its version and saves the four fields', async () => {
    const client = api();
    await page(client);
    const form = screen.getByRole('form', { name: 'Decomposition policy' });
    expect(within(form).getByText(/Version 1\./)).toBeDefined();
    fireEvent.change(within(form).getByLabelText('Task ceiling'), { target: { value: '40' } });
    fireEvent.change(within(form).getByLabelText('Offline mode'), { target: { value: 'provisional' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save policy' }));
    await waitFor(() => expect(client.putPolicy).toHaveBeenCalledWith('p1', { oneSpecPerEpic: true, taskCeiling: 40, splitRequiresConfirmation: true, offlineMode: 'provisional' }));
  });

  it('previews the render read-only with version and digest, and says the Governed Execution section is owned by PMI Studio', async () => {
    await page(api());
    const preview = screen.getByRole('region', { name: 'Constitution preview' });
    expect(within(preview).getByText(/Version 3/)).toBeDefined();
    expect(within(preview).getByText('a'.repeat(64))).toBeDefined();
    expect(within(preview).getByText(/owned by PMI Studio/)).toBeDefined();
    expect(within(preview).getByLabelText('Rendered constitution').textContent).toContain('# Alpha Constitution');
    expect(within(preview).queryByRole('textbox')).toBeNull();
  });

  it('shows file differs while a workstation reports drift or stale, naming it', async () => {
    await page(api({ listWorkstationConnections: vi.fn(async () => [{ credentialId: 'cred', label: 'laptop', credentialState: 'active', firstSeenAt: '2026-09-04T00:00:00Z', lastSeenAt: '2026-09-04T00:00:00Z', extensionVersion: '0.2.0', toolkitVersion: null, contractVersion: '1.0', serverVersion: null, constitutionDigest: 'f'.repeat(64), constitutionState: 'drift', constitutionReportedAt: '2026-09-04T12:00:00Z' }]) }));
    const status = screen.getByRole('status', { name: 'Constitution file differs' });
    expect(status.textContent).toContain('laptop');
    expect(status.textContent).toContain('matches no render');
  });

  it('disables the forms for a writer without the owner grant and says why; reading still works', async () => {
    await page(api(), 'u_writer');
    expect(screen.getByText(/Only the project's owner may change constraints/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add entry' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Save policy' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Edit Spec first' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('region', { name: 'Constitution preview' })).toBeDefined();
  });

  it('four states: loading, error, empty, partial', async () => {
    render(<ConstraintsPage api={api({ getConstitution: vi.fn(() => new Promise(() => undefined)) })} projectId="p1" currentUserId="u_owner" />);
    expect(screen.getByText('Loading constraints')).toBeDefined();
    cleanup();

    const failing = api({
      getProject: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }),
      listConstraints: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }),
      getPolicy: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }),
      getConstitution: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }),
      listWorkstationConnections: vi.fn(async () => { throw new ApiError('internal_error', 'Down.', 500); }),
    });
    render(<ConstraintsPage api={failing} projectId="p1" currentUserId="u_owner" />);
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('alert')[0]?.textContent).toContain('Down.');
    cleanup();

    await page(api({ listConstraints: vi.fn(async () => []) }));
    expect(screen.getByText('No principles yet.')).toBeDefined();
    cleanup();

    await page(api({ getConstitution: vi.fn(async () => { throw new ApiError('internal_error', 'Render down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Some of this screen did not load');
    expect(screen.getByRole('region', { name: 'Principles' })).toBeDefined();
  });
});
