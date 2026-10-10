/**
 * `T2249` (EPIC-039, analysis C3, `SC-HUB-001` for `Embed`) — ONE caller-level
 * suite, run twice through `HubEmbeddingPort`: once bound to `fixture-embed`,
 * once to `ollama-embed` over recorded responses. The caller is `EPIC-038`'s:
 * it sees only `EmbeddingPort`, through `embedChecked`.
 *
 * Both runs: the same shapes, the same limit refusals, `modelIdentity`
 * recorded on every resolution, and the port's `modelId`/`dimension` taken
 * from each binding.
 */
import { readFileSync } from 'node:fs';
import { CAPABILITY_CONTRACTS } from '@pmi/capability-contract';
import { Replay, type Recording } from '@pmi/capability-contract/replay';
import { describe, expect, it } from 'vitest';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { embedChecked, type EmbeddingPort } from '../../src/modules/context/retrieval/embedding.port.js';
import { DeploymentBindingService } from '../../src/modules/integrations/embedding/deployment-binding.service.js';
import { HubEmbeddingPort } from '../../src/modules/integrations/embedding/hub-embedding-port.js';
import { InMemoryIntegrationsStore } from '../../src/modules/integrations/integrations.store.js';
import { embedOverlay } from '../../../packages/capability-adapters/ollama/tests/embed-replay.js';

const BASE = 'http://127.0.0.1:11434';
const RECORDING = JSON.parse(readFileSync(new URL('../../../packages/capability-adapters/ollama/tests/recordings/2026-10-10.ollama-embed.json', import.meta.url), 'utf8')) as Recording;

async function bound(env: Record<string, string>) {
  const store = new InMemoryIntegrationsStore(CAPABILITY_CONTRACTS.map((d, i) => ({ id: `cv_${i}`, name: d.name, scope: d.scope, major: d.major, minor: d.minor, status: 'approved' as const, document: d as unknown as Record<string, unknown>, changesState: d.changesState })));
  const replay = new Replay([RECORDING], { overlay: embedOverlay(RECORDING) });
  const catalog = createAdapterCatalog({ fetch: replay.fetch(BASE) as typeof fetch });
  const deployment = new DeploymentBindingService({ store, catalog, clock: () => new Date(), env });
  await deployment.observeAtBoot();
  return { store, port: new HubEmbeddingPort({ deployment, catalog, store, clock: () => new Date() }) as EmbeddingPort };
}

/** The caller-level suite. EPIC-038's view: a port, and embedChecked. */
async function suite(port: EmbeddingPort, store: InMemoryIntegrationsStore, expected: { modelId: RegExp; dimension: number }) {
  expect(port.modelId).toMatch(expected.modelId);
  expect(port.dimension).toBe(expected.dimension);
  const out = await embedChecked(port, ['first text', 'second text', 'first text']);
  expect(out.vectors).toHaveLength(3);
  expect(out.vectors.every((v) => v.length === expected.dimension)).toBe(true);
  expect(out.vectors[2]).toEqual(out.vectors[0]);
  expect(out.vectors[1]).not.toEqual(out.vectors[0]);
  await expect(port.embed(Array.from({ length: 65 }, (_, i) => `t${i}`))).rejects.toThrow(/batch-too-large/);
  await expect(port.embed(['ok', 'x'.repeat(8001)])).rejects.toThrow(/text-too-long.*index 1/);
  const rows = await store.listDeploymentResolutions('Embed', 10);
  const resolved = rows.filter((r) => r.outcome === 'resolved');
  expect(resolved).toHaveLength(1);
  for (const r of resolved) expect(r.modelIdentity).toMatchObject({ modelId: port.modelId, dimension: expected.dimension });
  expect(rows.filter((r) => r.outcome === 'refused').map((r) => r.refusalCode).sort()).toEqual(['batch-too-large', 'text-too-long']);
  return { shape: { model: Object.keys(resolved[0]!.modelIdentity ?? {}).sort(), vectors: out.vectors.length } };
}

describe('T2249 · the Embed caller-level suite, twice (SC-HUB-001 for Embed)', () => {
  it('fixture-embed and ollama-embed (recordings) give the caller the same shapes and refusals', async () => {
    const a = await bound({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    const fixture = await suite(a.port, a.store, { modelId: /^fixture-embed:fixture-letters@/, dimension: 27 });
    const b = await bound({ PMI_EMBED_ADAPTER: 'ollama-embed', PMI_EMBED_BINDING: JSON.stringify({ baseUrl: BASE, model: 'nomic-embed-text' }) });
    const real = await suite(b.port, b.store, { modelId: /^ollama-embed:nomic-embed-text@0a109f422b47/, dimension: 768 });
    expect(real.shape).toEqual(fixture.shape);
  });
});
