/**
 * T338o — every AI output element carries exactly one epistemic label.
 * `FR-RQR-011`, `SC-RQR-002`, `UX-0031`, `R-033-4`. Quickstart Scenario 3.
 *
 * *"An unlabelled element MUST NOT be presentable."*
 *
 * **The type is the guarantee; this file tests the backstop.** `Labelled<T>`
 * declares a required `epistemic` with no default and no optional variant, so
 * nothing in this repository *constructs* an unlabelled element — that is a
 * compile error, and `packages/room-contract/tests/epistemic.spec.ts` (`T337h`)
 * owns it. Model output is the one place values enter from outside the type
 * system, and `parseElements` is the only door. This file guards that door.
 *
 * **Rejected, never defaulted, never silently dropped.** Three behaviours, and
 * the reasoning for each is different:
 *
 *   - *defaulting* an unlabelled element to a kind invents an epistemic claim
 *     the model never made. `UX-0031` calls an unlabelled recommendation *"a
 *     governance failure expressed as a styling choice"*; a default is that
 *     failure one layer lower, where no styling is involved at all;
 *   - *dropping* it quietly is the same harm with the evidence removed — the
 *     reader sees a shorter analysis and no reason to doubt it;
 *   - so each refusal comes back with its index and its reason, and the caller
 *     can show that something was refused.
 *
 * **The mutation proof Scenario 3 requires is the last block.** Make `epistemic`
 * optional and the suite must fail. Expressed here as: a fifth kind, an absent
 * kind and an empty kind must all be refused — the three shapes "optional"
 * would let through.
 */
import { describe, expect, it } from 'vitest';
import { EPISTEMIC_KINDS } from '@pmi/room-contract';
import { parseElements } from '../../src/modules/requirement-room/analysis.service.js';

function stdout(elements: unknown): string {
  return JSON.stringify({ elements });
}

describe('T338o · a labelled element survives, with its label', () => {
  it('accepts all four kinds and no others', () => {
    const parsed = parseElements(
      stdout(EPISTEMIC_KINDS.map((kind) => ({ epistemic: kind, text: `an element that is ${kind}` }))),
    );

    expect(parsed?.elements.map((e) => e.epistemic)).toEqual([...EPISTEMIC_KINDS]);
    expect(parsed?.rejected).toEqual([]);
  });

  it('carries the text through, trimmed', () => {
    const parsed = parseElements(
      stdout([{ epistemic: 'inference', text: '  the two intents overlap  ' }]),
    );

    expect(parsed?.elements[0]?.value).toBe('the two intents overlap');
  });

  it('produces exactly one label per element — the shape has room for one', () => {
    const parsed = parseElements(stdout([{ epistemic: 'fact', text: 'stated by the stakeholder' }]));
    const element = parsed?.elements[0];

    expect(Object.keys(element ?? {}).sort()).toEqual(['epistemic', 'value']);
  });
});

describe('T338o · an unlabelled element is refused, not defaulted', () => {
  it('refuses an element with no epistemic member at all', () => {
    const parsed = parseElements(stdout([{ text: 'a recommendation wearing no label' }]));

    expect(parsed?.elements).toEqual([]);
    expect(parsed?.rejected).toEqual([{ index: 0, reason: 'no epistemic label' }]);
  });

  it('refuses a kind that is not one of the four, naming what it was', () => {
    const parsed = parseElements(stdout([{ epistemic: 'unknown', text: 'we did not decide' }]));

    // A fifth kind meaning "we did not decide" is an unlabelled element wearing
    // a label, and it renders as whatever the fallback style happens to be.
    expect(parsed?.elements).toEqual([]);
    expect(parsed?.rejected[0]?.reason).toMatch(/"unknown" is not one of the four/);
  });

  it('refuses an empty label rather than treating it as absent-and-defaultable', () => {
    const parsed = parseElements(stdout([{ epistemic: '', text: 'something' }]));

    expect(parsed?.elements).toEqual([]);
    expect(parsed?.rejected).toHaveLength(1);
  });

  it('refuses a labelled element that carries no text', () => {
    const parsed = parseElements(stdout([{ epistemic: 'fact', text: '   ' }]));

    expect(parsed?.elements).toEqual([]);
    expect(parsed?.rejected[0]?.reason).toMatch(/carries no text/);
  });

  it('keeps the good elements and refuses only the bad ones, by index', () => {
    const parsed = parseElements(
      stdout([
        { epistemic: 'fact', text: 'kept' },
        { text: 'refused' },
        { epistemic: 'recommendation', text: 'kept too' },
      ]),
    );

    // One bad element must not cost the reader the whole analysis — and must
    // not vanish from it either.
    expect(parsed?.elements.map((e) => e.value)).toEqual(['kept', 'kept too']);
    expect(parsed?.rejected.map((r) => r.index)).toEqual([1]);
  });
});

describe('T338o · unusable output is not a partial success', () => {
  it('returns null for output that is not JSON', () => {
    expect(parseElements('I analysed the requirements and found three issues.')).toBeNull();
  });

  it('returns null when there is no elements array', () => {
    expect(parseElements(JSON.stringify({ findings: [] }))).toBeNull();
  });

  it('returns an empty analysis, not null, for an empty elements array', () => {
    // Distinct outcomes: "the model said nothing" is a real answer; "the model
    // said something I cannot read" is a degraded one. Collapsing them would
    // hide a broken provider behind a quiet, plausible result.
    const parsed = parseElements(stdout([]));

    expect(parsed).not.toBeNull();
    expect(parsed?.elements).toEqual([]);
  });
});

describe('T338o · the mutation proof — SC-RQR-002', () => {
  it('refuses every shape an optional epistemic would admit', () => {
    // Quickstart Scenario 3: "Make `epistemic` optional and this must fail."
    // Optional would admit exactly these three, and each must come back
    // refused. If any of them ever produces an element, the label has stopped
    // being required somewhere between the type and this door.
    const shapes = [
      { text: 'absent' },
      { epistemic: undefined, text: 'undefined' },
      { epistemic: null, text: 'null' },
    ];
    const parsed = parseElements(stdout(shapes));

    expect(parsed?.elements).toEqual([]);
    expect(parsed?.rejected).toHaveLength(shapes.length);
  });

  it('presents nothing it refused — the two lists never overlap', () => {
    const parsed = parseElements(
      stdout([{ epistemic: 'not-a-kind', text: 'must not be presentable' }]),
    );

    const presentable = JSON.stringify(parsed?.elements);
    expect(presentable).not.toContain('must not be presentable');
  });
});
