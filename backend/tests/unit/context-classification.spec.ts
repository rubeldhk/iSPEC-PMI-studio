/**
 * `T1239` (EPIC-038) — an unclassifiable source is excluded, never admitted.
 *
 * `FR-CTX-034`, `SC-CTX-007`, and `FR-GEL-062`'s rule underneath both: **a
 * default that permits is invisible.**
 *
 * ## Why this is the direction it is
 *
 * The tempting reading is that an unclassified source is *probably fine* — it
 * is usually some new document type nobody has got round to registering. And
 * that is true right up until the day it is a customer export, or an incident
 * postmortem, or a document somebody imported from another tenant.
 *
 * The failure is silent in the permissive direction and loud in the restrictive
 * one. Excluding an unclassified source produces a visible exclusion record
 * somebody can act on in a minute; admitting it produces a package that looks
 * completely normal.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { allow, classes, input, retrieval } from '../helpers/context-fixtures.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';

/** One classified candidate and one whose type nobody registered. */
const mixed: Candidate[] = [
  { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1', relevanceScore: 0.9 },
  { sourceType: 'imported-doc', sourceId: 'im_1', sourceVersion: 'v1', relevanceScore: 0.88 },
];

const service = (store: InMemoryContextStore, known: readonly string[]): AssemblyService =>
  new AssemblyService(store, {
    retrieval: retrieval(mixed),
    access: allow(),
    sourceClasses: classes(known),
  });

describe('T1239 · a source type with no class is excluded', () => {
  it('does not appear among the items', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store, ['requirement']).assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items.map((i) => i.sourceId)).toEqual(['rq_1']);
  });

  it('and the exclusion says it was the classification', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store, ['requirement']).assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.reason).toBe('classification');
    expect(exclusions[0]?.sourceId).toBe('im_1');
  });

  it('and names the type, so registering it is a minute’s work', async () => {
    // The whole reason the restrictive direction is affordable: the fix is
    // visible and small. An admitted unclassified source has no such moment.
    const store = new InMemoryContextStore();
    const result = await service(store, ['requirement']).assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions[0]?.detail).toMatch(/imported-doc/);
  });

  it('the package still assembles around it', async () => {
    // Excluding is not refusing. An unclassified candidate is one item's
    // problem, not the request's.
    const store = new InMemoryContextStore();
    const result = await service(store, ['requirement']).assemble(input());
    expect(result.state).toBe('assembled');
  });
});

describe('T1239 · SC-CTX-007 — zero unclassified sources are admitted', () => {
  it('with NO classes registered, everything is excluded and nothing is admitted', async () => {
    // The measure, stated as a test: zero, not "few".
    const store = new InMemoryContextStore();
    const result = await service(store, []).assemble(input());
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(0);
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(2);
  });

  it('and with both registered, both are admitted — so the check is not vacuous', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store, ['requirement', 'imported-doc']).assemble(input());
    expect(await store.itemsFor('ws_1', result.packageId)).toHaveLength(2);
    expect(await store.exclusionsFor('ws_1', result.packageId)).toHaveLength(0);
  });
});
