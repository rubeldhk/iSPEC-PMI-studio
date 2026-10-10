/**
 * `T1819` (EPIC-038 Convergence) — refusals before ranking are recorded too.
 *
 * `FR-CTX-065`, `SC-CTX-005`, and the contract: *"The refusals write a
 * ContextPackage row with state = 'refused'."* Only the refusals made after
 * ranking were rows. An index never built, a workspace with no budget policy,
 * a project not in the workspace — each refused and left nothing, so
 * *"assembly was refused"* and *"assembly was never attempted"* were the same
 * absence. That includes the `503` every deployment answers today.
 *
 * A refusal that never ranked records **no model**: naming one would claim a
 * ranking that did not happen.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, classes, input, noAuthorisations } from '../helpers/context-fixtures.js';

async function refusedRow(store: InMemoryContextStore) {
  const [row] = await store.packagesForExecution('ws_1', 'ex_1');
  return row;
}

describe('T1819 · pre-ranking refusals are rows', () => {
  it('an unbound embedding seam: refused row naming the seam, no model, then the 503', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: {
          async search() {
            throw new GovernanceSeamUnboundError('no embedding provider is bound (EmbeddingPort, FR-CTX-013)');
          },
        },
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    const row = await refusedRow(store);
    expect(row?.state).toBe('refused');
    expect(row?.refusalReason).toMatch(/EmbeddingPort/);
    expect(row?.embeddingModelId).toBeNull();
    expect(row?.retrievalRequested).toBeNull();
  });

  it('no budget policy: refused row naming FR-CTX-036', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: { async search() { throw new Error('must not be reached'); } },
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        budgetPolicy: store,
      }).assemble(input()),
    ).rejects.toThrow(/budget policy/);
    expect((await refusedRow(store))?.refusalReason).toMatch(/FR-CTX-036/);
  });

  it('a project not in the workspace: refused row', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: { async search() { throw new Error('must not be reached'); } },
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        projects: { async inWorkspace() { return false; } },
      }).assemble(input()),
    ).rejects.toThrow(/no project/);
    expect((await refusedRow(store))?.state).toBe('refused');
  });

  it('a request that cannot name its subject (blank objective) is a 400 and writes nothing', async () => {
    // Not a refusal to assemble: there is nothing to have assembled for.
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: { async search() { throw new Error('must not be reached'); } },
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input({ objective: '  ' })),
    ).rejects.toThrow(/objective/);
    expect(await refusedRow(store)).toBeUndefined();
  });
});
