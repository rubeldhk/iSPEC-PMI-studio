/**
 * `T1913` (EPIC-047) — a gateway says which limits it can stop a run on.
 *
 * `R-047-1`, `ADR-0020`: the descriptor is extended, not replaced. The field is
 * optional, so every existing gateway still type-checks — and absent means
 * *none declared*, which `EPIC-047` reads as unenforceable rather than assumed.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ENFORCEABLE_LIMITS, type AgentDescriptor } from '../../src/index.js';

describe('T1913 · AgentDescriptor.enforceableLimits', () => {
  it('admits exactly time, resource, tokens and cost', () => {
    expect(ENFORCEABLE_LIMITS).toEqual(['time', 'resource', 'tokens', 'cost']);
  });

  it('is optional, so a descriptor written before it still type-checks', () => {
    const legacy: AgentDescriptor = {
      name: 'claude-code',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      executionType: 'headless',
      capabilities: ['execute'],
      contextLimitTokens: 200_000,
      toolCapabilities: [],
      supportsMcp: true,
      repositoryCapabilities: ['read'],
      securityClassification: 'external',
      supportsUnattended: true,
    };
    expect(legacy.enforceableLimits).toBeUndefined();
    expectTypeOf<AgentDescriptor['enforceableLimits']>().toEqualTypeOf<
      readonly ('time' | 'resource' | 'tokens' | 'cost')[] | undefined
    >();
  });
});
