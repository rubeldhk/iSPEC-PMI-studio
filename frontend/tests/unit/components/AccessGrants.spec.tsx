/**
 * T399 — access grant management (EPIC-024 US4).
 * Written to FAIL before T400 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessGrants } from '../../../src/components/AccessGrants';
import { ApiError, type AccessGrant, type ApiClient } from '../../../src/services/api';

const GRANTS: AccessGrant[] = [
  { id: 'g1', artifactType: 'specification', artifactId: 's1', userId: 'u_admin', level: 'edit', grantedById: 'u_admin', grantedAt: 't', revokedAt: null },
  { id: 'g2', artifactType: 'specification', artifactId: 's1', userId: 'u_alice', level: 'read', grantedById: 'u_admin', grantedAt: 't', revokedAt: null },
];

function api(overrides: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    listGrants: vi.fn(async () => GRANTS),
    createGrant: vi.fn(async () => GRANTS[0]),
    revokeGrant: vi.fn(async () => ({ ...GRANTS[1], revokedAt: 'now' })),
    ...overrides,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('AccessGrants (US4)', () => {
  it('lists who has access at which level', async () => {
    render(<AccessGrants api={api()} artifactType="specification" artifactId="s1" />);
    expect(await screen.findByText('u_admin')).toBeDefined();
    expect(screen.getByText('u_alice')).toBeDefined();
    expect(screen.getByText('edit')).toBeDefined();
    expect(screen.getByText('read')).toBeDefined();
  });

  it('grants access with a user and level', async () => {
    const client = api();
    render(<AccessGrants api={client} artifactType="specification" artifactId="s1" />);
    await screen.findByText('u_admin');
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'u_bob' } });
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    await waitFor(() =>
      expect(client.createGrant).toHaveBeenCalledWith('specification', 's1', {
        userId: 'u_bob',
        level: 'edit',
      }),
    );
  });

  it('revokes a grant', async () => {
    const client = api();
    render(<AccessGrants api={client} artifactType="specification" artifactId="s1" />);
    await screen.findByText('u_alice');
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    fireEvent.click(revokeButtons[1]!);
    await waitFor(() => expect(client.revokeGrant).toHaveBeenCalledWith('specification', 's1', 'g2'));
  });

  it('surfaces the last-editor refusal instead of pretending it worked', async () => {
    const client = api({
      revokeGrant: vi.fn(async () => {
        throw new ApiError(
          'conflict',
          'Revoking this grant would leave the artifact with no user holding edit access (FR-ACC-027).',
          409,
        );
      }),
    });
    render(<AccessGrants api={client} artifactType="specification" artifactId="s1" />);
    await screen.findByText('u_admin');
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]!);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('no user holding edit access');
  });

  it('an open artifact says so — no grants is a state, not an error', async () => {
    const client = api({ listGrants: vi.fn(async () => []) });
    render(<AccessGrants api={client} artifactType="specification" artifactId="s1" />);
    expect(await screen.findByText(/Open — no grants yet/)).toBeDefined();
  });
});
