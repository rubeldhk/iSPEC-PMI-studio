/**
 * `T2117` (EPIC-039) — the adapter interface carries its guarantees in types.
 *
 * `CredentialHandle` has no value property; `toString()` reads `[credential]`
 * and `toJSON()` throws, so a handle placed in a log line or a response body
 * fails loudly instead of leaking (`FR-HUB-043`, `R-039-10`). A descriptor
 * that leaves out who it talks to is refused naming the field (`FR-HUB-024`);
 * an `Embed` descriptor must declare its dimension before any request
 * (`FR-HUB-081`).
 *
 * Written to FAIL before `T2118`.
 */
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DescriptorError, assertDescriptor, createCredentialHandle, type AdapterDescriptor } from '../src/adapter.js';

const SECRET = 'pmi-canary-0b3f2c1e-4d5a-4e6f-9a7b-8c9d0e1f2a3b';

function descriptor(): AdapterDescriptor {
  return {
    key: 'fixture-ci',
    name: 'Fixture CI',
    provider: 'fixture',
    transport: 'native-api',
    version: '0.1.0',
    implements: [{ capability: 'ReadBuildStatus', majors: [1] }],
    credentialKinds: [{ kind: 'fixture-token', narrowing: 'per-request' }],
    credentialRequired: true,
    bindingSchema: { type: 'object', additionalProperties: false, properties: {} },
    scopeMapping: { 'ci.checks': ['fixture:checks'] },
  };
}

describe('T2117 · CredentialHandle', () => {
  it('has no value property and reveals nothing when stringified or inspected', () => {
    const handle = createCredentialHandle(SECRET, 'fixture-token');
    expect(Object.keys(handle)).not.toContain('value');
    expect((handle as unknown as Record<string, unknown>)['value']).toBeUndefined();
    expect(String(handle)).toBe('[credential]');
    expect(`${handle}`).toBe('[credential]');
    expect(inspect(handle, { showHidden: true, depth: 5 })).not.toContain(SECRET);
    expect(handle.kind).toBe('fixture-token');
  });

  it('throws on toJSON, so it cannot reach a response body or a log line', () => {
    const handle = createCredentialHandle(SECRET, 'fixture-token');
    expect(() => JSON.stringify({ handle })).toThrow(/credential/i);
  });

  it('releases the plaintext only inside use(fn)', async () => {
    const handle = createCredentialHandle(SECRET, 'fixture-token');
    const seen = await handle.use(async (plaintext) => plaintext.length);
    expect(seen).toBe(SECRET.length);
  });
});

describe('T2117 · AdapterDescriptor (FR-HUB-024, FR-HUB-081)', () => {
  it('accepts a complete descriptor', () => {
    expect(() => assertDescriptor(descriptor())).not.toThrow();
  });

  it.each(['provider', 'transport', 'version', 'implements'] as const)('refuses one without %s, naming the field', (field) => {
    const d = descriptor() as unknown as Record<string, unknown>;
    delete d[field];
    expect(() => assertDescriptor(d as unknown as AdapterDescriptor)).toThrow(DescriptorError);
    expect(() => assertDescriptor(d as unknown as AdapterDescriptor)).toThrow(field);
  });

  it('refuses an empty implements list and an unknown capability', () => {
    expect(() => assertDescriptor({ ...descriptor(), implements: [] })).toThrow('implements');
    expect(() => assertDescriptor({ ...descriptor(), implements: [{ capability: 'ReadSecrets' as never, majors: [1] }] })).toThrow('ReadSecrets');
  });

  it('refuses an Embed descriptor that does not declare a dimension per model', () => {
    const embed: AdapterDescriptor = {
      ...descriptor(),
      key: 'fixture-embed',
      implements: [{ capability: 'Embed', majors: [1] }],
      scopeMapping: { 'model.embed': ['fixture:embed'] },
    };
    expect(() => assertDescriptor(embed)).toThrow('embedding.models');
    expect(() => assertDescriptor({ ...embed, embedding: { models: [{ model: 'fixture-letters', dimension: 0 }] } })).toThrow('dimension');
    expect(() => assertDescriptor({ ...embed, embedding: { models: [{ model: 'fixture-letters', dimension: 27 }] } })).not.toThrow();
  });

  it('refuses a scope mapping that does not cover the resources each implemented capability requires', () => {
    expect(() => assertDescriptor({ ...descriptor(), scopeMapping: {} })).toThrow('scopeMapping');
  });
});
