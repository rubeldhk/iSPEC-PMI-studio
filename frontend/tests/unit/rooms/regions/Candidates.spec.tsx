/**
 * `T1185`, `T1186` (EPIC-033 Phase 10) — the candidates region.
 *
 * The screen the owner went looking for. Intake extracts candidates; until now
 * nothing showed them, so a Room was six regions of prose over data a person
 * could not see or act on.
 *
 * Two rules this region carries, both from the spec rather than from taste:
 *
 * - **`FR-RQR-011` / `UX-0031`** — every element is epistemically labelled and
 *   AI output is *visually distinguishable* from recorded fact. A candidate is
 *   a **candidate**, not a requirement, and the screen must say so.
 * - **`FR-RQR-030`** — a candidate intended for implementation needs measurable
 *   acceptance criteria before baseline, and the region is where they are
 *   entered.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Candidates } from '../../../../src/rooms/regions/Candidates';
import type { RoomCandidate } from '../../../../src/services/api';

afterEach(cleanup);

const CANDIDATE: RoomCandidate = {
  id: 'c1',
  roomObjectId: 'ro_1',
  sourceRef: 'kickoff-notes',
  normalizedText: 'Approvers shall be notified within one business day.',
  epistemic: 'fact',
  promotedTo: null,
  acceptanceCriteria: null,
  intendedForImplementation: true,
};

const props = (over: Partial<React.ComponentProps<typeof Candidates>> = {}) => ({
  candidates: [CANDIDATE],
  onSetCriteria: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('T1185 · the candidates a Room holds', () => {
  it('shows each candidate’s text', () => {
    render(<Candidates {...props()} />);
    expect(screen.getByText(/Approvers shall be notified/)).toBeDefined();
  });

  it('labels every candidate epistemically', () => {
    // `FR-RQR-011` — exactly one label, always present. An unlabelled element is
    // not presentable, so the region must not be able to render one silently.
    render(<Candidates {...props()} />);
    expect(screen.getByText(/fact/i)).toBeDefined();
  });

  it('calls them CANDIDATES, not requirements', () => {
    // The distinction `US1` scenario 1 turns on: extracted intent is presented
    // as a candidate rather than as a fact about the register.
    const { container } = render(<Candidates {...props()} />);
    expect(container.textContent).toMatch(/candidate/i);
  });

  it('says which intake it came from', () => {
    render(<Candidates {...props()} />);
    expect(screen.getByText(/kickoff-notes/)).toBeDefined();
  });

  it('renders an empty state that does not read as an error', () => {
    render(<Candidates {...props({ candidates: [] })} />);
    expect(screen.getByText(/no candidates yet/i)).toBeDefined();
  });
});

describe('T1185 · acceptance criteria', () => {
  it('shows that a candidate without criteria is blocking', () => {
    // `FR-RQR-030`, `UX-0032` — what is blocking must be visible without
    // opening another screen.
    render(<Candidates {...props()} />);
    expect(screen.getByText(/needs acceptance criteria/i)).toBeDefined();
  });

  it('accepts a criterion and sends it', async () => {
    const onSetCriteria = vi.fn().mockResolvedValue(undefined);
    render(<Candidates {...props({ onSetCriteria })} />);

    fireEvent.change(screen.getByLabelText(/acceptance criterion/i), {
      target: { value: 'Delivered within 24 hours.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add criterion/i }));

    await waitFor(() => {
      expect(onSetCriteria).toHaveBeenCalledWith('c1', ['Delivered within 24 hours.'], true);
    });
  });

  it('will not send an empty criterion', async () => {
    const onSetCriteria = vi.fn().mockResolvedValue(undefined);
    render(<Candidates {...props({ onSetCriteria })} />);
    fireEvent.click(screen.getByRole('button', { name: /add criterion/i }));
    expect(onSetCriteria).not.toHaveBeenCalled();
  });

  it('lists existing criteria and stops calling the candidate blocked', () => {
    render(
      <Candidates
        {...props({
          candidates: [{ ...CANDIDATE, acceptanceCriteria: ['Delivered within 24 hours.'] }],
        })}
      />,
    );
    expect(screen.getByText('Delivered within 24 hours.')).toBeDefined();
    expect(screen.queryByText(/needs acceptance criteria/i)).toBeNull();
  });

  it('a candidate NOT intended for implementation is not blocked for criteria', () => {
    // `FR-RQR-030` scopes the rule to requirements intended for implementation.
    // Without this the region would demand criteria for everything, which is a
    // stricter rule than the one anybody wrote.
    render(
      <Candidates
        {...props({
          candidates: [{ ...CANDIDATE, intendedForImplementation: false }],
        })}
      />,
    );
    expect(screen.queryByText(/needs acceptance criteria/i)).toBeNull();
  });
});

describe('T1185 · operable by keyboard', () => {
  it('uses NATIVE controls, so Enter and Space activate them', () => {
    // `SC-RQR-008`. The keyboard half of the Tier 2 criterion comes down to
    // this: a `<div onClick>` is unreachable by keyboard however it is styled,
    // and a real `<button>`/`<input>` needs no handler to be operable.
    render(<Candidates {...props()} />);
    expect(screen.getByLabelText(/acceptance criterion/i).tagName).toBe('INPUT');
    expect(screen.getByRole('button', { name: /add criterion/i }).tagName).toBe('BUTTON');
  });

  it('submits the form, so Enter in the field adds the criterion', async () => {
    // A real `<form>` with a submit button: the browser activates it on Enter
    // without a key handler. `fireEvent.submit` is how that is asserted here.
    const onSetCriteria = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<Candidates {...props({ onSetCriteria })} />);
    fireEvent.change(screen.getByLabelText(/acceptance criterion/i), {
      target: { value: 'Delivered within 24 hours.' },
    });
    const form = container.querySelector('form');
    expect(form, 'the criterion input is not inside a form').not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(onSetCriteria).toHaveBeenCalled();
    });
  });
});
