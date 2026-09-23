/**
 * `T1241` (EPIC-038) — an excluded essential item refuses the whole assembly.
 *
 * `FR-CTX-038`, `FR-CTX-039`, clarified 2026-08-31.
 *
 * ## What this rule is actually protecting against
 *
 * `FR-CTX-035` already makes budget exclusions visible, and for marginal
 * material that is the right answer: proceed, name what was dropped, let the
 * reviewer judge.
 *
 * It stops being the right answer when the dropped item is the one that
 * mattered. The session runs, the model answers from material that looks
 * sufficient, the output reads normally — and the exclusion sits in a record
 * nobody opens because nothing suggested there was a problem. The reviewer's
 * only signal is a list they have no reason to read.
 *
 * So somebody can mark a source **essential**, and its exclusion — for *any*
 * reason, not just budget — refuses the assembly and says which item and why.
 * The clarification chose this over refusing whenever anything relevant is
 * dropped, which would refuse nearly every real request.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  allow,
  candidates,
  classes,
  denyFor,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

const essential = [{ sourceType: 'requirement', sourceId: 'rq_2' }];

describe('T1241 · an essential item excluded by budget refuses', () => {
  const service = (store: InMemoryContextStore): AssemblyService =>
    new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      costOf: () => 1000,
    });

  it('refuses when the budget cannot fit it', async () => {
    const store = new InMemoryContextStore();
    await expect(
      service(store).assemble(input({ budgetTokens: 1000, essentialSources: essential })),
    ).rejects.toThrow(/essential/i);
  });

  it('naming the item, so the person knows what to do next', async () => {
    const store = new InMemoryContextStore();
    await expect(
      service(store).assemble(input({ budgetTokens: 1000, essentialSources: essential })),
    ).rejects.toThrow(/rq_2/);
  });

  it('and naming the reason it was excluded', async () => {
    // Raising the budget and granting permission are different actions. A
    // refusal that says only "an essential item was excluded" sends somebody
    // to guess which.
    const store = new InMemoryContextStore();
    await expect(
      service(store).assemble(input({ budgetTokens: 1000, essentialSources: essential })),
    ).rejects.toThrow(/budget/i);
  });

  it('and the refusal is stored, with the exclusion that caused it', async () => {
    // `wasEssential` lives on the exclusion so the refusal is explainable
    // **after** the fact — the package refused, and this is the row that says
    // why.
    const store = new InMemoryContextStore();
    await expect(
      service(store).assemble(input({ budgetTokens: 1000, essentialSources: essential })),
    ).rejects.toThrow();

    const packages = await store.packagesForExecution('ws_1', 'ex_1');
    const refused = packages.find((p) => p.state === 'refused');
    expect(refused).toBeDefined();
    const exclusions = await store.exclusionsFor('ws_1', refused!.id);
    expect(exclusions.some((e) => e.wasEssential && e.sourceId === 'rq_2')).toBe(true);
  });
});

describe('T1241 · and for any other reason too', () => {
  it('refuses when an essential item is excluded by permission', async () => {
    // `FR-CTX-039` says *any* reason. A rule that only watched the budget would
    // let the more serious case through: the actor cannot read the one document
    // the task depends on, and the session proceeds anyway.
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: denyFor('rq_2'),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      costOf: () => 10,
    });
    await expect(
      subject.assemble(input({ essentialSources: essential })),
    ).rejects.toThrow(/essential.*permission|permission.*essential/is);
  });

  it('and when it is excluded because its class is unknown', async () => {
    const store = new InMemoryContextStore();
    const subject = new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: allow(),
      sourceClasses: classes([]),
      authorisations: noAuthorisations(),
      costOf: () => 10,
    });
    await expect(
      subject.assemble(input({ essentialSources: essential })),
    ).rejects.toThrow(/essential/i);
  });
});

describe('T1241 · and the controls', () => {
  const service = (store: InMemoryContextStore): AssemblyService =>
    new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      costOf: () => 1000,
    });

  it('a NON-essential item excluded by budget proceeds, as FR-CTX-035 requires', async () => {
    // The reason this rule needed a clarification rather than being obvious:
    // the marginal case must still proceed, or the Room refuses nearly every
    // real request.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input({ budgetTokens: 1000 }));
    expect(result.state).toBe('assembled');
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(1);
  });

  it('and an essential item that IS included assembles normally', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(
      input({ budgetTokens: 99000, essentialSources: essential }),
    );
    expect(result.state).toBe('assembled');
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items.map((i) => i.sourceId)).toContain('rq_2');
  });

  it('and marking nothing essential never refuses', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(
      input({ budgetTokens: 1000, essentialSources: [] }),
    );
    expect(result.state).toBe('assembled');
  });
});
