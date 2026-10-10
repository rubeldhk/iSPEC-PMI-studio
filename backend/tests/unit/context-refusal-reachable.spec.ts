/**
 * `T1834` (EPIC-038 Convergence) — a stored refusal can be found again.
 *
 * `FR-CTX-065`, `US4/AC3`, `SC-CTX-005`. Refusals became rows (`T1820`), but the
 * error that announced each one did not say which row — and listing requires
 * an execution. So a refusal made without one was recorded and unreachable,
 * which is nearly the same as not recorded. Every refusal now carries the id of
 * the package that records it, so `GET /context/packages/:id` opens it.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, PlatformError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, denyFor, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

async function refusalOf(attempt: Promise<unknown>): Promise<PlatformError> {
  try {
    await attempt;
  } catch (error) {
    return error as PlatformError;
  }
  throw new Error('expected a refusal');
}

describe('T1834 · every refusal names the package that records it', () => {
  it('a refusal after ranking (essential excluded) carries the package id, and that package is the refusal', async () => {
    const store = new InMemoryContextStore();
    const error = await refusalOf(
      new AssemblyService(store, {
        retrieval: retrieval(candidates(['rq_1'])),
        access: denyFor('rq_1'),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input({ executionId: undefined, essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_1' }] })),
    );
    const id = (error.details as { packageId?: string } | undefined)?.packageId;
    expect(id).toBeTruthy();
    expect((await store.findPackage('ws_1', id!))?.state).toBe('refused');
  });

  it('a refusal before ranking keeps its class and status, and carries the package id', async () => {
    const store = new InMemoryContextStore();
    const error = await refusalOf(
      new AssemblyService(store, {
        retrieval: {
          async search() {
            throw new GovernanceSeamUnboundError('no embedding provider is bound (EmbeddingPort, FR-CTX-013)');
          },
        },
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input({ executionId: undefined })),
    );
    expect(error).toBeInstanceOf(GovernanceSeamUnboundError);
    expect(error.message).toMatch(/EmbeddingPort/);
    const id = (error.details as { packageId?: string } | undefined)?.packageId;
    expect((await store.findPackage('ws_1', id!))?.refusalReason).toMatch(/EmbeddingPort/);
  });
});
