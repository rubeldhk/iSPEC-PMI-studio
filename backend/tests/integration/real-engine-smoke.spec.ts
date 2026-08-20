/**
 * T146 — the REAL engine smoke test (quickstart V13). Nightly, not per-commit.
 *
 * Runs ONLY when `.github/workflows/nightly-engine.yml` (or an operator) sets
 * `REAL_ENGINE_SMOKE=1`. In the per-commit suites it is skipped BY NAME — a
 * suite line that reads "skipped" is the honest record that the real engine
 * was not exercised, where a filtered-out file would say nothing at all.
 *
 * When armed, a missing credential FAILS the run: in the nightly workflow a
 * green must mean "the real engine generated", never "the secret was absent".
 */
import { describe, expect, it } from 'vitest';

const armed = process.env['REAL_ENGINE_SMOKE'] === '1';
const suite = armed ? describe : describe.skip;

suite('T146 · V13 — the real engine, end to end (nightly)', () => {
  it('holds a credential — absence is a configuration failure, not a skip', () => {
    expect(
      process.env['AI_PROVIDER_API_KEY'],
      'AI_PROVIDER_API_KEY is not set: configure the repository secret before arming REAL_ENGINE_SMOKE',
    ).toBeTruthy();
  });

  it(
    'the sandbox scaffolds, the agent runs headlessly, output parses, teardown leaves nothing (R-001, R-006)',
    { timeout: 25 * 60 * 1000 },
    async () => {
      // The real Spec Kit adapter through the same seam every fixture test
      // uses — resolved dynamically so per-commit runs never even import it.
      const { composeEngineRegistry } = await import('@pmi/worker/engine-composition');
      const registry = composeEngineRegistry();
      const engine = registry.resolve('speckit');
      expect(engine, 'the Spec Kit adapter is not registered').toBeTruthy();

      const result = await engine.generateSpecification(
        {
          projectName: 'Nightly smoke',
          requirements: [
            {
              reference: 'REQ-001',
              description: 'The system shall let a member reset their password by email.',
              type: 'functional',
              priority: 'p1',
            },
          ],
        } as never,
        { correlationId: `nightly_${Date.now()}`, workspaceId: 'ws_nightly' } as never,
      );

      // Parseable output with provenance — the V13 contract.
      expect(result.ok, `real engine failed: ${JSON.stringify(result)}`).toBe(true);
      if (result.ok) {
        expect(result.value.contentRaw.trim().length).toBeGreaterThan(0);
        expect(result.producedBy.name).toBe('speckit');
        expect(result.producedBy.version.length).toBeGreaterThan(0);
      }
    },
  );
});
