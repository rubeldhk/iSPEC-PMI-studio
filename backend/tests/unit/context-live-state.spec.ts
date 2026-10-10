/**
 * `T1283` (EPIC-038) — live state carries the instant it was read.
 *
 * `FR-CTX-020`, `FR-CTX-021`, `US6/AC1`. A build that was green when the
 * package was assembled may be red by the time anybody reads the package; the
 * instant is what makes "it was green" a true statement rather than a stale
 * claim.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import type { LiveStateReader } from '../../src/modules/context/live-state.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const READ_AT = new Date('2026-10-08T09:15:00.000Z');

const reader: LiveStateReader = {
  async read() {
    return [
      { kind: 'build', ref: 'build#812', state: 'failing', readAt: READ_AT },
      { kind: 'pull-request', ref: 'PR-77', state: 'open', readAt: READ_AT },
    ];
  },
};

function assembler(store: InMemoryContextStore, liveState: LiveStateReader | null) {
  return new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
    liveState,
  });
}

describe('T1283 · live state', () => {
  it('records each element with the instant it was read', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, reader).assemble(input({ includeLiveState: true }));
    const elements = await store.liveStateFor('ws_1', result.packageId);
    expect(elements.map((e) => [e.kind, e.ref, e.state, e.readAt.toISOString()])).toEqual([
      ['build', 'build#812', 'failing', READ_AT.toISOString()],
      ['pull-request', 'PR-77', 'open', READ_AT.toISOString()],
    ]);
    expect((await store.findPackage('ws_1', result.packageId))?.liveState).toBe('read');
  });

  it('an element with no read instant is refused, never stamped with now', async () => {
    const store = new InMemoryContextStore();
    const undated: LiveStateReader = {
      async read() {
        return [{ kind: 'build', ref: 'build#1', state: 'passing', readAt: undefined as unknown as Date }];
      },
    };
    const result = await assembler(store, undated).assemble(input({ includeLiveState: true }));
    // Not an element, and not silently dropped: the reader is reported as
    // having answered unusably.
    expect(await store.liveStateFor('ws_1', result.packageId)).toEqual([]);
    const pkg = await store.findPackage('ws_1', result.packageId);
    expect(pkg?.liveState).toBe('unavailable');
    expect(pkg?.liveStateReason).toMatch(/read instant|FR-CTX-021/);
  });

  it('when not requested, it is recorded as not requested — not as empty', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, reader).assemble(input());
    expect((await store.findPackage('ws_1', result.packageId))?.liveState).toBe('not-requested');
    expect(await store.liveStateFor('ws_1', result.packageId)).toEqual([]);
  });
});

describe('T1283 · inspection shows live state as given', () => {
  it('returns the elements with their read instants', async () => {
    const store = new InMemoryContextStore();
    const result = await assembler(store, reader).assemble(input({ includeLiveState: true }));
    const seen = await new InspectionService(store, null, null).inspect('ws_1', result.packageId);
    expect(seen?.liveState.map((e) => [e.ref, e.readAt.toISOString()])).toEqual([
      ['build#812', READ_AT.toISOString()],
      ['PR-77', READ_AT.toISOString()],
    ]);
  });
});
