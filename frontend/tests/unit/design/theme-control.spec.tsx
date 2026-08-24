/**
 * T913 (EPIC-029) — the theme control's own unit test (Constitution V:
 * ThemeControl.tsx is application code, so it carries one).
 *
 * The control is the user-facing half of FR-DS-011; `theme.spec.tsx` (T873)
 * covers the module's precedence rules, and `app-root.spec.tsx` proves the
 * control is actually WIRED into the composed application. This file covers
 * the control in isolation: what it offers, what it applies, what it shows.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeControl } from '../../../src/design/ThemeControl';

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset['theme'];
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete document.documentElement.dataset['theme'];
});

describe('T913 · ThemeControl offers the three real choices', () => {
  it('is a labelled native select — built from the inventory, not from scratch', () => {
    render(<ThemeControl />);
    const control = screen.getByLabelText('Theme');
    expect(control.tagName).toBe('SELECT');
    expect(control.className).toContain('ds-select');
  });

  it('offers follow-system, light and dark', () => {
    render(<ThemeControl />);
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(['', 'light', 'dark']);
    expect(options.map((o) => o.textContent)).toEqual(['Follow system', 'Light', 'Dark']);
  });

  it('defaults to follow-system when no override is stored', () => {
    render(<ThemeControl />);
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('');
  });

  it('shows the stored override when one exists', () => {
    window.localStorage.setItem('pmi.theme', 'dark');
    render(<ThemeControl />);
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('dark');
  });
});

describe('T913 · choosing a theme applies and persists it', () => {
  it.each([['light'], ['dark']])('%s applies to the document and persists', (choice) => {
    render(<ThemeControl />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: choice } });
    expect(document.documentElement.dataset['theme']).toBe(choice);
    expect(window.localStorage.getItem('pmi.theme')).toBe(choice);
  });

  it('follow-system clears both the attribute and the stored preference', () => {
    window.localStorage.setItem('pmi.theme', 'dark');
    render(<ThemeControl />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: '' } });
    // No attribute means the media block in themes.css governs — the OS.
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(window.localStorage.getItem('pmi.theme')).toBeNull();
  });
});
