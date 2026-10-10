/**
 * `T1247` (EPIC-038) — every item names its source, and carries no copy of it.
 *
 * `FR-CTX-040`, `FR-CTX-041`, `SC-CTX-002`.
 *
 * ## Why a reference rather than a copy, stated once more where it is enforced
 *
 * A copy is a second source that can disagree with the first, and it sits under
 * this Epic's access rules rather than the artifact's — which is how a
 * classified specification becomes readable by everyone who can open a context
 * package.
 *
 * `T1225` asserts the type has no content field and `T1236` asserts no file in
 * the module does. This file asserts the **behaviour**: what provenance
 * resolution puts on an item is a pointer and a status, and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { ProvenanceService } from '../../src/modules/context/provenance.service.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  allow,
  baselines,
  candidates,
  classes,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

const source = { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v3' };

describe('T1247 · an item points at its source', () => {
  it('names the type, the id and the version', async () => {
    const subject = new ProvenanceService(baselines({ 'rq_1@v3': { status: 'current' } }));
    const resolved = await subject.resolve('ws_1', source);

    expect(resolved.sourceType).toBe('requirement');
    expect(resolved.sourceId).toBe('rq_1');
    expect(resolved.sourceVersion).toBe('v3');
  });

  it('and the version asked about is the version the item cites', async () => {
    // Not "the current version" — the version that was actually included. A
    // package that cited whatever is current now would misdescribe what the
    // model was given the moment anything moved.
    const subject = new ProvenanceService(
      baselines({ 'rq_1@v3': { status: 'superseded', supersededBy: 'rq_1@v5' } }),
    );
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.sourceVersion).toBe('v3');
  });

  it('and carries no content, excerpt or body', async () => {
    // `FR-CTX-041`, `SC-CTX-002`. The keys are enumerated rather than spot
    // checked, so a field added later has to be added here too.
    const subject = new ProvenanceService(baselines({ 'rq_1@v3': { status: 'current' } }));
    const resolved = await subject.resolve('ws_1', source);

    expect(Object.keys(resolved).sort()).toEqual(
      ['authoritativeStatus', 'sourceId', 'sourceType', 'sourceVersion'].sort(),
    );
  });
});

describe('T1247 · SC-CTX-002 — every item carries a status', () => {
  it('a current source resolves to current', async () => {
    const subject = new ProvenanceService(baselines({ 'rq_1@v3': { status: 'current' } }));
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBe('current');
  });

  it('and no path produces an item with no status at all', async () => {
    // The measure is 100%. A resolution that could return without a status
    // would make the percentage unmeasurable rather than merely lower.
    const subject = new ProvenanceService(baselines({}));
    const resolved = await subject.resolve('ws_1', source);
    expect(resolved.authoritativeStatus).toBeDefined();
  });
});

/**
 * `T1250` — provenance resolution **at assembly**. The service above was
 * tested alone and never called; these require the assembled items to carry
 * what it resolves.
 */
describe('T1250 · assembly resolves each item through ProvenanceService', () => {
  async function assembled(provenance: ProvenanceService | null, found = candidates(['rq_1', 'rq_2'])) {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval(found),
      access: allow(),
      sourceClasses: classes(['requirement', 'execution-history']),
      authorisations: noAuthorisations(),
      executions: { async projectedVersion() { return 'v1'; } },
      provenance,
    }).assemble(input());
    return { store, result, items: await store.itemsFor('ws_1', result.packageId) };
  }

  it('a superseded source is recorded superseded, naming its successor', async () => {
    const { items } = await assembled(
      new ProvenanceService(baselines({ 'rq_1@v1': { status: 'current' }, 'rq_2@v1': { status: 'superseded', supersededBy: 'rq_2@v2' } })),
    );
    const byId = Object.fromEntries(items.map((i) => [i.sourceId, i]));
    expect(byId['rq_1']?.authoritativeStatus).toBe('current');
    expect(byId['rq_2']).toMatchObject({ authoritativeStatus: 'superseded', supersededBy: 'rq_2@v2' });
  });

  it('execution history is current as of its projection', async () => {
    const { items } = await assembled(new ProvenanceService(baselines({})), [
      { sourceType: 'execution-history', sourceId: 'ex_7', sourceVersion: 'v1', relevanceScore: 0.9, workspaceId: 'ws_1' },
    ]);
    expect(items[0]?.authoritativeStatus).toBe('current');
  });

  it('with no baseline reader bound, items are undetermined, naming the owner', async () => {
    const { items } = await assembled(null);
    for (const item of items) {
      expect(item.authoritativeStatus).toBe('undetermined');
      expect(item.authoritativeStatus === 'undetermined' ? item.undeterminedReason : '').toMatch(/EPIC-033/);
    }
  });

  it('a malformed answer refuses before anything is written', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval(candidates(['rq_1'])),
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        provenance: new ProvenanceService(baselines({ 'rq_1@v1': { status: 'superseded', supersededBy: '' } })),
      }).assemble(input()),
    ).rejects.toThrow(/successor/);
    expect(await store.packagesForExecution('ws_1', 'ex_1')).toEqual([]);
  });
});
