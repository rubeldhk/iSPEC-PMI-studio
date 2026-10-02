/**
 * `T406h`, `T406i` (EPIC-034) — a change decision has two or more options, and
 * each carries all six dimensions.
 *
 * `FR-CHR-040` and `FR-CHR-041`. Both are guarantees that decay quietly if they
 * live in a validator: a single-option decision is a conclusion asking to be
 * rubber-stamped, and a trade-off list that omits a dimension is how security
 * and compatibility become *discoveries* rather than inputs.
 *
 * So `ChangeOptions` is a **minimum-length tuple** — one option does not
 * compile — and `tradeOffs` is a `Record` over all six, each stated or
 * explicitly `not-applicable`. `not-applicable` is a stated position; an absent
 * key is not.
 */
import { describe, expect, it } from 'vitest';
import {
  TRADEOFF_DIMENSIONS,
  type ChangeOption,
  type ChangeOptions,
} from '../../src/modules/change-room/option.types.js';

const tradeOffs = (): ChangeOption['tradeOffs'] => ({
  schedule: { stated: true, detail: 'two days' },
  cost: { stated: true, detail: 'none beyond the time' },
  quality: { stated: true, detail: 'unchanged' },
  security: { stated: true, detail: 'no new surface' },
  compatibility: { stated: true, detail: 'no consumer changes' },
  delivery: { stated: false, detail: 'not applicable — nothing ships separately' },
});

const option = (id: string): ChangeOption => ({
  optionId: id,
  summary: `Option ${id}`,
  reasoning: 'because it is reversible',
  tradeOffs: tradeOffs(),
  epistemic: 'recommendation',
});

describe('T406h · the six dimensions of FR-CHR-041', () => {
  it('names exactly six', () => {
    expect(TRADEOFF_DIMENSIONS).toHaveLength(6);
  });

  it('names them, security among them', () => {
    expect([...TRADEOFF_DIMENSIONS]).toEqual([
      'schedule',
      'cost',
      'quality',
      'security',
      'compatibility',
      'delivery',
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TRADEOFF_DIMENSIONS)).toBe(true);
  });

  it('rejects an option that omits a dimension', () => {
    const five = {
      schedule: { stated: true, detail: 'x' },
      cost: { stated: true, detail: 'x' },
      quality: { stated: true, detail: 'x' },
      compatibility: { stated: true, detail: 'x' },
      delivery: { stated: true, detail: 'x' },
    };
    const broken: ChangeOption = {
      optionId: 'a',
      summary: 'Missing security',
      reasoning: 'x',
      // @ts-expect-error — five dimensions is not a trade-off set. Security is
      // the one most often dropped, which is exactly why the type refuses a
      // partial rather than a validator catching it later.
      tradeOffs: five,
      epistemic: 'recommendation',
    };
    void broken;
    expect(Object.keys(five)).toHaveLength(5);
  });

  it('`not-applicable` is a STATED position, not an absent one', () => {
    // `FR-CHR-041` — "each stated or explicitly not-applicable". The difference
    // is whether somebody considered it.
    const notApplicable = tradeOffs().delivery;
    expect(notApplicable.stated).toBe(false);
    expect(notApplicable.detail).toMatch(/not applicable/i);
    // It is still present, which is the point.
    expect(Object.keys(tradeOffs())).toHaveLength(6);
  });
});

describe('T406h · two or more options', () => {
  it('accepts two', () => {
    const options: ChangeOptions = [option('a'), option('b')];
    expect(options).toHaveLength(2);
  });

  it('accepts more than two', () => {
    const options: ChangeOptions = [option('a'), option('b'), option('c')];
    expect(options).toHaveLength(3);
  });

  it('rejects ONE — a single option is a decision already taken', () => {
    // `FR-CHR-040`, and `BR-0023`'s objection: one path presented for approval
    // is a conclusion wearing a decision's clothes.
    // @ts-expect-error — a one-element array is not `ChangeOptions`.
    const only: ChangeOptions = [option('a')];
    void only;
    expect(true).toBe(true);
  });

  it('rejects NONE', () => {
    // @ts-expect-error — empty is not `ChangeOptions` either.
    const none: ChangeOptions = [];
    void none;
    expect(true).toBe(true);
  });
});

describe('T406h · an option is a recommendation, never a fact', () => {
  it('types `epistemic` as recommendation', () => {
    // `FR-CHR-042` — none pre-selected, and every option labelled from
    // `packages/room-contract`'s vocabulary. An option labelled `fact` would be
    // a decision presenting itself as a finding.
    expect(option('a').epistemic).toBe('recommendation');
  });

  it('rejects an option labelled `fact`', () => {
    const wrong: ChangeOption = {
      ...option('a'),
      // @ts-expect-error — only `recommendation` is permitted here.
      epistemic: 'fact',
    };
    void wrong;
    expect(true).toBe(true);
  });
});
