/**
 * `T2195` (EPIC-039, `US7`, `FR-HUB-086`) — `fixture-embed`: `Embed` without a
 * model server.
 *
 * Each text becomes the bag-of-letters vector `EPIC-038`'s retrieval tests use
 * (`letterVector`, `backend/tests/helpers/context-retrieval-fixtures.ts`): 26
 * letter counts plus a constant 1, so no vector is zero. It is deterministic,
 * vendor-free and **deliberately not semantic** — a test that passed against it
 * would prove nothing about meaning (`T1282` is run against a real model only).
 *
 * The model version is the binding's scripted `modelDigest`, so a "new weights"
 * change is expressible in a test (CC-12).
 */
import type { AdapterCall, AdapterDescriptor, AdapterResult, HealthObservation } from '@pmi/capability-contract';
import { FixtureAdapter, fixtureDescriptor, invalidInput, type FixtureScript } from './shared.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export const FIXTURE_EMBED_MODEL = 'fixture-letters';
export const FIXTURE_EMBED_DIMENSION = LETTERS.length + 1;
export const FIXTURE_EMBED_VERSION = 'sha256:fixture-letters-1';

export function letterVector(text: string): number[] {
  const v = new Array<number>(FIXTURE_EMBED_DIMENSION).fill(0);
  for (const ch of text.toLowerCase()) {
    const i = LETTERS.indexOf(ch);
    if (i >= 0) v[i]! += 1;
  }
  v[LETTERS.length] = 1;
  return v;
}

export class FixtureEmbedAdapter extends FixtureAdapter {
  readonly descriptor: AdapterDescriptor = fixtureDescriptor({
    key: 'fixture-embed',
    name: 'Fixture embeddings (letter bag)',
    implements: [{ capability: 'Embed', majors: [1] }],
    scopeMapping: { 'model.embed': ['fixture:embed'] },
    embedding: { models: [{ model: FIXTURE_EMBED_MODEL, dimension: FIXTURE_EMBED_DIMENSION }] },
  });

  private version(script: FixtureScript): string {
    return script.modelDigest ?? FIXTURE_EMBED_VERSION;
  }

  protected override healthExtras(s: FixtureScript): Partial<HealthObservation> {
    return { modelVersion: this.version(s) };
  }

  protected async serve(call: AdapterCall, script: FixtureScript): Promise<AdapterResult> {
    const input = call.input as { texts?: unknown } | null;
    if (input === null || typeof input !== 'object' || !Array.isArray(input.texts) || !input.texts.every((t) => typeof t === 'string')) {
      return invalidInput('Embed needs texts: string[]');
    }
    const texts = input.texts as string[];
    if (script.invoke === 'non-conforming') return { ok: true, output: { model: { id: FIXTURE_EMBED_MODEL, version: this.version(script), dimension: FIXTURE_EMBED_DIMENSION }, vectors: texts.map(() => [0]) } };
    return { ok: true, output: { model: { id: FIXTURE_EMBED_MODEL, version: this.version(script), dimension: FIXTURE_EMBED_DIMENSION }, vectors: texts.map(letterVector) } };
  }
}
