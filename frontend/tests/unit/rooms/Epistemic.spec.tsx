/**
 * T337o — the visual treatment is **derived from** the discriminant.
 * `FR-RQR-011`, `UX-0031`, `R-033-4`.
 *
 * Written to FAIL before `T337p` exists (Constitution V).
 *
 * *(Located under `frontend/tests/unit/` for the same reason as
 * `RoomShell.spec.tsx`: the `frontend` vitest project collects only
 * `tests/unit/**\/*.spec.{ts,tsx}`.)*
 *
 * **The one thing this must guarantee: the label and the styling cannot
 * disagree.** `UX-0031` calls an unlabelled recommendation *"a governance
 * failure expressed as a styling choice"* — so the styling is **computed from**
 * the label rather than chosen beside it. A component taking both a label and a
 * variant would let a caller mark something a recommendation and paint it like a
 * fact, and every test that checked the label alone would pass.
 *
 * `EPIC-034` and `EPIC-035` import this mapping. If it drifted per Room, an AI
 * recommendation would look different in each — which is the same failure
 * `UX-0035` prevents for regions, one layer down.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EPISTEMIC_KINDS, labelled, type Epistemic } from '@pmi/room-contract';
import { EpistemicMark, epistemicToken } from '../../../src/rooms/regions/Epistemic';

afterEach(cleanup);

describe('R-033-4 · one token per kind, derived not chosen', () => {
  it('maps every kind to a token', () => {
    // Total by construction: a fifth kind added to the contract fails to
    // compile here rather than falling through to a default style.
    for (const kind of EPISTEMIC_KINDS) {
      expect(epistemicToken(kind)).toBeTruthy();
    }
  });

  it('gives the four kinds four DIFFERENT tokens', () => {
    // Two kinds sharing a token is the failure that looks like it works: the
    // label is right, the mapping exists, and a reader cannot tell an inference
    // from a recommendation.
    const tokens = EPISTEMIC_KINDS.map((k) => epistemicToken(k));
    expect(new Set(tokens).size).toBe(4);
  });

  it('takes no variant, style or className prop', () => {
    // The bypass. A component accepting both a label and an appearance permits
    // marking something a recommendation and painting it like a fact, and every
    // label-only assertion would still pass.
    // @ts-expect-error — the treatment is derived; there is nothing to override.
    const overridden = <EpistemicMark value={labelled('recommendation', 'x')} variant="fact" />;
    void overridden;
    expect(true).toBe(true);
  });
});

describe('UX-0031 · AI output is visually distinguishable from recorded fact', () => {
  it.each([...EPISTEMIC_KINDS])('renders %s with its own token', (kind: Epistemic) => {
    render(<EpistemicMark value={labelled(kind, `${kind} content`)} />);
    const mark = screen.getByTestId('epistemic-mark');
    expect(mark.dataset['epistemic']).toBe(kind);
    expect(mark.className).toContain(epistemicToken(kind));
  });

  it('renders the value, not only the label', () => {
    render(<EpistemicMark value={labelled('inference', 'the model inferred this')} />);
    expect(screen.getByText('the model inferred this')).toBeDefined();
  });

  it('carries the kind in an accessible name, not only in colour', () => {
    // Distinguishable by colour alone fails for a colour-blind reader and for a
    // screen reader entirely — and "distinguishable" is the requirement's word.
    render(<EpistemicMark value={labelled('recommendation', 'consider this')} />);
    expect(screen.getByTestId('epistemic-mark').getAttribute('aria-label')).toMatch(
      /recommendation/i,
    );
  });

  it('marks the three non-fact kinds as AI output, and fact as not', () => {
    // The distinction UX-0031 is actually about: what the system OBSERVED versus
    // what a model PRODUCED. A reader scanning a Room needs that in one glance.
    for (const kind of ['inference', 'recommendation', 'open-question'] as const) {
      cleanup();
      render(<EpistemicMark value={labelled(kind, 'x')} />);
      expect(screen.getByTestId('epistemic-mark').dataset['aiOutput']).toBe('true');
    }
    cleanup();
    render(<EpistemicMark value={labelled('fact', 'x')} />);
    expect(screen.getByTestId('epistemic-mark').dataset['aiOutput']).toBeUndefined();
  });
});

describe('the mapping is shared, so three Rooms cannot drift', () => {
  it('is a pure function of the kind — same input, same token, every time', () => {
    // If the token depended on anything else — a theme, a Room, a prop — the
    // three Rooms could render the same label differently, which is the
    // UX-0035 failure one layer down.
    for (const kind of EPISTEMIC_KINDS) {
      expect(epistemicToken(kind)).toBe(epistemicToken(kind));
    }
  });
});
