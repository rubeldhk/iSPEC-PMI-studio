/**
 * `T1262` (EPIC-038) — drift is stated beside the retained item.
 *
 * `FR-CTX-063`, `US4/AC2`.
 *
 * Inspection shows the version that was supplied **and** says where the source
 * has gone since. Hiding the drift makes a stale record look current; replacing
 * the item with the current version is re-assembly by another name. Four
 * answers, each distinct, because each sends a reader somewhere different:
 *
 * | Drift | Means |
 * |---|---|
 * | `unchanged` | the source is still at the supplied version |
 * | `moved` | the source has a newer version, named |
 * | `unresolvable` | the source no longer resolves |
 * | `unknown` | nobody could look — the reader is unbound or failed |
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  InspectionService,
  type SourceVersionReader,
} from '../../src/modules/context/inspection.service.js';
import {
  allow,
  candidates,
  classes,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

async function assembled(store: InMemoryContextStore): Promise<string> {
  const result = await new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2', 'rq_3'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  }).assemble(input());
  return result.packageId;
}

const versions: SourceVersionReader = {
  async currentVersion(_ws, _type, sourceId) {
    if (sourceId === 'rq_1') return { resolves: true, version: 'v1' };
    if (sourceId === 'rq_2') return { resolves: true, version: 'v4' };
    return { resolves: false };
  },
};

async function inspected(reader: SourceVersionReader | null) {
  const store = new InMemoryContextStore();
  const id = await assembled(store);
  return new InspectionService(store, reader, null).inspect('ws_1', id);
}

describe('T1262 · drift notes', () => {
  it('an unmoved source is unchanged', async () => {
    const seen = await inspected(versions);
    expect(seen?.items.find((i) => i.sourceId === 'rq_1')?.drift).toEqual({ kind: 'unchanged' });
  });

  it('a moved source keeps its supplied version AND names the current one', async () => {
    const item = (await inspected(versions))?.items.find((i) => i.sourceId === 'rq_2');
    expect(item?.sourceVersion).toBe('v1');
    expect(item?.drift).toMatchObject({ kind: 'moved', currentVersion: 'v4' });
    expect(item?.drift.kind === 'moved' ? item.drift.note : '').toMatch(/v1[\s\S]*v4/);
  });

  it('a source that no longer resolves says so', async () => {
    const seen = await inspected(versions);
    expect(seen?.items.find((i) => i.sourceId === 'rq_3')?.drift.kind).toBe('unresolvable');
  });

  it('with no version reader bound, drift is unknown with a reason — never unchanged', async () => {
    const seen = await inspected(null);
    expect(seen?.items).toHaveLength(3);
    for (const item of seen?.items ?? []) {
      expect(item.drift.kind).toBe('unknown');
      expect(item.drift.kind === 'unknown' ? item.drift.note : '').toMatch(/\S/);
    }
  });

  it('a reader that fails is unknown too, and distinguishable from unresolvable', async () => {
    const failing: SourceVersionReader = {
      async currentVersion() {
        throw new Error('baseline store unreachable');
      },
    };
    const seen = await inspected(failing);
    expect(seen?.items.map((i) => i.drift.kind)).toEqual(['unknown', 'unknown', 'unknown']);
  });
});
