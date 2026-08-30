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

const APPROVED = {
  id: 'b1',
  version: 1,
  approvedBy: 'u_1',
  approvedAt: '2026-08-30T05:43:22.101Z',
  rationale: 'The set is agreed and measurable.',
  setHash: '544204d14f232f1beeae26a97f6bae35a7293a3d7d4510b8041043e566cd2abc',
  memberVersionIds: ['rv_1'],
  supersededBy: null as number | null,
};

const props = (over: Partial<React.ComponentProps<typeof Baseline>> = {}) => ({
  blockers: BLOCKERS,
  ready: false as boolean | null,
  baselines: [],
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
      // `T1212` widened the signature: `(rationale, supersedes?)`. Nothing is
      // declared here, and `undefined` is what "declare nothing" looks like on
      // the wire.
      expect(onApprove).toHaveBeenCalledWith('The set is agreed and measurable.', undefined);
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

describe('T1211 · once a baseline has been approved', () => {
  it('SHOWS it — the defect T1208 records', () => {
    // A person approved a baseline and the screen still said "Nothing is
    // outstanding" with the approve control still offered. Readiness is
    // unchanged by approval, so nothing on the page moved.
    render(<Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />);
    expect(screen.getByText(/version 1/i)).toBeDefined();
    expect(screen.getByText(/The set is agreed and measurable\./)).toBeDefined();
  });

  it('names the approver and when', () => {
    // `S1` acceptance scenario 2 — approver, rationale, timestamp and version.
    // The screen shows what the record carries.
    const { container } = render(
      <Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />,
    );
    expect(container.textContent).toMatch(/u_1/);
    expect(container.textContent).toMatch(/2026-08-30/);
  });

  it('shows the set hash, so a reader can check the set did not move', () => {
    render(<Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />);
    expect(screen.getByText(/544204d1/)).toBeDefined();
  });

  it('says it is immutable rather than offering to change it', () => {
    // `FR-RQR-051` — superseded, never edited. The screen must not imply an edit
    // is available.
    const { container } = render(
      <Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />,
    );
    expect(container.textContent).toMatch(/cannot be edited|immutable|superseded/i);
  });

  it('marks a superseded baseline and names what replaced it', () => {
    // `FR-RQR-052` — it stays readable and identifies its successor.
    render(
      <Baseline
        {...props({
          ready: true,
          blockers: [],
          baselines: [{ ...APPROVED, supersededBy: 2 }],
        })}
      />,
    );
    expect(screen.getByText(/superseded by version 2/i)).toBeDefined();
  });

  it('still offers approval — a new baseline supersedes rather than edits', () => {
    // Deliberate: `RULE-02` routes a change through a NEW baseline, so the
    // control stays. What changes is that the person can now see what exists.
    render(<Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />);
    expect(screen.getByRole('button', { name: /approve baseline/i })).toBeDefined();
  });

  it('shows nothing of the kind when none has been approved', () => {
    // Anti-vacuity: without this, a region that always rendered the block would
    // pass every assertion above.
    render(<Baseline {...props({ ready: true, blockers: [], baselines: [] })} />);
    expect(screen.queryByText(/version 1/i)).toBeNull();
  });
});

describe('T1212 · more than one current baseline', () => {
  const TWO = [
    APPROVED,
    { ...APPROVED, id: 'b2', version: 2, rationale: 'A second set, agreed separately.' },
  ];

  it('says plainly that more than one set is governing', () => {
    // The state a person met and could not read: two baselines both labelled
    // "current", with nothing saying that was a real situation rather than a
    // display bug.
    render(<Baseline {...props({ ready: true, blockers: [], baselines: TWO })} />);
    expect(screen.getByRole('status').textContent).toMatch(/2 current baselines/i);
  });

  it('does NOT imply one replaced the other', () => {
    // `T338i` — supersession is declared, never inferred. A screen that guessed
    // would contradict the rule the store enforces, and the guess would be
    // recorded nowhere.
    const { container } = render(
      <Baseline {...props({ ready: true, blockers: [], baselines: TWO })} />,
    );
    expect(container.textContent).toMatch(/declared, not inferred|neither supersedes/i);
    expect(screen.queryByText(/superseded by version/i)).toBeNull();
  });

  it('offers the way to declare it, so the message is not a dead end', () => {
    render(<Baseline {...props({ ready: true, blockers: [], baselines: TWO })} />);
    expect(screen.getByLabelText(/supersedes version/i)).toBeDefined();
  });

  it('sends the declared version with the approval', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<Baseline {...props({ ready: true, blockers: [], baselines: TWO, onApprove })} />);
    fireEvent.change(screen.getByLabelText(/rationale/i), { target: { value: 'Consolidating.' } });
    fireEvent.change(screen.getByLabelText(/supersedes version/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /approve baseline/i }));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('Consolidating.', 2);
    });
  });

  it('sends no version when none is chosen', async () => {
    // The default must stay "declare nothing" — an accidental supersession is
    // exactly what `T338i` refuses to infer.
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<Baseline {...props({ ready: true, blockers: [], baselines: TWO, onApprove })} />);
    fireEvent.change(screen.getByLabelText(/rationale/i), { target: { value: 'A third set.' } });
    fireEvent.click(screen.getByRole('button', { name: /approve baseline/i }));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('A third set.', undefined);
    });
  });

  it('says nothing of the kind when only ONE is current', () => {
    // Anti-vacuity, and the ordinary case: one current baseline is not a
    // situation anybody needs warning about.
    render(<Baseline {...props({ ready: true, blockers: [], baselines: [APPROVED] })} />);
    expect(screen.queryByText(/2 current baselines/i)).toBeNull();
    expect(screen.queryByLabelText(/supersedes version/i)).toBeNull();
  });

  it('counts only the un-superseded ones', () => {
    render(
      <Baseline
        {...props({
          ready: true,
          blockers: [],
          baselines: [{ ...APPROVED, supersededBy: 2 }, { ...APPROVED, id: 'b2', version: 2 }],
        })}
      />,
    );
    expect(screen.queryByText(/2 current baselines/i)).toBeNull();
  });
});
