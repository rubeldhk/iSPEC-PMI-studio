/**
 * `T1237` (EPIC-038) — assembly consults all six inputs, and records what it
 * was asked.
 *
 * `FR-CTX-030`, `FR-CTX-031`, `FR-CTX-032`, `SC-CTX-001`.
 *
 * ## Why "records what it was asked" is half the requirement
 *
 * A package that lists its items answers *what did the model see*. It does not
 * answer *what was this for*, *whose permissions filtered it*, or *what budget
 * bounded it* — and those are what a reviewer needs to judge whether the answer
 * was reasonable. `SC-CTX-001` puts the number at 100% for exactly that reason.
 *
 * The objective is stored in the requester's own words rather than normalised.
 * A rewritten objective is a second description of the task, and the two would
 * disagree about what was being asked the moment anybody tuned the rewriting.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  allow,
  candidates,
  classes,
  input,
  retrieval,
} from '../helpers/context-fixtures.js';

describe('T1237 · the six inputs are consulted and recorded', () => {
  it('records the objective in the requester’s own words', async () => {
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });

    const result = await subject.assemble(input());
    const stored = await store.findPackage('ws_1', result.packageId);
    expect(stored?.objective).toBe('why does the booking notify twice');
  });

  it('and the actor and role the permissions were applied for', async () => {
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });

    const result = await subject.assemble(input());
    const stored = await store.findPackage('ws_1', result.packageId);
    expect(stored?.actorId).toBe('u_1');
    expect(stored?.actorRole).toBe('engineer');
  });

  it('and the budget it was assembled under', async () => {
    // Without this a reviewer cannot tell a thin package assembled cheaply from
    // a thin package assembled from a thin corpus.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });

    const result = await subject.assemble(input({ budgetTokens: 9000 }));
    const stored = await store.findPackage('ws_1', result.packageId);
    expect(stored?.budgetTokens).toBe(9000);
  });

  it('and the model that ranked the candidates', async () => {
    // `R-038-4` — two models of one dimension produce incomparable spaces, so a
    // package that does not say which ranked it cannot be compared with another.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1']), { modelId: 'model-b' }),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });

    const result = await subject.assemble(input());
    expect((await store.findPackage('ws_1', result.packageId))?.embeddingModelId).toBe('model-b');
  });

  it('and the relevance score travels onto the item', async () => {
    // `FR-CTX-014`. The score is what the ranking was; an item without it
    // cannot be argued with.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'], 0.77)),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });

    const result = await subject.assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items[0]?.relevanceScore).toBeCloseTo(0.77);
  });
});

describe('T1237 · what assembly refuses before writing anything', () => {
  it('a blank objective', async () => {
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });
    await expect(subject.assemble(input({ objective: '   ' }))).rejects.toThrow(/objective/i);
  });

  it('and writes no package when it refuses', async () => {
    // Every check runs before anything is written, so a refused assembly leaves
    // no half-formed package for somebody to find and wonder about.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });
    await expect(subject.assemble(input({ objective: '' }))).rejects.toThrow();
    expect(await store.findPackage('ws_1', 'cp_1')).toBeNull();
  });

  it('and refuses when the index is unavailable, rather than assembling unranked', async () => {
    // `FR-CTX-012`. An unranked package is not a degraded package — it is a
    // different one, and nothing downstream could tell the difference between
    // that and a corpus with nothing relevant in it.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: {
        async search() {
          throw new Error('the index has never been built');
        },
      },
      access: allow(),
      sourceClasses: classes(['requirement']),
    });
    await expect(subject.assemble(input())).rejects.toThrow(/index/i);
  });

  it('the control: a bound retrieval does assemble', async () => {
    // Without this, a service that refused every assembly would satisfy every
    // refusal above.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
    });
    const result = await subject.assemble(input());
    expect(result.state).toBe('assembled');
  });
});
