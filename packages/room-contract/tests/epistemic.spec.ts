/**
 * T337h — an unlabelled element is not constructible. `FR-RQR-011`,
 * `UX-0031`, `R-033-4`.
 *
 * `FR-RQR-011` says an unlabelled AI output element **MUST NOT be presentable**.
 * A required discriminant makes it unrepresentable one step earlier — it cannot
 * be built, so it never reaches a renderer that might forget.
 *
 * `UX-0031` explains why that matters more than it looks: an unlabelled
 * recommendation is *"a governance failure expressed as a styling choice"*. A
 * failure introducible by a styling choice should not be prevented only by one.
 *
 * So: four members, no default, no optional variant, and no `unknown` escape
 * hatch. The absence of a fifth member is the point — every element a Room
 * renders is a fact, an inference, a recommendation or an open question, and
 * "we're not sure which" is not a category the reader can act on.
 */
import { describe, expect, it } from 'vitest';
import {
  EPISTEMIC_KINDS,
  isEpistemic,
  labelled,
  type Epistemic,
  type Labelled,
} from '../src/epistemic.js';

describe('FR-RQR-011 · four kinds, and no fifth', () => {
  it('names fact, inference, recommendation and open-question', () => {
    expect(EPISTEMIC_KINDS).toEqual(['fact', 'inference', 'recommendation', 'open-question']);
    expect(EPISTEMIC_KINDS).toHaveLength(4);
  });

  it('is frozen, so a consumer cannot add a fifth at runtime', () => {
    expect(Object.isFrozen(EPISTEMIC_KINDS)).toBe(true);
    expect(() => {
      (EPISTEMIC_KINDS as unknown as string[]).push('unverified');
    }).toThrow();
  });

  it('offers no "unknown" or "unlabelled" spelling', () => {
    // The escape hatch that would make the requirement decorative: a kind
    // meaning "we did not decide" is an unlabelled element with a label on it.
    expect(EPISTEMIC_KINDS).not.toContain('unknown');
    expect(EPISTEMIC_KINDS).not.toContain('unlabelled');
    expect(EPISTEMIC_KINDS).not.toContain('other');
    expect(isEpistemic('unknown')).toBe(false);
    expect(isEpistemic('fact')).toBe(true);
  });
});

describe('R-033-4 · the label is required, with no default', () => {
  it('constructs a labelled value', () => {
    const value = labelled('recommendation', { text: 'consider splitting this requirement' });
    expect(value.epistemic).toBe('recommendation');
    expect(value.value).toEqual({ text: 'consider splitting this requirement' });
  });

  it('rejects a value with no label', () => {
    // @ts-expect-error — FR-RQR-011: an unlabelled element must not be
    // PRESENTABLE, and the cheapest way to guarantee that is to make it
    // unconstructible. If this ever compiles, tsc reports the unused directive.
    const unlabelled: Labelled<string> = { value: 'an AI said something' };
    void unlabelled;
    expect(true).toBe(true);
  });

  it('rejects a label outside the four', () => {
    // @ts-expect-error — a fifth kind must be added to EPISTEMIC_KINDS, where
    // the EPIC-029 token mapping will see it, rather than at a call site where
    // it renders as whatever the fallback style happens to be.
    const wrong: Labelled<string> = { epistemic: 'probably', value: 'x' };
    void wrong;
    expect(true).toBe(true);
  });

  it('does not accept undefined as a label', () => {
    // The optional-variant bypass: `epistemic?: Epistemic` would satisfy every
    // other assertion here and permit exactly the element FR-RQR-011 forbids.
    // @ts-expect-error — required means required.
    const undefinedLabel: Labelled<string> = { epistemic: undefined, value: 'x' };
    void undefinedLabel;
    expect(true).toBe(true);
  });
});

describe('the label travels with the value, not beside it', () => {
  it('carries any value type', () => {
    const one: Labelled<number> = labelled('fact', 42);
    const two: Labelled<{ id: string }> = labelled('inference', { id: 'r_1' });
    expect(one.value).toBe(42);
    expect(two.value).toEqual({ id: 'r_1' });
  });

  it('keeps the discriminant narrowable, so a renderer can switch on it', () => {
    // The EPIC-029 token mapping derives the visual treatment FROM this
    // discriminant (R-033-4), which is what stops the label and the styling
    // disagreeing — they cannot, because one is computed from the other.
    const kinds: Epistemic[] = [...EPISTEMIC_KINDS];
    for (const kind of kinds) {
      const value = labelled(kind, 'x');
      switch (value.epistemic) {
        case 'fact':
        case 'inference':
        case 'recommendation':
        case 'open-question':
          expect(value.epistemic).toBe(kind);
          break;
        default: {
          // Exhaustiveness: if a fifth kind is ever added, this stops compiling.
          const never: never = value.epistemic;
          throw new Error(`unhandled kind ${String(never)}`);
        }
      }
    }
  });
});
