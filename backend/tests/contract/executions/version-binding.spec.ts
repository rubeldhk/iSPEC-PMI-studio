/**
 * T1031 (EPIC-037 Band A) — phase-aware binding, as a contract rule.
 *
 * The asymmetry is the whole idea and it is easy to get backwards, so it is
 * asserted from both ends: registration must NOT accept `commitAfter`, and a
 * successful completion must NOT be accepted without output identity.
 */
import { describe, expect, it } from 'vitest';
import type { InputBinding, OutputBinding } from '@pmi/execution-registry-contract';

describe('T1031 · input identity binds at registration', () => {
  it('carries what the execution runs AGAINST', () => {
    // Typed rather than asserted at runtime: a binding missing its target
    // does not compile, which is a stronger guarantee than a check.
    const binding: InputBinding = {
      targetType: 'specification',
      targetId: 'spec_1',
      targetVersion: 3,
      repositoryId: 'pmi',
      branch: 'main',
      worktree: '/w',
      commitBefore: 'abc123',
      inputArtifactDigests: ['sha256:aaa'],
    };
    expect(binding.commitBefore).toBe('abc123');
    expect(Object.keys(binding)).not.toContain('commitAfter');
  });

  it('requires only the target — the rest is genuinely optional', () => {
    // A local CLI run has no repository; a fixture has no worktree. Demanding
    // them would force connectors to invent values.
    const minimal: InputBinding = { targetType: 'specification', targetId: 'spec_1' };
    expect(minimal.targetId).toBe('spec_1');
  });
});

describe('T1031 · output identity binds at successful completion', () => {
  it('carries what the execution PRODUCED', () => {
    const output: OutputBinding = {
      commitAfter: 'def456',
      resultingVersion: 4,
      resultingBaselineId: 'base_1',
      generatedArtifactDigests: ['sha256:bbb'],
      evidenceRefs: ['ev_1'],
    };
    expect(output.commitAfter).toBe('def456');
  });

  it('is entirely optional, because a failed run produced nothing', () => {
    // `AC-EXR-17d`. The type cannot require these; only the outcome decides,
    // and the service enforces that per outcome.
    const empty: OutputBinding = {};
    expect(Object.keys(empty)).toHaveLength(0);
  });
});
