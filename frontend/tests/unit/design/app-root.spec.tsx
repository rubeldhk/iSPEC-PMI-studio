/**
 * T899a (EPIC-029) — Constitution XI Tier 1: the application mounted at its
 * ROOT renders a delivered page with token-derived styling resolved.
 *
 * `T866a` asserts the import LINE exists by reading main.tsx as text; `T883`
 * renders page components directly. Neither drives the real entry point —
 * which is the difference Principle XI was written for: six defects in this
 * programme were components that worked everywhere except the composed
 * application. This file imports the REAL entry module (`main.tsx`), whose
 * side-effect imports are the stylesheets, and mounts the App it exports —
 * the same composed tree `createRoot` renders in production.
 *
 * Mutation-verified by removing a stylesheet import from main.tsx: the
 * styled-document assertion MUST fail (observed 2026-08-21, this Epic's
 * implement run).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
// The REAL entry module. Its side effects import tokens.css, themes.css and
// components.css; its App is the tree the production root renders. (The
// module's own createRoot call is a no-op here — jsdom has no #root element.)
import { App } from '../../../src/main';
import type { ApiClient } from '../../../src/services/api';

afterEach(cleanup);

/** No live session: the shell resolves to the sign-in page — a delivered page. */
const api = {
  me: async (): Promise<never> => {
    throw new Error('no session');
  },
} as unknown as ApiClient;

describe('T899a · XI Tier 1 — the composed application renders styled', () => {
  it('mounts at the root and reaches a delivered page', async () => {
    render(<App api={api} />);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('the token stylesheets actually reach the document — not merely the import line', async () => {
    render(<App api={api} />);
    await screen.findByRole('button', { name: /sign in/i });
    const styles = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    // Sentinels are chosen to be UNIQUE to their file: the first mutation run
    // proved '--color-surface' too weak — themes.css re-states it, so removing
    // tokens.css still passed. Only tokens.css carries the space scale and the
    // focus treatment; only themes.css carries the data-theme blocks.
    expect(styles, 'tokens.css did not reach the document').toContain('--space-3:');
    expect(styles, 'tokens.css did not reach the document').toContain(':focus-visible');
    expect(styles, 'themes.css did not reach the document').toContain("[data-theme='dark']");
    expect(styles, 'components.css did not reach the document').toContain('.ds-button');
  });

  it('and the delivered page consumes it — the sign-in button is a design-system button', async () => {
    render(<App api={api} />);
    const button = await screen.findByRole('button', { name: /sign in/i });
    expect(button.className).toContain('ds-button');
  });
});

describe('T913 · XI Tier 1 — the theme override is WIRED, not merely built', () => {
  // Convergence finding F1: theme.ts passed every unit test while nothing
  // called it — the built-but-never-wired shape. These assertions drive the
  // COMPOSED app, so they fail whenever the wiring goes missing again.
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('a stored preference is applied when the app mounts (FR-DS-011: persistent)', async () => {
    window.localStorage.setItem('pmi.theme', 'dark');
    render(<App api={api} />);
    await screen.findByRole('button', { name: /sign in/i });
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('a theme control is reachable in the composed app and the override persists', async () => {
    render(<App api={api} />);
    const control = await screen.findByLabelText(/theme/i);
    fireEvent.change(control, { target: { value: 'dark' } });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('pmi.theme')).toBe('dark');
  });

  it('choosing follow-system clears the override and returns to the OS', async () => {
    window.localStorage.setItem('pmi.theme', 'light');
    render(<App api={api} />);
    const control = await screen.findByLabelText(/theme/i);
    fireEvent.change(control, { target: { value: '' } });
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(window.localStorage.getItem('pmi.theme')).toBeNull();
  });
});
