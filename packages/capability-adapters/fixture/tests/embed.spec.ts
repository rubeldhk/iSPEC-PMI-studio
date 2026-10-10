/**
 * `T2194` (EPIC-039, `US7`, `FR-HUB-086`) — `fixture-embed` passes the shared
 * conformance suite (`T2123`) including CC-11 and CC-13: dimension 27, model
 * `fixture-letters`, identical vectors for identical text, equal to
 * `EPIC-038`'s `letterVector` for a fixed corpus, and **not** semantic.
 *
 * The expected vectors are COPIED here, not imported: they are the values
 * `letterVector` in `backend/tests/helpers/context-retrieval-fixtures.ts`
 * (EPIC-038, `T1279`) returns for these three texts — 26 letter counts and a
 * constant 1 — computed from that function on 2026-10-10. The package imports
 * nothing from the backend, so a drift on either side fails this test.
 *
 * Written to FAIL before `T2195`.
 */
import { capabilityConformanceSuite } from '@pmi/capability-contract/conformance';
import { createCredentialHandle, type AdapterContext, type CapabilityAdapter } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { FixtureEmbedAdapter } from '../src/index.js';

const SECRET = 'pmi-canary-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** `letterVector(text)` from EPIC-038's `context-retrieval-fixtures.ts`, for a fixed corpus. */
const LETTER_VECTORS: Record<string, number[]> = {
  'Booking confirmation email': [2, 1, 1, 0, 1, 1, 1, 0, 4, 0, 1, 1, 2, 3, 4, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  'Invoice tax rounding': [1, 0, 1, 1, 1, 0, 1, 0, 3, 0, 0, 0, 0, 3, 2, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1],
  'Password reset link': [1, 0, 0, 1, 2, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 2, 3, 1, 0, 0, 1, 0, 0, 0, 1],
};

function context(_a: CapabilityAdapter, binding: Record<string, unknown> = {}): AdapterContext {
  return {
    workspaceId: null,
    projectId: null,
    binding,
    credential: createCredentialHandle(SECRET, 'fixture-token'),
    scope: { requested: { access: 'read', resources: ['model.embed'] }, granted: ['fixture:embed'], narrowing: 'exact' },
    signal: new AbortController().signal,
    timeoutMs: 1000,
  };
}

capabilityConformanceSuite('fixture-embed', {
  capability: 'Embed',
  adapter: () => new FixtureEmbedAdapter(),
  context: (a) => context(a),
  validInput: () => ({ texts: ['alpha bravo'] }),
  inject: (a, s) => (a as FixtureEmbedAdapter).inject(s),
  supports: ['throttled', 'credential-rejected', 'unhealthy', 'provider-error', 'model-version-changed'],
  credentialSecret: SECRET,
  letterBag: {
    expected: LETTER_VECTORS,
    // "car" and "arc" share every letter and no meaning; "automobile" shares the meaning and one letter.
    meaning: { query: 'car', synonym: 'automobile', lexical: 'arc' },
  },
});

describe('T2194 · fixture-embed', () => {
  const embed = (a: FixtureEmbedAdapter, texts: string[], binding: Record<string, unknown> = {}) => a.invoke({ ...context(a, binding), capability: 'Embed', contractVersion: '1.0', input: { texts } });

  it('declares Embed at deployment scope with one model, fixture-letters, of dimension 27', () => {
    const d = new FixtureEmbedAdapter().descriptor;
    expect(d).toMatchObject({ key: 'fixture-embed', provider: 'fixture', credentialRequired: false });
    expect(d.implements).toEqual([{ capability: 'Embed', majors: [1] }]);
    expect(d.embedding?.models).toEqual([{ model: 'fixture-letters', dimension: 27 }]);
  });

  it('identical text → identical vector; the output names the model, its version and dimension', async () => {
    const r = await embed(new FixtureEmbedAdapter(), ['same text', 'same text']);
    expect(r).toMatchObject({ ok: true, output: { model: { id: 'fixture-letters', dimension: 27 } } });
    const out = (r as { output: { model: { version: string }; vectors: number[][] } }).output;
    expect(out.vectors[0]).toEqual(out.vectors[1]);
    expect(out.model.version.length).toBeGreaterThan(0);
  });

  it('a scripted model digest is the reported version (CC-12 through the binding)', async () => {
    const r = await embed(new FixtureEmbedAdapter(), ['x'], { script: { modelDigest: 'sha256:fixture-letters-9' } });
    expect((r as { output: { model: { version: string } } }).output.model.version).toBe('sha256:fixture-letters-9');
  });

  it('model-not-present is a scripted failure and an unhealthy reason', async () => {
    const a = new FixtureEmbedAdapter();
    expect(await embed(a, ['x'], { script: { invoke: 'model-not-present' } })).toMatchObject({ ok: false, errorCategory: 'model-not-present' });
    expect(await a.checkHealth(context(a, { script: { health: 'unhealthy', healthReason: 'model-not-present' } }))).toMatchObject({ state: 'unhealthy', reason: 'model-not-present' });
  });
});
