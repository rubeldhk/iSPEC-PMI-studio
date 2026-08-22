/**
 * T888 (EPIC-029) — the feedback family: EmptyState, ErrorState,
 * LoadingIndicator, Toast. An empty state explains WHY it is empty; an error
 * says what to do next without exposing internal detail (FR-DS-021,
 * FR-DS-022). State titles are read by state-coverage.spec.tsx (T886).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from '../../../src/design/components/EmptyState';
import { ErrorState } from '../../../src/design/components/ErrorState';
import { LoadingIndicator } from '../../../src/design/components/LoadingIndicator';
import { Toast } from '../../../src/design/components/Toast';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../../src/design/components/components.css'), 'utf8');

afterEach(cleanup);

describe('EmptyState (T888)', () => {
  it('EmptyState · state: default — explains WHY it is empty and what to do next (FR-DS-021)', () => {
    render(
      <EmptyState
        title="No projects yet"
        explanation="Nothing has been created in this workspace."
        actionLabel="Create the first project"
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('No projects yet')).toBeDefined();
    expect(screen.getByText('Nothing has been created in this workspace.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create the first project' })).toBeDefined();
  });

  it('the action is optional but the why is not — the API requires an explanation', () => {
    render(<EmptyState title="No links" explanation="No requirement has been traced yet." />);
    expect(screen.getByText('No requirement has been traced yet.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ErrorState (T888)', () => {
  it('ErrorState · state: default — what went wrong and what to do, nothing internal (FR-DS-022)', () => {
    const { container } = render(
      <ErrorState message="Projects could not be loaded." action="Check your connection and try again." />,
    );
    expect(screen.getByText('Projects could not be loaded.')).toBeDefined();
    expect(screen.getByText('Check your connection and try again.')).toBeDefined();
    // The API accepts message and action only — the rendered text is exactly
    // those two strings, so a stack trace has no door to walk through.
    expect(container.textContent).toBe(
      'Projects could not be loaded.Check your connection and try again.',
    );
  });
});

describe('LoadingIndicator (T888)', () => {
  it('LoadingIndicator · state: default — a status region that does NOT block interaction', () => {
    render(
      <>
        <LoadingIndicator label="Loading projects" />
        <button type="button">Still clickable</button>
      </>,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Loading projects');
    // MUST NOT block unrelated interaction: no dialog, no aria-modal, and the
    // sibling stays focusable.
    expect(status.closest('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    const sibling = screen.getByRole('button', { name: 'Still clickable' });
    sibling.focus();
    expect(document.activeElement).toBe(sibling);
  });
});

describe('Toast (T888)', () => {
  it('Toast · state: default — announced politely: role=status, never an interrupting alert', () => {
    render(<Toast message="Requirement saved" />);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Requirement saved');
  });

  it('Toast · state: hover — the stylesheet declares the hover treatment', () => {
    expect(css.includes('.ds-toast:hover'), "components.css declares no '.ds-toast:hover'").toBe(
      true,
    );
  });

  it('Toast · state: focus — its dismiss control is keyboard-reachable', () => {
    render(<Toast message="Requirement saved" onDismiss={vi.fn()} />);
    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    dismiss.focus();
    expect(document.activeElement).toBe(dismiss);
  });

  it('Toast · state: error — still polite, and never the sole carrier of an actionable error', () => {
    render(<Toast tone="error" message="Save failed — your changes are still in the editor." />);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Save failed');
    // Polite by contract: role=status (an interrupting alert is the page's
    // job, via ErrorState/FormField, which is what keeps the toast from being
    // the sole carrier).
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dismissal calls back rather than self-vanishing mid-read', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Requirement saved" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
