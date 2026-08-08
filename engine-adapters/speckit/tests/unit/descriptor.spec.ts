/**
 * T091a — the descriptor version changes when EITHER the Spec Kit release or
 * the AI model changes (E10, FR-022).
 *
 * The failure this prevents is quiet: two artifacts recorded against the same
 * engine version that were produced by different models. Nothing looks wrong,
 * and neither is reproducible from its own provenance.
 */
import { describe, it, expect } from 'vitest';
import { PHASE_1_CAPABILITIES } from '@pmi/engine-contract';
import {
  IncompleteProvenanceError,
  SPECKIT_ENGINE_NAME,
  buildEngineDescriptor,
  formatEngineVersion,
  type EngineToolVersions,
} from '../../src/descriptor.js';

const baseline: EngineToolVersions = {
  specifyVersion: '0.0.17',
  agentCliVersion: '1.0.0',
  agentModel: 'claude-opus-5',
};

describe('version composition (E10)', () => {
  it('is stable for identical inputs', () => {
    expect(formatEngineVersion(baseline)).toBe(formatEngineVersion({ ...baseline }));
  });

  it('CHANGES when the Spec Kit release changes', () => {
    expect(formatEngineVersion({ ...baseline, specifyVersion: '0.0.18' })).not.toBe(
      formatEngineVersion(baseline),
    );
  });

  it('CHANGES when the AI model changes', () => {
    // The case that makes this rule exist: same Spec Kit, different model,
    // different output. One version for both would be a false claim.
    expect(formatEngineVersion({ ...baseline, agentModel: 'claude-sonnet-5' })).not.toBe(
      formatEngineVersion(baseline),
    );
  });

  it('CHANGES when the agent CLI changes', () => {
    expect(formatEngineVersion({ ...baseline, agentCliVersion: '1.1.0' })).not.toBe(
      formatEngineVersion(baseline),
    );
  });

  it('produces a distinct version for every distinct combination', () => {
    const combinations: EngineToolVersions[] = [
      baseline,
      { ...baseline, specifyVersion: '0.0.18' },
      { ...baseline, agentCliVersion: '1.1.0' },
      { ...baseline, agentModel: 'claude-sonnet-5' },
      { specifyVersion: '0.0.18', agentCliVersion: '1.1.0', agentModel: 'claude-sonnet-5' },
    ];
    const versions = combinations.map(formatEngineVersion);
    expect(new Set(versions).size).toBe(combinations.length);
  });

  it('names all three inputs readably, so an operator can read provenance directly', () => {
    const version = formatEngineVersion(baseline);
    expect(version).toContain('0.0.17');
    expect(version).toContain('claude-opus-5');
    expect(version).toContain('1.0.0');
    expect(version.startsWith(`${SPECKIT_ENGINE_NAME}-`)).toBe(true);
  });

  it('ignores incidental whitespace', () => {
    expect(formatEngineVersion({ ...baseline, agentModel: '  claude-opus-5  ' })).toBe(
      formatEngineVersion(baseline),
    );
  });
});

describe('descriptor', () => {
  it('declares all three Phase 1 capabilities', () => {
    expect(buildEngineDescriptor(baseline).capabilities).toEqual([...PHASE_1_CAPABILITIES]);
  });

  it('carries the composite version', () => {
    expect(buildEngineDescriptor(baseline).version).toBe(formatEngineVersion(baseline));
  });
});

describe('incomplete provenance is refused, not defaulted', () => {
  it.each([
    ['specifyVersion', { ...baseline, specifyVersion: '' }],
    ['agentCliVersion', { ...baseline, agentCliVersion: '' }],
    ['agentModel', { ...baseline, agentModel: '   ' }],
  ])('refuses to build a descriptor missing %s', (_field, versions) => {
    // A placeholder like "unknown" is worse than a failed run: the run
    // succeeds, the artifact is stored, and the provenance is wrong forever.
    expect(() => buildEngineDescriptor(versions as EngineToolVersions)).toThrow(
      IncompleteProvenanceError,
    );
  });

  it('names every missing element', () => {
    try {
      buildEngineDescriptor({ specifyVersion: '', agentCliVersion: '', agentModel: '' });
      throw new Error('expected IncompleteProvenanceError');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('Spec Kit version');
      expect(message).toContain('agent CLI version');
      expect(message).toContain('agent model');
    }
  });
});
