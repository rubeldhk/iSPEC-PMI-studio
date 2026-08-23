/**
 * T339m — a material decision comes with real options. `FR-RQR-020`,
 * `FR-RQR-021`, `FR-RQR-022`, `SC-RQR-005`, `BR-0023`. Quickstart Scenario 5.
 *
 * *"Two or more feasible options, each with trade-offs, dependencies, risks and
 * the reasoning behind it; each marked a recommendation; none pre-selected."*
 *
 * **"None pre-selected" is a shape, not a check.** `PresentedOption` has no
 * `selected`, `recommended`, `default` or `preferred` member, so there is no
 * code path that builds a set with one already chosen. A boolean somewhere
 * would eventually default to true for the option the model liked, and the
 * human decision would become a confirmation — which is `RULE-03` inverted at
 * the exact point it matters most.
 *
 * **"Marked a recommendation" reuses the shared epistemic label.** An option is
 * a `Labelled<PresentedOption>` with `epistemic: 'recommendation'`, computed
 * from one line, never accepted from a caller. A second vocabulary for "this is
 * a suggestion, not a fact" is how the label and the marking would come to
 * disagree — and `UX-0031` maps the label to a visual treatment, so they would
 * disagree on screen.
 *
 * **One option is not a choice.** `FR-RQR-020` says two or more, and the reason
 * is `BR-0023`: a single option presented for approval is a decision already
 * taken, asking to be rubber-stamped.
 *
 * **An option with no trade-offs, no dependencies AND no risks is a title.**
 * Each of the three is required as a list, so *"none"* is a stated answer
 * rather than an unstated one — but all three empty at once means nothing was
 * analysed, and that is refused.
 */
import { describe, expect, it } from 'vitest';
import { EPISTEMIC_KINDS } from '@pmi/room-contract';
import { ValidationFailedError } from '../../src/core/errors.js';
import {
  OptionsService,
  type ProposedOption,
} from '../../src/modules/requirement-room/options.service.js';

function option(over: Partial<ProposedOption> = {}): ProposedOption {
  return {
    id: 'opt_a',
    summary: 'Re-authenticate in place and return the reviewer to the same item.',
    tradeOffs: ['Keeps the reviewer in flow; costs a session-refresh path.'],
    dependencies: ['EPIC-005 sign-in'],
    risks: ['A refresh loop if the token clock skews.'],
    reasoning: 'The reviewer loses no context, which is what the complaint was about.',
    ...over,
  };
}

const TWO: ProposedOption[] = [
  option(),
  option({
    id: 'opt_b',
    summary: 'Send the reviewer to sign-in and back to the review list.',
    tradeOffs: ['Simplest to build; the reviewer loses their place.'],
    dependencies: [],
    risks: ['The complaint recurs for long reviews.'],
    reasoning: 'Cheapest path, and honest about what it does not solve.',
  }),
];

const service = () => new OptionsService();

describe('T339m · two or more options, each fully stated', () => {
  it('presents every option it was given', () => {
    const presented = service().present(TWO);

    expect(presented).toHaveLength(2);
    expect(presented.map((o) => o.value.id)).toEqual(['opt_a', 'opt_b']);
  });

  it('refuses a single option — one option is a decision already taken', () => {
    expect(() => service().present([option()])).toThrow(ValidationFailedError);
    expect(() => service().present([option()])).toThrow(/two or more/i);
  });

  it('refuses an empty set', () => {
    expect(() => service().present([])).toThrow(/two or more/i);
  });

  it('carries trade-offs, dependencies, risks and reasoning through unchanged', () => {
    const [first] = service().present(TWO);

    expect(first?.value.tradeOffs).toEqual(['Keeps the reviewer in flow; costs a session-refresh path.']);
    expect(first?.value.dependencies).toEqual(['EPIC-005 sign-in']);
    expect(first?.value.risks).toEqual(['A refresh loop if the token clock skews.']);
    expect(first?.value.reasoning).toMatch(/loses no context/);
  });

  it('accepts an empty list for one dimension — "none" is a stated answer', () => {
    const presented = service().present(TWO);

    // opt_b states no dependencies. That is different from not saying, and the
    // type has no way to not say.
    expect(presented[1]?.value.dependencies).toEqual([]);
  });

  it('refuses an option with nothing analysed in any of the three', () => {
    const hollow = option({ id: 'opt_c', tradeOffs: [], dependencies: [], risks: [] });

    // All three empty at once is a title, not an option — and a set of titles
    // satisfies "two or more" while giving the decider nothing to weigh.
    expect(() => service().present([...TWO, hollow])).toThrow(/opt_c/);
  });

  it.each(['summary', 'reasoning'] as const)('refuses an option with no %s', (field) => {
    expect(() => service().present([...TWO, option({ id: 'opt_d', [field]: '  ' })])).toThrow(
      new RegExp(field),
    );
  });

  it('refuses two options sharing an id', () => {
    // A decision naming `opt_a` would be ambiguous, and the ambiguity would
    // land in `declinedOptions` where nobody looks again.
    expect(() => service().present([...TWO, option()])).toThrow(/opt_a/);
  });
});

describe('T339m · every option is marked a recommendation', () => {
  it('labels each one `recommendation`', () => {
    const presented = service().present(TWO);

    expect(presented.map((o) => o.epistemic)).toEqual(['recommendation', 'recommendation']);
  });

  it('uses the shared four-kind vocabulary, not a second one', () => {
    const presented = service().present(TWO);

    for (const presentedOption of presented) {
      expect(EPISTEMIC_KINDS).toContain(presentedOption.epistemic);
    }
  });

  it('computes the label rather than reading it from the caller', () => {
    const smuggled = [
      { ...option(), epistemic: 'fact' },
      TWO[1],
    ] as unknown as ProposedOption[];

    // An option arriving labelled `fact` would render as settled rather than
    // suggested — UX-0031's failure, entering through a parameter.
    expect(service().present(smuggled)[0]?.epistemic).toBe('recommendation');
  });
});

describe('T339m · none is pre-selected', () => {
  it('has no member that could mark one as chosen', () => {
    const [first] = service().present(TWO);

    expect(Object.keys(first?.value ?? {}).sort()).toEqual([
      'dependencies',
      'id',
      'reasoning',
      'risks',
      'summary',
      'tradeOffs',
    ]);
  });

  it('drops a selection smuggled past the type rather than honouring it', () => {
    const smuggled = [
      { ...option(), selected: true, recommended: true },
      TWO[1],
    ] as unknown as ProposedOption[];

    const [first] = service().present(smuggled);

    expect(JSON.stringify(first?.value)).not.toMatch(/selected|recommended/);
  });

  it('exposes no ordering that reads as preference', () => {
    const forward = service().present(TWO).map((o) => o.value.id);
    const reversed = service().present([...TWO].reverse()).map((o) => o.value.id);

    // Presented in the order given, and nothing sorts them by a score. A
    // "best first" ordering is a pre-selection nobody has to admit to.
    expect(forward).toEqual(['opt_a', 'opt_b']);
    expect(reversed).toEqual(['opt_b', 'opt_a']);
  });
});
