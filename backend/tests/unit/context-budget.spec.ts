/**
 * `T1240` (EPIC-038) — a bounded package names what it dropped, and a budget
 * admitting nothing refuses.
 *
 * `FR-CTX-035`, `FR-CTX-037`, `SC-CTX-004`.
 *
 * ## The failure a reader cannot detect from the package itself
 *
 * Silent truncation is the one failure mode here that leaves no trace. A
 * package cut to fit a budget, with the dropped material simply absent, is
 * indistinguishable from a package where that material was never relevant. The
 * reviewer sees a coherent set of items and no reason to doubt it.
 *
 * So the arithmetic is the assertion: **items + exclusions must equal
 * candidates**. Anything else means a candidate vanished, and a candidate that
 * can vanish makes every other guarantee in this Epic unenforceable.
 *
 * ## And refusing when nothing fits
 *
 * `FR-CTX-037`. An empty package and a package nobody could afford are
 * different facts. Returning the first when the second is true tells a reviewer
 * the corpus had nothing to offer, which is a claim about the material rather
 * than about the budget.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, candidates, classes, input, retrieval } from '../helpers/context-fixtures.js';

/** Four candidates; the service charges a fixed cost per item in these tests. */
const service = (store: InMemoryContextStore): AssemblyService =>
  new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2', 'rq_3', 'rq_4'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    // Fixed so the arithmetic in these tests is about the rule, not about a
    // tokeniser's judgement.
    costOf: () => 1000,
  });

describe('T1240 · a bounded package names what it dropped', () => {
  it('includes what fits', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 2000 }));
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(2);
  });

  it('and excludes the rest with reason `budget`', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 2000 }));
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions).toHaveLength(2);
    expect(exclusions.every((e) => e.reason === 'budget')).toBe(true);
  });

  it('naming the limit and where it was reached', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 2000 }));
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.detail).toMatch(/2000|2,000/);
  });

  it('**and every candidate is accounted for** — items + exclusions = candidates', async () => {
    // `SC-CTX-004`. The arithmetic is what makes silent truncation detectable;
    // without it, a candidate can disappear and no assertion here would notice.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 2000 }));
    const items = await store.itemsFor('ws_1', result.packageId);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(items.length + exclusions.length).toBe(4);
  });

  it('and the highest-ranked material is the material that fits', async () => {
    // Not stated as a requirement and worth asserting anyway: dropping by
    // arrival order rather than by rank would be a defensible-looking
    // implementation that silently discards the best matches.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 2000 }));
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items.map((i) => i.sourceId).sort()).toEqual(['rq_1', 'rq_2']);
  });
});

describe('T1240 · a budget that admits nothing refuses', () => {
  it('refuses rather than returning an empty package', async () => {
    // `FR-CTX-037`. "Nothing was relevant" and "nothing was affordable" are
    // different facts, and only one of them is about the corpus.
    const store = new InMemoryContextStore();
    await expect(service(store).assemble(input({ budgetTokens: 100 }))).rejects.toThrow(
      /budget/i,
    );
  });

  it('and the refusal is a stored row, inspectable later', async () => {
    // `FR-CTX-065`. A refusal that left no trace makes "no context was
    // assembled" and "assembly was never attempted" the same absence.
    const store = new InMemoryContextStore();
    await expect(service(store).assemble(input({ budgetTokens: 100 }))).rejects.toThrow();
    const refused = await store.packagesForExecution('ws_1', 'ex_1');
    expect(refused.some((p) => p.state === 'refused')).toBe(true);
  });

  it('the control: a sufficient budget assembles everything', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 99000 }));
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(4);
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(0);
  });
});
