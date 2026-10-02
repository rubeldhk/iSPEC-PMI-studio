/**
 * `T403q` — what is blocking is readable here. `FR-RQR-073`, `UX-0032`.
 *
 * The requirement is not "list the blockers"; it is that a reader learns what
 * is blocking **without opening another screen**. A list of kinds satisfies the
 * first and fails the second: *pending-decision* sends the reader away to find
 * out which decision, about what.
 *
 * So these assert the *subject* and the *detail* are rendered, not merely the
 * kind — and that the ready state says so rather than rendering nothing, since
 * an empty region and a region that has not loaded look identical.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Blockers, type Blocker } from '../../../../src/rooms/regions/Blockers';

afterEach(cleanup);

const OPEN_CLARIFICATION: Blocker = {
  kind: 'open-clarification',
  subject: 'Q-14',
  detail: 'Which currencies must the invoice total support?',
};

const MISSING_CRITERIA: Blocker = {
  kind: 'missing-acceptance-criteria',
  subject: 'REQ-021',
  detail: 'The requirement states an outcome with nothing to measure it by.',
};

describe('T403q · UX-0032 — the blocker is legible where it is shown', () => {
  it('names the subject, so the reader knows WHICH one', () => {
    render(<Blockers readiness={{ ready: false, blockers: [OPEN_CLARIFICATION] }} />);
    expect(screen.getByText('Q-14')).toBeDefined();
  });

  it('renders the detail, not just the kind', () => {
    // The whole of `UX-0032`. Without this the region is a table of contents
    // for a screen the reader now has to go and find.
    render(<Blockers readiness={{ ready: false, blockers: [OPEN_CLARIFICATION] }} />);
    expect(screen.getByText(/which currencies/i)).toBeDefined();
  });

  it('renders every blocker, not the first', () => {
    render(
      <Blockers readiness={{ ready: false, blockers: [OPEN_CLARIFICATION, MISSING_CRITERIA] }} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('REQ-021')).toBeDefined();
  });

  it('gives each kind a readable label rather than showing the slug', () => {
    // `open-clarification` is an identifier. A person reads "Open clarification".
    render(<Blockers readiness={{ ready: false, blockers: [OPEN_CLARIFICATION] }} />);
    expect(screen.getByText(/open clarification/i)).toBeDefined();
    expect(screen.queryByText('open-clarification')).toBeNull();
  });
});

describe('T403q · the three states are distinguishable', () => {
  it('says it is ready, rather than rendering nothing', () => {
    // An empty region and an unloaded one look the same. Saying "ready" is the
    // difference between "nothing is blocking" and "nothing arrived".
    render(<Blockers readiness={{ ready: true, blockers: [] }} />);
    expect(screen.getByText(/ready to baseline/i)).toBeDefined();
  });

  it('says it is still loading, and does not claim readiness', () => {
    render(<Blockers readiness={null} />);
    expect(screen.getByText(/loading/i)).toBeDefined();
    expect(screen.queryByText(/nothing is blocking/i)).toBeNull();
  });

  it('reports a failure as a failure, never as "ready"', () => {
    // The dangerous conflation: a readiness call that failed must not read as
    // an object with nothing blocking it.
    render(<Blockers readiness={null} error="The readiness projection is unavailable." />);
    expect(screen.getByText(/unavailable/i)).toBeDefined();
    expect(screen.queryByText(/nothing is blocking/i)).toBeNull();
  });

  it('a `ready: false` with NO blockers still does not read as ready', () => {
    // Defensive: the backend derives `ready` from the blocker list, but this
    // region must not restate that derivation and get it subtly different.
    //
    // Asserted on "nothing is blocking" rather than "ready to baseline", which
    // is a substring of "Not ready to baseline" — the first version of this
    // test failed against correct output for that reason.
    render(<Blockers readiness={{ ready: false, blockers: [] }} />);
    expect(screen.queryByText(/nothing is blocking/i)).toBeNull();
    expect(screen.getByText(/not ready to baseline/i)).toBeDefined();
  });
});

describe('T403q · announced, not merely displayed', () => {
  it('is a list, so a screen reader can count and traverse it', () => {
    render(
      <Blockers readiness={{ ready: false, blockers: [OPEN_CLARIFICATION, MISSING_CRITERIA] }} />,
    );
    expect(screen.getByRole('list')).toBeDefined();
  });

  it('announces a change of state politely', () => {
    // `aria-live="polite"`: blockers clear while a person is working in the
    // Room, and finding out by chance is not finding out.
    const { container } = render(<Blockers readiness={{ ready: true, blockers: [] }} />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
