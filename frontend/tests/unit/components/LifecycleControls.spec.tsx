/**
 * T115a — lifecycle transition controls (FR-015/FR-016, US6).
 * Written to FAIL before T116 exists (Constitution V).
 *
 * M08 §8: exactly 8 permitted transitions. The UI mirrors the server-side map
 * — an invalid transition is NOT offered at all, never offered-then-rejected.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LifecycleControls } from '../../../src/components/LifecycleControls';
import type { ApiClient, Specification } from '../../../src/services/api';

function api(): ApiClient {
  return {
    transitionSpecification: vi.fn(async () => ({ lifecycleState: 'review' })),
  } as unknown as ApiClient;
}

function controls(state: Specification['lifecycleState'], client = api()) {
  const onTransitioned = vi.fn();
  render(
    <LifecycleControls api={client} specificationId="s1" lifecycleState={state} onTransitioned={onTransitioned} />,
  );
  return { client, onTransitioned };
}

afterEach(cleanup);

describe('LifecycleControls (M08 §8 mirrored client-side)', () => {
  it('draft offers ONLY submit for review', () => {
    controls('draft');
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeDefined();
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('review offers approve and reject — nothing else', () => {
    controls('review');
    expect(screen.getByRole('button', { name: /approve/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /reject/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /baseline/i })).toBeNull();
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('approved offers baseline and archive', () => {
    controls('approved');
    expect(screen.getByRole('button', { name: /baseline/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDefined();
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('baselined offers mark implemented and archive', () => {
    controls('baselined');
    expect(screen.getByRole('button', { name: /mark implemented/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDefined();
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('implemented offers archive only; archived is terminal — NO buttons', () => {
    controls('implemented');
    expect(screen.getByRole('button', { name: /archive/i })).toBeDefined();
    expect(screen.getAllByRole('button').length).toBe(1);
    cleanup();
    controls('archived');
    expect(screen.queryAllByRole('button').length).toBe(0);
    expect(screen.getByText(/archived/i)).toBeDefined();
  });

  it('clicking a control calls the matching transition action and reports back', async () => {
    const { client, onTransitioned } = controls('draft');
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));
    await waitFor(() => expect(onTransitioned).toHaveBeenCalled());
    expect(client.transitionSpecification).toHaveBeenCalledWith('s1', 'submit-for-review');
  });
});
