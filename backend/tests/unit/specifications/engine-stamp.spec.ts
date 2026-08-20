/**
 * T081a — engine provenance stamping (F-04.4, FR-022).
 *
 * Written to FAIL before `engine-stamp.ts` exists (Constitution V).
 *
 * FR-022 is only checkable if a missing stamp is impossible to store. This file
 * asserts the stamp is present on every generated artifact and that a null,
 * blank, or absent engine identity is REFUSED rather than defaulted — a default
 * would attribute an artifact to an engine that never ran it.
 */
import { describe, expect, it } from 'vitest';
import {
  MissingEngineProvenanceError,
  assertStamped,
  stampEngineProvenance,
} from '../../../src/modules/specifications/engine-stamp.js';
import { DESCRIPTOR } from './helpers.js';

const AT = new Date('2026-08-20T10:00:00.000Z');

describe('stampEngineProvenance', () => {
  it('stamps engine name and version from the descriptor', () => {
    const stamp = stampEngineProvenance(DESCRIPTOR, AT);
    expect(stamp).toEqual({
      engineName: 'stub',
      engineVersion: '1.4.0+model-x',
      generatedAt: AT,
    });
  });

  it('carries the version that identifies BOTH tool and model (R-001, E10)', () => {
    // Same tool, different model = a different version, because the output
    // differs. The stamp records whatever the descriptor claims, unaltered.
    const stamp = stampEngineProvenance({ ...DESCRIPTOR, version: '1.4.0+model-y' }, AT);
    expect(stamp.engineVersion).toBe('1.4.0+model-y');
  });

  it('trims surrounding whitespace but never invents a value', () => {
    const stamp = stampEngineProvenance({ ...DESCRIPTOR, name: '  stub  ' }, AT);
    expect(stamp.engineName).toBe('stub');
  });
});

describe('stampEngineProvenance · refuses an unidentifiable engine', () => {
  it.each([
    ['a missing descriptor', undefined, 'engineName'],
    ['a null descriptor', null, 'engineName'],
    ['a missing name', { version: '1.0.0' }, 'engineName'],
    ['a blank name', { name: '   ', version: '1.0.0' }, 'engineName'],
    ['a non-string name', { name: 7, version: '1.0.0' }, 'engineName'],
    ['a missing version', { name: 'stub' }, 'engineVersion'],
    ['a blank version', { name: 'stub', version: '  ' }, 'engineVersion'],
    ['a non-string version', { name: 'stub', version: null }, 'engineVersion'],
  ])('%s throws, naming the field', (_label, descriptor, field) => {
    const thrown = ((): unknown => {
      try {
        stampEngineProvenance(descriptor as never, AT);
        return null;
      } catch (error: unknown) {
        return error;
      }
    })();
    expect(thrown).toBeInstanceOf(MissingEngineProvenanceError);
    expect((thrown as MissingEngineProvenanceError).field).toBe(field);
  });

  it('does not fall back to a placeholder engine name', () => {
    expect(() => stampEngineProvenance({ name: '', version: '' } as never, AT)).toThrow(
      MissingEngineProvenanceError,
    );
  });
});

describe('assertStamped · every generated artifact carries provenance, never null', () => {
  it('passes an artifact with both fields set', () => {
    expect(() =>
      assertStamped({ engineName: 'stub', engineVersion: '1.0.0', generatedAt: AT }),
    ).not.toThrow();
  });

  it.each([
    ['a null engineName', { engineName: null, engineVersion: '1.0.0', generatedAt: AT }, 'engineName'],
    ['a null engineVersion', { engineName: 'stub', engineVersion: null, generatedAt: AT }, 'engineVersion'],
    ['an empty engineName', { engineName: '', engineVersion: '1.0.0', generatedAt: AT }, 'engineName'],
    ['an empty engineVersion', { engineName: 'stub', engineVersion: '', generatedAt: AT }, 'engineVersion'],
    ['a missing generatedAt', { engineName: 'stub', engineVersion: '1.0.0' }, 'generatedAt'],
  ])('refuses %s', (_label, artifact, field) => {
    const thrown = ((): unknown => {
      try {
        assertStamped(artifact as never);
        return null;
      } catch (error: unknown) {
        return error;
      }
    })();
    expect(thrown).toBeInstanceOf(MissingEngineProvenanceError);
    expect((thrown as MissingEngineProvenanceError).field).toBe(field);
  });
});
