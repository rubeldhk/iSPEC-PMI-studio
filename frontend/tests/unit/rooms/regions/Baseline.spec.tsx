/**
 * `T1191`, `T1192` (EPIC-033 Phase 11) — the baseline control.
 *
 * The assertions that matter are about **what it refuses to offer**. A baseline
 * is immutable once approved (`FR-RQR-051`), so an approve control that appears
 * before its preconditions are met is not a convenience — it is a way to freeze
 * a set nobody checked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Baseline } from '../../../../src/rooms/regions/Baseline';

afterEach(cleanup);

const BLOCKERS = [
  {
    kind: 'evidence-contract',
    subject: 'evidence',
    detail: 'the Evidence Contract has not been evaluated',
  },
];

const props = (over: Partial<React.ComponentProps<typeof Baseline>> = {}) => ({
  blockers: BLOCKERS,
  ready: false as boolean | null,
  onApprove: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('T1191 · while anything is outstanding', () => {
  it('offers NO approve control', () => {
    // The assertion this component exists for.
    render(<Baseline {...props()} />);
    expect(screen.queryByRole('button', { name: /approve baseline/i })).toBeNull();
  });

  it('lists what is outstanding, from the readiness projection', () => {
    // `UX-0032` — visible here, not one screen away, and not re-derived.
    render(<Baseline {...props()} />);
    expect(screen.getByText(/Evidence Contract has not been evaluated/)).toBeDefined();
  });

  it('says WHY it will not offer approval', () => {
    const { container } = render(<Baseline {...props()} />);
    expect(container.textContent).toMatch(/immutable once approved/i);
  });

  it('treats unknown readiness as NOT ready', () => {
    // A readiness call that failed says nothing about whether anything is
    // blocking. "Cannot tell" is never "ready" — `T339g`'s rule.
    render(<Baseline {...props({ ready: null, blockers: [] })} />);
    expect(screen.queryByRole('button', { name: /approve baseline/i })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/not the same as ready/i);
  });
});

describe('T1191 · once nothing is outstanding', () => {
  it('offers approval', () => {
    render(<Baseline {...props({ ready: true, blockers: [] })} />);
    expect(screen.getByRole('button', { name: /approve baseline/i })).toBeDefined();
  });

  it('says what approving does, before it is done', () => {
    // `FR-RQR-051` — immutable, superseded rather than edited. A person should
    // know that before clicking, not after.
    const { container } = render(<Baseline {...props({ ready: true, blockers: [] })} />);
    expect(container.textContent).toMatch(/cannot be edited afterwards/i);
  });

  it('requires a rationale', async () => {
    // `BR-0025`.
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<Baseline {...props({ ready: true, blockers: [], onApprove })} />);
    fireEvent.click(screen.getByRole('button', { name: /approve baseline/i }));
    await waitFor(() => {
      expect(onApprove).not.toHaveBeenCalled();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/rationale is required/i);
  });

  it('sends the rationale', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<Baseline {...props({ ready: true, blockers: [], onApprove })} />);
    fireEvent.change(screen.getByLabelText(/rationale/i), {
      target: { value: 'The set is agreed and measurable.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /approve baseline/i }));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('The set is agreed and measurable.');
    });
  });

  it('SHOWS a refusal rather than swallowing it', async () => {
    // The one a person will actually meet until `EPIC-032` binds its source:
    // `EvidenceSourceUnavailableError`. Swallowing it would make approving look
    // like it silently did nothing.
    const onApprove = vi
      .fn()
      .mockRejectedValue(new Error('the Evidence Contract source is unavailable'));
    render(<Baseline {...props({ ready: true, blockers: [], onApprove })} />);
    fireEvent.change(screen.getByLabelText(/rationale/i), { target: { value: 'Agreed.' } });
    fireEvent.click(screen.getByRole('button', { name: /approve baseline/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Evidence Contract source/i);
    });
  });
});
