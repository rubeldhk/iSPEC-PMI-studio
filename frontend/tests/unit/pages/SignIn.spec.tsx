/**
 * T056a — the sign-in page: submit, error, and redirect.
 * Written to FAIL before T057 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SignIn } from '../../../src/pages/SignIn';
import { ApiError, type ApiClient, type WhoAmI } from '../../../src/services/api';

const WHOAMI: WhoAmI = {
  user: { id: 'u1', email: 'owner@example.test', displayName: 'Owner' },
  workspace: { id: 'ws_a' },
};

function api(signIn: ApiClient['signIn']): ApiClient {
  return { signIn } as unknown as ApiClient;
}

afterEach(cleanup);

function fillAndSubmit(email: string, password: string): void {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('SignIn · submit', () => {
  it('submits the entered credentials to the API client', async () => {
    const signIn = vi.fn(async () => WHOAMI);
    render(<SignIn api={api(signIn)} onSignedIn={vi.fn()} />);
    fillAndSubmit('owner@example.test', 'pw');
    expect(signIn).toHaveBeenCalledWith('owner@example.test', 'pw');
  });

  it('disables the button while the request is in flight', async () => {
    let resolve!: (v: WhoAmI) => void;
    const signIn = vi.fn(() => new Promise<WhoAmI>((r) => (resolve = r)));
    render(<SignIn api={api(signIn)} onSignedIn={vi.fn()} />);
    fillAndSubmit('owner@example.test', 'pw');
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDefined();
    resolve(WHOAMI);
    await screen.findByRole('button', { name: /sign in/i });
  });
});

describe('SignIn · error', () => {
  it('shows the API error message on rejection — and does not redirect', async () => {
    const signIn = vi.fn(async () => {
      throw new ApiError('unauthenticated', 'Invalid email or password.', 401);
    });
    const onSignedIn = vi.fn();
    render(<SignIn api={api(signIn)} onSignedIn={onSignedIn} />);
    fillAndSubmit('owner@example.test', 'wrong');
    expect(await screen.findByText('Invalid email or password.')).toBeDefined();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('clears a previous error on the next attempt', async () => {
    const signIn = vi
      .fn<ApiClient['signIn']>()
      .mockRejectedValueOnce(new ApiError('unauthenticated', 'Invalid email or password.', 401))
      .mockResolvedValueOnce(WHOAMI);
    render(<SignIn api={api(signIn)} onSignedIn={vi.fn()} />);
    fillAndSubmit('owner@example.test', 'wrong');
    await screen.findByText('Invalid email or password.');
    fillAndSubmit('owner@example.test', 'right');
    await vi.waitFor(() => {
      expect(screen.queryByText('Invalid email or password.')).toBeNull();
    });
  });
});

describe('SignIn · redirect', () => {
  it('hands the established identity to onSignedIn', async () => {
    const onSignedIn = vi.fn();
    render(<SignIn api={api(vi.fn(async () => WHOAMI))} onSignedIn={onSignedIn} />);
    fillAndSubmit('owner@example.test', 'pw');
    await vi.waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledWith(WHOAMI);
    });
  });
});
