/**
 * `T1238` (EPIC-038) — an unreadable item is excluded, **and the exclusion is
 * recorded**.
 *
 * `FR-CTX-033`.
 *
 * ## The assertion that matters is the second one
 *
 * Checking that a forbidden item is absent from the package is easy and nearly
 * worthless: an implementation that returned an empty package for every request
 * would pass it. The assertion with teeth is that an `ExclusionRecord` exists —
 * that the package can say *this was considered and here is why it is not
 * here*.
 *
 * Without it, a package filtered down to nothing and a corpus with nothing in
 * it are the same record, and the reviewer's question — *"why isn't the
 * security policy in here?"* — has no answer at all.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, denyFor, input, retrieval } from '../helpers/context-fixtures.js';

const service = (
  store: InMemoryContextStore,
  access: ReturnType<typeof allow>,
  ids: readonly string[] = ['rq_1', 'rq_2'],
): AssemblyService =>
  new AssemblyService(store, {
    retrieval: retrieval(candidates(ids)),
    access,
    sourceClasses: classes(['requirement']),
  });

describe('T1238 · an item the actor may not read is excluded', () => {
  it('and does not appear among the items', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store, denyFor('rq_2')).assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items.map((i) => i.sourceId)).toEqual(['rq_1']);
  });

  it('**and an exclusion is written**, which is the half that answers questions', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store, denyFor('rq_2')).assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.sourceId).toBe('rq_2');
    expect(exclusions[0]?.reason).toBe('permission');
  });

  it('naming the rule rather than only the category', async () => {
    // `permission` says which kind of rule fired. `detail` says which rule —
    // the difference between a chart and an answer.
    const store = new InMemoryContextStore();
    const result = await service(store, denyFor('rq_2')).assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.detail.length).toBeGreaterThan(10);
    expect(exclusions[0]?.detail).toMatch(/u_1|engineer|read/i);
  });

  it('and every candidate is accounted for: items plus exclusions equals candidates', async () => {
    // The arithmetic that makes silent dropping detectable. If a candidate can
    // vanish without appearing on either side, no assertion about exclusions
    // proves anything.
    const store = new InMemoryContextStore();
    const result = await service(store, denyFor('rq_2')).assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(items.length + exclusions.length).toBe(2);
  });
});

describe('T1238 · and the control', () => {
  it('with everything readable, nothing is excluded', async () => {
    // Without this, a service that excluded every candidate would satisfy every
    // assertion above.
    const store = new InMemoryContextStore();
    const result = await service(store, allow()).assemble(input());
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(0);
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(2);
  });

  it('and a package where EVERYTHING is excluded still assembles, saying so', async () => {
    // An empty package is a legitimate answer — *"you may read none of the
    // relevant material"* is information. What it must not be is silent.
    const store = new InMemoryContextStore();
    const result = await service(store, denyFor('rq_1', 'rq_2')).assemble(input());

    expect(result.state).toBe('assembled');
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(0);
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(2);
  });
});
