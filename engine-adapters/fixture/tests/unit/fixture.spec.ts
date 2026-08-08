/**
 * T036 — fixture adapter: deterministic output and failure injection.
 *
 * Fixture-specific behaviour only. Contract rules E1–E10 are asserted once, for
 * every adapter, by the shared conformance suite (T038/T039) — duplicating them
 * here would mean two places to update when the contract changes.
 *
 * This file was marked complete on 2026-08-05 and did not exist.
 */
import { describe, it, expect, vi } from 'vitest';
import { PHASE_1_CAPABILITIES, type EngineContext } from '@pmi/engine-contract';
import { FixtureEngine, FIXTURE_INPUT_CEILING } from '../../src/index';

function ctx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    correlationId: 'test-correlation-id',
    ...overrides,
  };
}

const requirements = [
  { reference: 'FR-001', description: 'Users can sign in', type: 'functional', priority: 'p1' },
  { reference: 'NFR-002', description: 'Responds promptly', type: 'non_functional', priority: 'p2' },
] as const;

const input = { projectName: 'Acme', requirements: [...requirements] };

describe('determinism — the property the whole test strategy rests on', () => {
  it('produces byte-identical output for identical input', async () => {
    const engine = new FixtureEngine();
    const first = await engine.generateSpecification(input, ctx());
    const second = await engine.generateSpecification(input, ctx());
    expect(first).toEqual(second);
  });

  it('produces different output for different input', async () => {
    const engine = new FixtureEngine();
    const a = await engine.generateSpecification(input, ctx());
    const b = await engine.generateSpecification({ ...input, projectName: 'Other' }, ctx());
    expect(a).not.toEqual(b);
  });

  it('reflects every supplied requirement in the raw output', async () => {
    const result = await new FixtureEngine().generateSpecification(input, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const requirement of requirements) {
        expect(result.value.contentRaw).toContain(requirement.reference);
        expect(result.value.contentRaw).toContain(requirement.description);
      }
      expect(result.value.contentParsed['requirementRefs']).toEqual(['FR-001', 'NFR-002']);
    }
  });

  it('declares a version identifying both tool and model (E10)', () => {
    const { version } = new FixtureEngine().descriptor;
    expect(version).toContain('model=');
  });

  it('declares all three Phase 1 capabilities', () => {
    expect(new FixtureEngine().descriptor.capabilities).toEqual([...PHASE_1_CAPABILITIES]);
  });
});

describe('failure injection — one reason at a time', () => {
  const injectable = [
    'engine_unavailable',
    'engine_error',
    'malformed_output',
    'empty_output',
  ] as const;

  it.each(injectable)('injects %s on generateSpecification', async (reason) => {
    const result = await new FixtureEngine({ failWith: reason }).generateSpecification(input, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe(reason);
  });

  it.each(injectable)('injects %s on generateTasks', async (reason) => {
    const engine = new FixtureEngine({ failWith: reason });
    const result = await engine.generateTasks(
      { projectName: 'Acme', specificationTitle: 'S', specificationContent: 'body' },
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe(reason);
  });

  it.each(injectable)('injects %s on validateSpecification', async (reason) => {
    const engine = new FixtureEngine({ failWith: reason });
    const result = await engine.validateSpecification(
      { specificationTitle: 'S', specificationContent: 'body' },
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe(reason);
  });

  it('never returns a value alongside a failure (E3)', async () => {
    const result = await new FixtureEngine({ failWith: 'engine_error' }).generateSpecification(
      input,
      ctx(),
    );
    expect('value' in result).toBe(false);
  });
});

describe('input boundaries — refused before work starts (E7)', () => {
  it('refuses an empty selection', async () => {
    const result = await new FixtureEngine().generateSpecification(
      { projectName: 'Acme', requirements: [] },
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('empty_selection');
  });

  it(`refuses a selection above the ceiling of ${FIXTURE_INPUT_CEILING}`, async () => {
    const oversized = Array.from({ length: FIXTURE_INPUT_CEILING + 1 }, (_, i) => ({
      reference: `FR-${i}`,
      description: 'x',
      type: 'functional' as const,
      priority: 'p1' as const,
    }));
    const result = await new FixtureEngine().generateSpecification(
      { projectName: 'Acme', requirements: oversized },
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('input_too_large');
      // The message must be actionable: it states the limit that was exceeded.
      expect(result.failure.message).toContain(String(FIXTURE_INPUT_CEILING));
    }
  });

  it('accepts a selection exactly at the ceiling', async () => {
    const atLimit = Array.from({ length: FIXTURE_INPUT_CEILING }, (_, i) => ({
      reference: `FR-${i}`,
      description: 'x',
      type: 'functional' as const,
      priority: 'p1' as const,
    }));
    const result = await new FixtureEngine().generateSpecification(
      { projectName: 'Acme', requirements: atLimit },
      ctx(),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects oversized input WITHOUT waiting for simulated work', async () => {
    // The ordering is the requirement, not just the reason: E7 says "before
    // starting", which is what stops a user being billed for a doomed run.
    const engine = new FixtureEngine({ delayMs: 10_000 });
    const oversized = Array.from({ length: FIXTURE_INPUT_CEILING + 1 }, (_, i) => ({
      reference: `FR-${i}`,
      description: 'x',
      type: 'functional' as const,
      priority: 'p1' as const,
    }));
    const started = Date.now();
    const result = await engine.generateSpecification(
      { projectName: 'Acme', requirements: oversized },
      ctx({ timeoutMs: 10_000 }),
    );
    expect(Date.now() - started).toBeLessThan(1_000);
    if (!result.ok) expect(result.failure.reason).toBe('input_too_large');
  });
});

describe('cancellation and timeout (E4, E5)', () => {
  it('reports cancellation when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await new FixtureEngine().generateSpecification(
      input,
      ctx({ signal: controller.signal }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('cancelled');
  });

  it('reports cancellation when aborted mid-run', async () => {
    const controller = new AbortController();
    const engine = new FixtureEngine({ delayMs: 5_000 });
    const pending = engine.generateSpecification(input, ctx({ signal: controller.signal }));
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('cancelled');
  });

  it('self-terminates on timeout rather than relying on the caller', async () => {
    const engine = new FixtureEngine({ delayMs: 5_000 });
    const result = await engine.generateSpecification(input, ctx({ timeoutMs: 20 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('timeout');
  });

  it('does NOT report a timeout as a cancellation', async () => {
    // The distinction a shared AbortController destroys: both paths abort, but
    // only one is the user's doing. Reported as `cancelled`, a systemic timeout
    // looks like ordinary user behaviour in every metric.
    const engine = new FixtureEngine({ delayMs: 5_000 });
    const result = await engine.generateSpecification(input, ctx({ timeoutMs: 20 }));
    if (!result.ok) expect(result.failure.reason).not.toBe('cancelled');
  });

  it('completes normally when the simulated work finishes inside the limit', async () => {
    const engine = new FixtureEngine({ delayMs: 5 });
    const result = await engine.generateSpecification(input, ctx({ timeoutMs: 5_000 }));
    expect(result.ok).toBe(true);
  });
});

describe('validation findings (FR-023)', () => {
  it('gives every finding a location', async () => {
    const result = await new FixtureEngine().validateSpecification(
      { specificationTitle: 'S', specificationContent: '   ' },
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(0);
      for (const finding of result.value) {
        expect(finding.location.trim()).not.toBe('');
      }
    }
  });

  it('returns no findings for a specification with content', async () => {
    const result = await new FixtureEngine().validateSpecification(
      { specificationTitle: 'S', specificationContent: '# Real content' },
      ctx(),
    );
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('progress reporting (FR-028)', () => {
  it('never blocks the caller when onProgress throws', async () => {
    const onProgress = vi.fn(() => {
      throw new Error('subscriber exploded');
    });
    const result = await new FixtureEngine().generateSpecification(input, ctx({ onProgress }));
    // Whether the fixture emits progress is its own business; what matters is
    // that a misbehaving subscriber cannot fail the run.
    expect(result.ok).toBe(true);
  });
});
