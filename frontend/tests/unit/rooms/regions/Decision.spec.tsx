/**
 * `T1189`, `T1190` (EPIC-033 Phase 11) — the decision surface.
 *
 * `US4` is the story most easily built into a lie. A decision screen that shows
 * one path and an Approve button is *a conclusion wearing a decision's clothes* —
 * the spec's own words — so the rules here are structural rather than cosmetic:
 *
 * - **`FR-RQR-020`** two or more options, or it is not a decision;
 * - **`FR-RQR-021`** each carries trade-offs, dependencies, risks and reasoning;
 * - **`FR-RQR-022`** each is marked a recommendation, and **none is
 *   pre-selected** — a default choice is the rubber stamp `BR-0023` forbids;
 * - **`FR-RQR-023`** what is recorded includes the options **not** chosen.
 *
 * `RULE-03` sits under all of it: AI recommends, humans and policy govern. The
 * region never decides; it collects what a person decided.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Decision } from '../../../../src/rooms/regions/Decision';

afterEach(cleanup);

const props = (over: Partial<React.ComponentProps<typeof Decision>> = {}) => ({
  decisions: [],
  onDecide: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const fill = (index: number, values: Record<string, string>): void => {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(new RegExp(`option ${index} ${label}`, 'i')), {
      target: { value },
    });
  }
};

const twoOptions = (): void => {
  fill(1, {
    summary: 'Notify by email',
    'trade-offs': 'Simple; may be missed',
    dependencies: 'Mail service',
    risks: 'Deliverability',
    reasoning: 'Everyone already has email',
  });
  fill(2, {
    summary: 'Notify in-app',
    'trade-offs': 'Reliable; needs a session',
    dependencies: 'Session store',
    risks: 'Missed when logged out',
    reasoning: 'Keeps the record in one place',
  });
};

describe('T1189 · two or more options, none pre-selected', () => {
  it('offers two option forms before anything is entered', () => {
    // `FR-RQR-020`. One option form would make a single-option decision the
    // easy path, and the easy path is what gets used.
    render(<Decision {...props()} />);
    expect(screen.getByLabelText(/option 1 summary/i)).toBeDefined();
    expect(screen.getByLabelText(/option 2 summary/i)).toBeDefined();
  });

  it('asks each option for trade-offs, dependencies, risks and reasoning', () => {
    // `FR-RQR-021` — all four, for every option.
    render(<Decision {...props()} />);
    for (const field of ['trade-offs', 'dependencies', 'risks', 'reasoning']) {
      expect(screen.getByLabelText(new RegExp(`option 1 ${field}`, 'i'))).toBeDefined();
      expect(screen.getByLabelText(new RegExp(`option 2 ${field}`, 'i'))).toBeDefined();
    }
  });

  it('marks the options as recommendations', () => {
    // `FR-RQR-022` — the screen says these are recommendations, so nobody reads
    // them as a decision already taken.
    const { container } = render(<Decision {...props()} />);
    expect(container.textContent).toMatch(/recommendation/i);
  });

  it('pre-selects NOTHING', () => {
    // The assertion this region exists for. A checked default is a decision the
    // person did not take.
    render(<Decision {...props()} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.length).toBeGreaterThanOrEqual(2);
    expect(radios.some((r) => r.checked), 'an option was pre-selected').toBe(false);
  });

  it('can add a third option', () => {
    render(<Decision {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /add another option/i }));
    expect(screen.getByLabelText(/option 3 summary/i)).toBeDefined();
  });
});

describe('T1189 · what it refuses to send', () => {
  it('will not record without a choice', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<Decision {...props({ onDecide })} />);
    twoOptions();
    fireEvent.change(screen.getByLabelText(/^rationale/i), {
      target: { value: 'In-app keeps the record together.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /record decision/i }));
    await waitFor(() => {
      expect(onDecide).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/choose an option/i)).toBeDefined();
  });

  it('will not record without a rationale', async () => {
    // `BR-0025` — a decision nobody explained cannot be reviewed.
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<Decision {...props({ onDecide })} />);
    twoOptions();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(screen.getByRole('button', { name: /record decision/i }));
    await waitFor(() => {
      expect(onDecide).not.toHaveBeenCalled();
    });
    // The ALERT, not the field label — `/rationale/i` matches both, and a
    // matcher that cannot tell them apart would pass without the refusal.
    expect(screen.getByRole('alert').textContent).toMatch(/rationale is required/i);
  });

  it('will not record an incompletely stated option', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<Decision {...props({ onDecide })} />);
    fill(1, { summary: 'Only a summary' });
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.change(screen.getByLabelText(/^rationale/i), { target: { value: 'Because.' } });
    fireEvent.click(screen.getByRole('button', { name: /record decision/i }));
    await waitFor(() => {
      expect(onDecide).not.toHaveBeenCalled();
    });
  });
});

describe('T1189 · what it records', () => {
  it('sends every option, the chosen id, and the rationale', async () => {
    // `FR-RQR-023` — the options NOT chosen travel with the decision. The
    // service derives `declinedOptions` from the difference, so sending only
    // the winner would silently lose them.
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<Decision {...props({ onDecide })} />);
    twoOptions();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.change(screen.getByLabelText(/^rationale/i), {
      target: { value: 'In-app keeps the record together.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /record decision/i }));

    await waitFor(() => {
      expect(onDecide).toHaveBeenCalled();
    });
    const [options, chosenId, rationale] = onDecide.mock.calls[0]!;
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      summary: 'Notify by email',
      tradeOffs: ['Simple; may be missed'],
      dependencies: ['Mail service'],
      risks: ['Deliverability'],
      reasoning: 'Everyone already has email',
    });
    expect(chosenId).toBe(options[1].id);
    expect(rationale).toBe('In-app keeps the record together.');
  });

  it('shows a recorded decision with what was NOT chosen', () => {
    render(
      <Decision
        {...props({
          decisions: [
            {
              id: 'd1',
              roomObjectId: 'ro_1',
              decidedBy: 'u_1',
              chosenOption: 'opt-2',
              declinedOptions: ['opt-1'],
              rationale: 'In-app keeps the record together.',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/opt-2/)).toBeDefined();
    // The half a decision log usually drops.
    expect(screen.getByText(/opt-1/)).toBeDefined();
    expect(screen.getByText(/In-app keeps the record together\./)).toBeDefined();
  });

  it('SHOWS a refusal rather than clearing the form', async () => {
    // The one a person meets today: `EPIC-031`'s PolicyProvider seam is unbound,
    // so `decide` refuses. Without this the form would empty and look as though
    // the decision had been recorded.
    const onDecide = vi.fn().mockRejectedValue(new Error('the PolicyProvider seam is unbound'));
    render(<Decision {...props({ onDecide })} />);
    twoOptions();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.change(screen.getByLabelText(/^rationale/i), { target: { value: 'Because.' } });
    fireEvent.click(screen.getByRole('button', { name: /record decision/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/PolicyProvider seam is unbound/i);
    });
    // The options survive, so the person does not retype ten fields.
    expect((screen.getByLabelText(/option 1 summary/i) as HTMLInputElement).value).toBe(
      'Notify by email',
    );
  });
});
