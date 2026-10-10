/**
 * `T1285` (EPIC-038) — live state is filtered by the actor's permissions.
 *
 * `FR-CTX-023`, `US6/AC3`. An incident the actor may not see is absent from the
 * package **and its exclusion is recorded** — the same rule as documents, and
 * asked of the same adjudicator (`FR-CTX-054`): live state is not a side door.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { LiveStateReader } from '../../src/modules/context/live-state.js';
import { candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const READ_AT = new Date('2026-10-08T09:15:00.000Z');
const reader: LiveStateReader = {
  async read() {
    return [
      { kind: 'build', ref: 'build#812', state: 'failing', readAt: READ_AT },
      { kind: 'incident', ref: 'INC-9', state: 'open', readAt: READ_AT },
    ];
  },
};

describe('T1285 · live-state permissions', () => {
  it('an element the actor may not see is absent and its exclusion recorded', async () => {
    const store = new InMemoryContextStore();
    const asked: string[] = [];
    const result = await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: {
        async mayRead(_actor, source) {
          asked.push(`${source.sourceType}:${source.sourceId}`);
          return source.sourceId !== 'INC-9';
        },
      },
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      liveState: reader,
    }).assemble(input({ includeLiveState: true }));

    expect((await store.liveStateFor('ws_1', result.packageId)).map((e) => e.ref)).toEqual(['build#812']);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions.map((e) => [e.sourceType, e.sourceId, e.reason])).toEqual([
      ['live:incident', 'INC-9', 'permission'],
    ]);
    // Asked of the same adjudicator as documents.
    expect(asked).toContain('live:incident:INC-9');
  });
});
