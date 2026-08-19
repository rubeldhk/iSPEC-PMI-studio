/**
 * T668 · `DEF-028-005` — the runner has an entry point, and it only fires when run.
 *
 * `T576a` tests `runV6` against a stub it supplies itself. That is correct and
 * it passes — and it is exactly why nobody noticed that **nothing called
 * `runV6`**. `node scripts/v6-real-run.mjs` exited 0 having done nothing, for
 * the whole period `T576` was reported as built. A test that provides the
 * dependencies can never observe that no caller provides them.
 *
 * Two things are asserted here, and the second matters as much as the first:
 * the guard recognises direct invocation, and it does **not** fire on import —
 * because `T576a` imports this module, and a guard that misfired would start a
 * container during `pnpm test:unit`.
 */
import { describe, expect, it } from 'vitest';
import { isDirectInvocation, V6_INPUT, V6_STEPS } from '../v6-real-run.mjs';

const BACKSLASH = String.fromCharCode(92);

describe('T668 · direct-invocation guard (DEF-028-005)', () => {
  it('fires when the file is the process entry point on POSIX', () => {
    expect(isDirectInvocation('/repo/scripts/v6-real-run.mjs', 'file:///repo/scripts/v6-real-run.mjs')).toBe(
      true,
    );
  });

  it('fires on Windows, where argv[1] and import.meta.url disagree in form', () => {
    // argv[1] is `C:\repo\scripts\v6-real-run.mjs`; import.meta.url is
    // `file:///C:/repo/scripts/v6-real-run.mjs`. A naive === comparison is
    // false on every Windows machine, which would make the entry point exist
    // and never run — the same defect in a new costume.
    const argv1 = ['C:', 'repo', 'scripts', 'v6-real-run.mjs'].join(BACKSLASH);
    expect(isDirectInvocation(argv1, 'file:///C:/repo/scripts/v6-real-run.mjs')).toBe(true);
  });

  it('handles a url-encoded path, which this repository actually has', () => {
    // The checkout lives under "PMI studio" — import.meta.url encodes the space
    // as %20 and argv[1] does not.
    const argv1 = ['C:', 'PMI studio', 'scripts', 'v6-real-run.mjs'].join(BACKSLASH);
    expect(isDirectInvocation(argv1, 'file:///C:/PMI%20studio/scripts/v6-real-run.mjs')).toBe(true);
  });

  it('does NOT fire when another module is the entry point', () => {
    // The assertion that keeps `pnpm test:unit` from starting a container.
    expect(isDirectInvocation('/repo/scripts/other.mjs', 'file:///repo/scripts/v6-real-run.mjs')).toBe(
      false,
    );
    expect(isDirectInvocation('/repo/node_modules/vitest/dist/cli.js', 'file:///repo/scripts/v6-real-run.mjs')).toBe(
      false,
    );
  });

  it('does NOT fire with no entry point at all', () => {
    expect(isDirectInvocation(undefined, 'file:///repo/scripts/v6-real-run.mjs')).toBe(false);
    expect(isDirectInvocation('', 'file:///repo/scripts/v6-real-run.mjs')).toBe(false);
    expect(isDirectInvocation('/repo/scripts/v6-real-run.mjs', '')).toBe(false);
  });
});

describe('T668 · the input the entry point composes', () => {
  it('is a valid non-empty selection, since an empty one is refused before a container starts', () => {
    // E7: the engine refuses an empty selection before the daemon is touched.
    // A runner that composed one would report engine failure and never test
    // the container at all.
    expect(V6_INPUT.requirements.length).toBeGreaterThan(0);
    expect(V6_INPUT.projectName).toBeTruthy();
  });

  it('uses requirement values the contract accepts', () => {
    for (const requirement of V6_INPUT.requirements) {
      expect(['business', 'functional', 'non_functional', 'constraint']).toContain(requirement.type);
      expect(['p1', 'p2', 'p3']).toContain(requirement.priority);
      expect(requirement.reference).toBeTruthy();
      expect(requirement.description).toBeTruthy();
    }
  });

  it('carries no credential — the token reaches the sandbox by composition, never by literal', () => {
    // PC-3 and ADR-0002. A runner that inlined a token would put one in git.
    const text = JSON.stringify(V6_INPUT);
    expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/AI_PROVIDER_TOKEN\s*[:=]\s*["'][^"']+/);
  });

  it('still declares the six V6 steps', () => {
    expect(V6_STEPS).toHaveLength(6);
  });
});

describe('T672 · the transcript reports only what happened (DEF-028-010)', () => {
  it('does not claim the engine ran when generation never started', async () => {
    // The transcript is the SOLE evidence for SC-AGT-001. Its original fixed
    // wording — "the engine ran inside it, and what came back" — would have
    // said so on the first real run, where the engine refused before starting.
    const { provenBy } = await import('../v6-real-run.mjs');
    const text = provenBy([
      '[PASS] start_container',
      '[FAIL] generate_specification — Refusing to start a sandbox without an AI provider credential.',
    ]).join('\n');
    expect(text).toContain('does **not** prove a specification was generated');
    expect(text).toContain('SC-AGT-001` is **NOT** satisfied');
    expect(text).not.toContain('the engine ran **inside that container**');
  });

  it('does claim it when generation succeeded', async () => {
    const { provenBy } = await import('../v6-real-run.mjs');
    const text = provenBy([
      '[PASS] start_container',
      '[PASS] record_image_digest — sha256:abc',
      '[PASS] generate_specification',
    ]).join('\n');
    expect(text).toContain('the engine ran **inside that container**');
    expect(text).not.toContain('NOT** satisfied');
  });

  it('does not claim a container started when it did not', async () => {
    const { provenBy } = await import('../v6-real-run.mjs');
    const text = provenBy(['[FAIL] start_container — network missing']).join('\n');
    expect(text).toContain('does **not** prove a container started');
  });
});
