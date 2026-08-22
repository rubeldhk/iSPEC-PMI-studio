/**
 * T873 (EPIC-029) — theme selection and persistence (FR-DS-011, SC-DS-005).
 *
 * The contract (contracts/tokens.md · Theme selection):
 *   no stored preference  → follow the OS (`prefers-color-scheme`)
 *   stored 'light'|'dark' → that theme, regardless of OS
 *   preference cleared    → back to following the OS
 *
 * The CSS carries the OS default (a media block in themes.css), so "follow
 * the OS" means the document carries NO data-theme attribute — the attribute
 * exists only to record an explicit override. That division is what these
 * tests pin down.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearTheme,
  getStoredTheme,
  initTheme,
  resolveTheme,
  setTheme,
} from '../../../src/design/theme';

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset['theme'];
});

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset['theme'];
});

describe('T873 · resolveTheme — OS preference is the default', () => {
  it('follows the OS when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('an explicit override wins regardless of the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('T873 · setTheme — the override applies and persists', () => {
  it('sets the data-theme attribute the stylesheets key on', () => {
    setTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('persists, so a fresh load restores it', () => {
    setTheme('dark');
    // Simulate the next load: attribute gone, storage intact.
    delete document.documentElement.dataset['theme'];
    initTheme();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(getStoredTheme()).toBe('dark');
  });
});

describe('T873 · clearTheme — clearing returns to the OS', () => {
  it('removes both the stored preference and the attribute', () => {
    setTheme('light');
    clearTheme();
    expect(getStoredTheme()).toBeNull();
    // No attribute means the media block in themes.css governs — the OS.
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('initTheme after clearing leaves the OS in charge', () => {
    setTheme('dark');
    clearTheme();
    initTheme();
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });
});
