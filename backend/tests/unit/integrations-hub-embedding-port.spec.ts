/**
 * `T2202` (EPIC-039, `FR-HUB-080`–`FR-HUB-085`, `FR-HUB-087`) — `HubEmbeddingPort`.
 *
 * - implements `EPIC-038`'s `EmbeddingPort` — `modelId`, `dimension`,
 *   `embed(texts)` — **unchanged** (a type-level assignment below);
 * - `modelId` and `dimension` come from the boot binding snapshot, synchronously;
 * - each `embed()` is one deployment-scope resolution (no workspace) recording
 *   `modelIdentity`;
 * - 65 texts → `batch-too-large`, 8,001 characters → `text-too-long` naming the index;
 * - unbound or ineligible → `GovernanceSeamUnboundError` whose message names
 *   `EmbeddingPort` and carries the Hub's explanation;
 * - an adapter fault never returns vectors.
 *
 * Written to FAIL before `T2203`.
 */
import { CAPABILITY_CONTRACTS } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { GovernanceSeamUnboundError, ProviderUnavailableError } from '../../src/core/errors.js';
import type { EmbeddingPort } from '../../src/modules/context/retrieval/embedding.port.js';
import { embedChecked } from '../../src/modules/context/retrieval/embedding.port.js';
import { DeploymentBindingService } from '../../src/modules/integrations/embedding/deployment-binding.service.js';
import { HubEmbeddingPort } from '../../src/modules/integrations/embedding/hub-embedding-port.js';
import { InMemoryIntegrationsStore } from '../../src/modules/integrations/integrations.store.js';
import { letterVector } from '../helpers/context-retrieval-fixtures.js';

const NOW = new Date('2026-10-10T12:00:00Z');

async function invocations(store: InMemoryIntegrationsStore, ids: string[]) {
  return (await Promise.all(ids.map((id) => store.findInvocation(id)))).filter((i) => i !== null);
}

async function rig(env: Record<string, string>) {
  const store = new InMemoryIntegrationsStore(CAPABILITY_CONTRACTS.map((d, i) => ({ id: `cv_${i}`, name: d.name, scope: d.scope, major: d.major, minor: d.minor, status: 'approved' as const, document: d as unknown as Record<string, unknown>, changesState: d.changesState })));
  const catalog = createAdapterCatalog();
  const deployment = new DeploymentBindingService({ store, catalog, clock: () => NOW, env });
  await deployment.observeAtBoot();
  const port = new HubEmbeddingPort({ deployment, catalog, store, clock: () => NOW });
  return { store, port, deployment };
}

describe('T2202 · HubEmbeddingPort (FR-HUB-080–FR-HUB-087)', () => {
  it('is an EmbeddingPort, unchanged: modelId and dimension read synchronously from the boot snapshot', async () => {
    const { port } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    const asPort: EmbeddingPort = port; // the shape EPIC-038 declares — no change to it (FR-HUB-087)
    expect(asPort.modelId).toBe('fixture-embed:fixture-letters@sha256:fixture-letters-1');
    expect(asPort.dimension).toBe(27);
  });

  it('embeds through the bound adapter; EPIC-038 embedChecked accepts the result; vectors equal letterVector', async () => {
    const { port } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    const out = await embedChecked(port, ['Booking confirmation email', 'Invoice tax rounding']);
    expect(out).toMatchObject({ modelId: port.modelId, dimension: 27 });
    expect(out.vectors).toEqual([letterVector('Booking confirmation email'), letterVector('Invoice tax rounding')]);
  });

  it('each embed() is one deployment-scope resolution, no workspace, recording modelIdentity, and one invocation', async () => {
    const { port, store } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    await port.embed(['a']);
    await port.embed(['b']);
    const rows = await store.listDeploymentResolutions('Embed', 10);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({ scope: 'deployment', workspaceId: null, projectId: null, caller: 'context-assembly', capability: 'Embed', outcome: 'resolved', adapterKey: 'fixture-embed', modelIdentity: { model: 'fixture-letters', version: 'sha256:fixture-letters-1', dimension: 27, modelId: port.modelId } });
      expect((r.reasons as { candidates: { conditions: { condition: string; detail?: string }[] }[] }).candidates[0]!.conditions.find((c) => c.condition === 'policy')!.detail).toMatch(/not applicable/);
    }
    expect(await invocations(store, rows.map((r) => r.id))).toHaveLength(2);
  });

  it('65 texts → batch-too-large; 8,001 characters → text-too-long naming the index; both recorded, nothing invoked', async () => {
    const { port, store } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    await expect(port.embed(Array.from({ length: 65 }, () => 'x'))).rejects.toThrow(/batch-too-large/);
    await expect(port.embed(['ok', 'ok', 'x'.repeat(8001)])).rejects.toThrow(/text-too-long.*index 2/);
    const rows = await store.listDeploymentResolutions('Embed', 10);
    expect(rows.map((r) => r.refusalCode).sort()).toEqual(['batch-too-large', 'text-too-long']);
    expect(await invocations(store, rows.map((r) => r.id))).toEqual([]);
  });

  it('unbound → GovernanceSeamUnboundError naming EmbeddingPort, with the Hub\'s explanation', async () => {
    const { port, store } = await rig({});
    const err = await port.embed(['a']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toMatch(/EmbeddingPort/);
    expect((err as Error).message).toMatch(/PMI_EMBED_ADAPTER is not set/);
    expect(port.dimension).toBe(0);
    const [row] = await store.listDeploymentResolutions('Embed', 10);
    expect(row).toMatchObject({ outcome: 'refused', scope: 'deployment' });
  });

  it('bound but ineligible → GovernanceSeamUnboundError naming EmbeddingPort and why', async () => {
    const { port } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { health: 'unhealthy', healthReason: 'model-not-present' } }) });
    const err = await port.embed(['a']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((err as Error).message).toMatch(/EmbeddingPort.*model-not-present/s);
  });

  it('an adapter fault never returns vectors: ProviderUnavailableError, recorded adapter-fault', async () => {
    const { port, store } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { invoke: 'non-conforming' } }) });
    await expect(port.embed(['a', 'b'])).rejects.toBeInstanceOf(ProviderUnavailableError);
    const [row] = await store.listDeploymentResolutions('Embed', 10);
    const [inv] = await invocations(store, [row!.id]);
    expect(inv).toMatchObject({ outcome: 'adapter-fault', errorCategory: 'adapter-fault' });
  });

  it('a provider failure is ProviderUnavailableError carrying the category', async () => {
    const { port } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { invoke: 'provider-error' } }) });
    await expect(port.embed(['a'])).rejects.toThrow(/provider-unavailable/);
  });
});

describe('T2624 · FR-HUB-026 — a degraded Embed binding is ineligible unless the deployment permits degraded', () => {
  const degraded = { PMI_EMBED_ADAPTER: 'fixture-embed', PMI_EMBED_BINDING: JSON.stringify({ script: { health: 'degraded', healthReason: 'provider-throttled' } }) };

  it('by default: refused, naming EmbeddingPort and the degraded health — no vectors', async () => {
    const { port, deployment } = await rig(degraded);
    expect(deployment.snapshot()).toMatchObject({ health: 'degraded', eligible: false });
    await expect(port.embed(['a'])).rejects.toThrow(GovernanceSeamUnboundError);
    await expect(port.embed(['a'])).rejects.toThrow(/EmbeddingPort[\s\S]*degraded/);
  });

  it('with PMI_EMBED_PERMIT_DEGRADED=true: eligible, and the resolution records it was degraded', async () => {
    const { port, deployment } = await rig({ ...degraded, PMI_EMBED_PERMIT_DEGRADED: 'true' });
    expect(deployment.snapshot()).toMatchObject({ health: 'degraded', eligible: true });
    await expect(port.embed(['a'])).resolves.toHaveLength(1);
  });

  it('healthy needs no permission', async () => {
    const { port } = await rig({ PMI_EMBED_ADAPTER: 'fixture-embed' });
    await expect(port.embed(['a'])).resolves.toHaveLength(1);
  });
});
