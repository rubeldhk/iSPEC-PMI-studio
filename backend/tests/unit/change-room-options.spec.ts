/**
 * `T996r`, `T996s` (EPIC-034) — two or more options, six dimensions each.
 *
 * `FR-CHR-040`, `FR-CHR-041`, `FR-CHR-042`. `BR-0045`'s point, stated in the
 * phase goal: *presenting a change on schedule alone is how security becomes a
 * discovery.*
 *
 * ## The one that is easy to get wrong
 *
 * `FR-CHR-040` says two or more, and `EPIC-028`'s gateway **degrades** when
 * absent rather than refusing. Those two pull in opposite directions, and the
 * tempting resolution is to make up a second option so the requirement is met.
 * It is not met — it is faked, and the fake is a decision presenting itself as
 * a choice, which is precisely `BR-0023`'s objection.
 *
 * So a degraded run returns **`null` options with a stated reason**, never one
 * option and never a synthesised pair. `ChangeOptions` is a minimum-length
 * tuple, so there is nowhere to put a single option even deliberately, and the
 * decision that would have consumed them refuses for want of a choice rather
 * than proceeding on a manufactured one.
 *
 * The vocabulary is read from `FR-CHR-041`'s own sentence rather than restated
 * here — `DEF-034-001`, where a constant and the test that checked it were
 * written from one misreading and agreed with each other.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AgentDescriptor, AgentGateway } from '@pmi/agent-contract';
import type { ExecutionSession } from '@pmi/execution-contract';
import {
  OptionsService,
  type ChangeOptionsBinding,
} from '../../src/modules/change-room/options.service.js';
import {
  TRADEOFF_DIMENSIONS,
  type TradeOffDimension,
} from '../../src/modules/change-room/option.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = readFileSync(
  resolve(here, '..', '..', '..', 'specs', '034-change-room', 'spec.md'),
  'utf8',
);
const FR_CHR_041 = SPEC.split('\n').find((line) => line.includes('**FR-CHR-041**')) ?? '';
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'options.service.ts'),
  'utf8',
);
/**
 * Comments stripped before any structural check.
 *
 * The header explains *why* there is no materiality threshold, and a matcher
 * looking for the word finds that explanation — the same false positive the
 * urgency check hit in Phase 3. These assertions are about what the code does,
 * so prose is not part of the subject.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const descriptor = {
  provider: 'test-provider',
  model: 'test-model',
  capabilities: ['analyze'],
} as unknown as AgentDescriptor;

const session = { id: 'sess_1' } as unknown as ExecutionSession;

/** An agent that answers with whatever stdout the test hands it. */
function gatewayReturning(stdout: string): AgentGateway {
  return {
    descriptor,
    getCapabilities: () => descriptor,
    healthCheck: async () => ({ ok: true, value: { healthy: true } }) as never,
    execute: async () =>
      ({
        ok: true,
        value: { exitCode: 0, stdout, stderr: '' },
        producedBy: { provider: 'test-provider', model: 'test-model' },
      }) as never,
  } as AgentGateway;
}

function gatewayFailing(): AgentGateway {
  return {
    descriptor,
    getCapabilities: () => descriptor,
    healthCheck: async () => ({ ok: true, value: { healthy: true } }) as never,
    execute: async () =>
      ({
        ok: false,
        failure: { reason: 'timeout', message: 'the provider did not answer in time' },
      }) as never,
  } as AgentGateway;
}

const binding = (gateway: AgentGateway): ChangeOptionsBinding => ({ gateway, session });

const sixOf = (detail: string): Record<TradeOffDimension, { stated: boolean; detail: string }> => {
  const out = {} as Record<TradeOffDimension, { stated: boolean; detail: string }>;
  for (const d of TRADEOFF_DIMENSIONS) out[d] = { stated: true, detail: `${detail} — ${d}` };
  return out;
};

const option = (id: string, over: Record<string, unknown> = {}) => ({
  optionId: id,
  summary: `Option ${id}`,
  reasoning: `Because of ${id}.`,
  tradeOffs: sixOf(id),
  ...over,
});

const stdoutOf = (options: unknown[]): string => JSON.stringify({ options });

const request = {
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  correlationId: 'corr_1',
};

describe('T996r · the six dimensions come from FR-CHR-041', () => {
  it('finds the requirement in spec.md', () => {
    expect(FR_CHR_041).toContain('trade-off');
    expect(FR_CHR_041.length).toBeGreaterThan(80);
  });

  it('names every dimension the code declares', () => {
    for (const dimension of TRADEOFF_DIMENSIONS) {
      expect(
        FR_CHR_041.toLowerCase().includes(dimension),
        `FR-CHR-041 does not mention "${dimension}"`,
      ).toBe(true);
    }
  });

  it('and there are six', () => {
    expect(TRADEOFF_DIMENSIONS).toHaveLength(6);
  });

  it('the check can fail', () => {
    // Anti-tautology, per `DEF-034-001`.
    expect('each option must state its schedule and cost'.includes('compatibility')).toBe(false);
  });
});

describe('T996r · two or more, every time', () => {
  it('presents both when the provider offers two', async () => {
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      option('a'),
      option('b'),
    ])))).generate(request);

    expect(result.available).toBe(true);
    expect(result.options).toHaveLength(2);
  });

  it('presents all of them when the provider offers three', async () => {
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      option('a'),
      option('b'),
      option('c'),
    ])))).generate(request);
    expect(result.options).toHaveLength(3);
  });

  it('refuses to present one — options become null, with a reason', async () => {
    // The whole point. One option is a conclusion wearing a decision's clothes
    // (`BR-0023`), and padding it to two would be worse.
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([option('a')])))).generate(
      request,
    );

    expect(result.available).toBe(false);
    expect(result.options).toBeNull();
    expect(result.degradedKind).toBe('too-few-options');
    expect(result.degradedReason).toMatch(/two or more/i);
  });

  it('and never invents one to make up the number', async () => {
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([option('a')])))).generate(
      request,
    );
    // Not an empty array either: `[]` reads as "we looked and there are no
    // options", which nobody established.
    expect(result.options).toBeNull();
  });
});

describe('T996r · all six dimensions, or explicitly not applicable', () => {
  it('carries every dimension it was given', async () => {
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      option('a'),
      option('b'),
    ])))).generate(request);

    for (const dimension of TRADEOFF_DIMENSIONS) {
      expect(result.options?.[0]?.tradeOffs[dimension].stated).toBe(true);
    }
  });

  it('accepts `not applicable` when it carries a detail', async () => {
    // `stated: false` is a position somebody took, and a position needs words.
    const partial = option('a');
    partial.tradeOffs.security = { stated: false, detail: 'no data is touched by this change' };
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      partial,
      option('b'),
    ])))).generate(request);

    expect(result.options?.[0]?.tradeOffs.security.stated).toBe(false);
    expect(result.options?.[0]?.tradeOffs.security.detail).toContain('no data');
  });

  it('rejects an option missing a dimension, visibly', async () => {
    // `T338p` — never silently dropped. A discarded option is a fact about what
    // the provider produced.
    const missing = option('a') as { tradeOffs: Record<string, unknown> };
    delete missing.tradeOffs['delivery'];
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      missing,
      option('b'),
      option('c'),
    ])))).generate(request);

    expect(result.options).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toMatch(/delivery/);
  });

  it('rejects a not-applicable with no detail', async () => {
    // The blank that satisfies the requirement on paper.
    const blank = option('a');
    blank.tradeOffs.cost = { stated: false, detail: '   ' };
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      blank,
      option('b'),
      option('c'),
    ])))).generate(request);

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toMatch(/cost/);
  });

  it('rejecting enough options degrades rather than presenting one', async () => {
    const missing = option('a') as { tradeOffs: Record<string, unknown> };
    delete missing.tradeOffs['quality'];
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      missing,
      option('b'),
    ])))).generate(request);

    expect(result.options).toBeNull();
    expect(result.degradedKind).toBe('too-few-options');
    // And the rejection survives the degradation — otherwise the reason the
    // count fell short would be invisible.
    expect(result.rejected).toHaveLength(1);
  });
});

describe('T996r · recommendations, and none pre-selected', () => {
  it('labels every option a recommendation', async () => {
    // `FR-CHR-042`. Computed here from one line, never read from the provider:
    // a model that labelled its own output `fact` would be believed.
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      { ...option('a'), epistemic: 'fact' },
      option('b'),
    ])))).generate(request);

    expect(result.options?.every((o) => o.epistemic === 'recommendation')).toBe(true);
  });

  it('preserves the order it was given', async () => {
    // A "best first" re-ordering is a pre-selection nobody has to admit to —
    // `EPIC-033`'s wording, and the same rule here.
    const result = await new OptionsService(binding(gatewayReturning(stdoutOf([
      option('a'),
      option('b'),
      option('c'),
    ])))).generate(request);
    expect(result.options?.map((o) => o.optionId)).toEqual(['a', 'b', 'c']);
  });

  it('has nowhere to record a selection', () => {
    // Structural. A boolean somewhere would default to true for whichever
    // option the model liked, and the human decision would become a
    // confirmation — `RULE-03` inverted at the point it matters most.
    for (const word of ['selected', 'recommended', 'preferred', 'isDefault', 'chosen']) {
      expect(
        new RegExp(`\\breadonly\\s+${word}\\b`).test(SOURCE),
        `options.service.ts declares a ${word} field`,
      ).toBe(false);
    }
  });

  it('the selection check can fire', () => {
    expect(/\breadonly\s+selected\b/.test('  readonly selected: boolean;')).toBe(true);
  });
});

describe('T996r · no materiality threshold exists', () => {
  it('generate takes no materiality input', async () => {
    // `FR-CHR-040` as resolved 2026-08-23 (analysis finding `A1`): every Change
    // Request in this Room is a material change, because `FR-CHR-011` makes
    // this the only path by which an approved baseline changes. A threshold
    // would be a second answer to a question already settled — and the way to
    // guarantee nobody adds one is for the code never to see the field.
    expect(/\bmaterial/i.test(CODE), 'options.service.ts branches on materiality').toBe(false);
    expect(/threshold/i.test(CODE)).toBe(false);
    // Guard on the stripping itself: if the regexes stopped removing anything,
    // the two assertions above would pass for the wrong reason.
    expect(CODE.length).toBeLessThan(SOURCE.length);
  });

  it('the materiality check can fire', () => {
    expect(/\bmaterial/i.test('  if (input.material) return null;')).toBe(true);
  });
});

describe('T996r · degrades rather than refusing', () => {
  it('an unbound gateway yields no options and names EPIC-028', async () => {
    // `EPIC-033` established this posture: an absent analysis provider is a
    // fact a person can weigh, provided they are told.
    const result = await new OptionsService().generate(request);

    expect(result.available).toBe(false);
    expect(result.options).toBeNull();
    expect(result.degradedKind).toBe('gateway-unbound');
    expect(result.degradedReason).toContain('EPIC-028');
    expect(result.record).toBeNull();
  });

  it('a failed invocation degrades, with a record', async () => {
    // `BR-0104` — attributable. The invocation happened, so it is recorded.
    const result = await new OptionsService(binding(gatewayFailing())).generate(request);

    expect(result.degradedKind).toBe('invocation-failed');
    expect(result.record?.status).toBe('failed');
    expect(result.record?.provider).toBe('test-provider');
    expect(result.record?.correlationId).toBe('corr_1');
  });

  it('unreadable output degrades, and the record still says succeeded', async () => {
    // Marking it failed would blame the provider for this Room's parser.
    const result = await new OptionsService(binding(gatewayReturning('not json at all'))).generate(
      request,
    );

    expect(result.degradedKind).toBe('output-unreadable');
    expect(result.record?.status).toBe('succeeded');
  });

  it('never throws when the provider is absent', async () => {
    // Refusing would make an unavailable model block every change, including
    // the ones a model outage has nothing to do with.
    await expect(new OptionsService().generate(request)).resolves.toBeTruthy();
  });
});
