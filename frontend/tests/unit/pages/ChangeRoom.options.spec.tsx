/**
 * `T996v`, `T996w` (EPIC-034) — the options region.
 *
 * `FR-CHR-042`, `FR-CHR-082`, `UX-0031`. Options are **recommendations**, and
 * `UX-0031` calls an unlabelled recommendation *"a governance failure expressed
 * as a styling choice"*. A screen showing six trade-off dimensions in a tidy
 * table, with nothing saying a model produced them, is that failure — and it is
 * the more convincing for being tidy.
 *
 * Three things are checked that a screenshot would not catch:
 *
 * **The marking comes from the shared component.** `EPIC-033`'s `EpistemicMark`
 * derives the treatment from the label and offers no override. A local mapping
 * here would let this Room render an AI recommendation differently from the
 * Requirement Room, which is `UX-0035`'s failure one layer down.
 *
 * **Nothing is pre-selected.** No highlight, no default, no "recommended" badge
 * on one of them. `RULE-03` inverted looks exactly like a helpful default.
 *
 * **A degraded result shows its reason and no options.** Not an empty table —
 * an empty table reads as "no options exist", which is a different claim from
 * "nobody could produce any".
 *
 * The test path is `frontend/tests/unit/` deliberately: the `frontend` vitest
 * project collects `tests/unit/**\/*.spec.{ts,tsx}` and nothing else, so a test
 * written beside the source would never run — and a test that never runs is
 * worse than no test, because it reads as coverage.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  ChangeOptionsRegion,
  type ChangeOptionView,
  type ChangeOptionsView,
} from '../../../src/rooms/regions/ChangeOptions';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', '..', 'src', 'rooms', 'regions', 'ChangeOptions.tsx'),
  'utf8',
);
/**
 * Comments stripped before the structural checks.
 *
 * The header explains why nothing is *pre-selected*, and a matcher looking for
 * `selected` finds that explanation. The same false positive the backend's
 * urgency and materiality checks hit — prose is not the subject.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const DIMENSIONS = ['schedule', 'cost', 'quality', 'security', 'compatibility', 'delivery'];

const tradeOffs = (over: Record<string, { stated: boolean; detail: string }> = {}) => {
  const out: Record<string, { stated: boolean; detail: string }> = {};
  for (const d of DIMENSIONS) out[d] = { stated: true, detail: `${d} impact stated` };
  return { ...out, ...over };
};

const option = (id: string, over: Record<string, unknown> = {}): ChangeOptionView => ({
  optionId: id,
  summary: `Option ${id} summary`,
  reasoning: `Reasoning for ${id}.`,
  tradeOffs: tradeOffs() as ChangeOptionView['tradeOffs'],
  epistemic: 'recommendation' as const,
  ...over,
});

const available: ChangeOptionsView = {
  available: true,
  options: [option('a'), option('b')],
  degradedReason: null,
  degradedKind: null,
  rejected: [],
};

const degraded: ChangeOptionsView = {
  available: false,
  options: null,
  degradedReason: 'no options provider is bound (EPIC-028 AgentGateway)',
  degradedKind: 'gateway-unbound',
  rejected: [],
};

describe('T996v · options are presented as recommendations', () => {
  it('renders each option', () => {
    render(<ChangeOptionsRegion view={available} />);
    expect(screen.getByText('Option a summary')).toBeTruthy();
    expect(screen.getByText('Option b summary')).toBeTruthy();
  });

  it('marks every one as AI output', () => {
    // `FR-CHR-082`. The attribute comes from the shared `EpistemicMark`, so
    // this asserts the shared component was used and not merely imitated.
    render(<ChangeOptionsRegion view={available} />);
    const marks = screen.getAllByTestId('epistemic-mark');
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark.getAttribute('data-epistemic')).toBe('recommendation');
      expect(mark.getAttribute('data-ai-output')).toBe('true');
    }
  });

  it('and names the label for a screen reader, not by colour alone', () => {
    render(<ChangeOptionsRegion view={available} />);
    expect(screen.getAllByLabelText('AI recommendation')).toHaveLength(2);
  });

  it('imports the shared mapping rather than declaring its own', () => {
    // `UX-0035`. A per-Room token map is how two Rooms come to paint the same
    // label differently.
    expect(SOURCE).toMatch(/from\s+'\.\/Epistemic'/);
    expect(/epistemic--/.test(CODE), 'ChangeOptions.tsx hard-codes an epistemic token').toBe(false);
  });

  it('the token check can fire', () => {
    expect(/epistemic--/.test("const c = 'epistemic--fact';")).toBe(true);
  });
});

describe('T996v · all six dimensions, visibly', () => {
  it('renders every dimension for every option', () => {
    render(<ChangeOptionsRegion view={available} />);
    // By test id, not by text: the detail for `schedule` also contains the word
    // "schedule", so a text matcher finds two nodes and reports an ambiguity
    // that has nothing to do with what is being asserted.
    for (const option_ of screen.getAllByTestId('change-option')) {
      const names = within(option_)
        .getAllByTestId('tradeoff-dimension')
        .map((node) => node.textContent?.trim().toLowerCase());
      for (const dimension of DIMENSIONS) {
        expect(names, `${dimension} is not rendered`).toContain(dimension);
      }
    }
  });

  it('shows a not-applicable dimension rather than hiding it', () => {
    // `stated: false` is a position somebody took. Hiding it turns a stated
    // position into an absence, which is the one reading it must not have.
    const view: ChangeOptionsView = {
      ...available,
      options: [
        option('a', {
          tradeOffs: tradeOffs({
            security: { stated: false, detail: 'no data is touched by this change' },
          }),
        }),
        option('b'),
      ],
    };
    render(<ChangeOptionsRegion view={view} />);
    expect(screen.getByText(/no data is touched/)).toBeTruthy();
    expect(screen.getByText(/not applicable/i)).toBeTruthy();
  });

  it('keeps the dimensions in FR-CHR-041 order', () => {
    // Order is how a reader compares two options at a glance. Alphabetical
    // would scramble the requirement's own sequence for no benefit.
    render(<ChangeOptionsRegion view={available} />);
    const first = screen.getAllByTestId('change-option')[0]!;
    const rendered = within(first)
      .getAllByTestId('tradeoff-dimension')
      .map((node) => node.textContent?.trim().toLowerCase());
    expect(rendered).toEqual(DIMENSIONS);
  });
});

describe('T996v · none is pre-selected', () => {
  it('no option is marked selected, checked or current', () => {
    render(<ChangeOptionsRegion view={available} />);
    for (const card of screen.getAllByTestId('change-option')) {
      expect(card.getAttribute('aria-selected')).toBeNull();
      expect(card.getAttribute('aria-current')).toBeNull();
      expect(card.getAttribute('data-selected')).toBeNull();
    }
  });

  it('and the source has no way to express a preference', () => {
    // Structural. A `recommended` flag would default to true for whichever
    // option arrived first, and the human decision would become a confirmation.
    for (const word of ['selected', 'preferred', 'isRecommended', 'defaultOption']) {
      expect(
        new RegExp(`\\b${word}\\b`).test(CODE),
        `ChangeOptions.tsx mentions ${word}`,
      ).toBe(false);
    }
  });

  it('the preference check can fire', () => {
    expect(/\bselected\b/.test('const selected = options[0];')).toBe(true);
  });
});

describe('T996v · a degraded result says so', () => {
  it('shows the reason', () => {
    render(<ChangeOptionsRegion view={degraded} />);
    expect(screen.getByText(/EPIC-028/)).toBeTruthy();
  });

  it('and renders no options at all', () => {
    // Not an empty table. "No options exist" and "nobody could produce any" are
    // different claims, and only the second one is true here.
    render(<ChangeOptionsRegion view={degraded} />);
    expect(screen.queryAllByTestId('change-option')).toHaveLength(0);
  });

  it('says the requirement is unmet rather than implying it is satisfied', () => {
    render(<ChangeOptionsRegion view={degraded} />);
    expect(screen.getByText(/two or more/i)).toBeTruthy();
  });

  it('surfaces options that were rejected, never dropping them silently', () => {
    const view: ChangeOptionsView = {
      ...degraded,
      degradedKind: 'too-few-options',
      degradedReason: 'FR-CHR-040 requires two or more options and 1 survived validation',
      rejected: [{ index: 1, reason: 'delivery has no detail' }],
    };
    render(<ChangeOptionsRegion view={view} />);
    expect(screen.getByText(/delivery has no detail/)).toBeTruthy();
  });
});
