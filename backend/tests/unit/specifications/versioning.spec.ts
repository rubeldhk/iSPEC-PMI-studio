/**
 * T105 — each meaningful change creates a version; prior versions stay
 * unaltered. Written to FAIL before T110 exists (Constitution V).
 *
 * FR-013 / SC-007 / US5 scenario 2. "Meaningful" = the content changed;
 * saving identical content appends nothing — a no-op is not history.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemorySpecificationVersionStore,
  SpecificationVersionService,
} from '../../../src/modules/specifications/version.service.js';

const BASE = {
  workspaceId: 'ws_a',
  specificationId: 's1',
  contentRaw: '# Spec v1',
  contentParsed: { title: 'Spec' },
  lifecycleState: 'draft',
  authoredById: 'u1',
} as const;

function build(): { svc: SpecificationVersionService; store: InMemorySpecificationVersionStore } {
  const store = new InMemorySpecificationVersionStore();
  return { svc: new SpecificationVersionService(store), store };
}

describe('SpecificationVersionService (FR-013)', () => {
  it('numbers versions monotonically from 1', async () => {
    const { svc } = build();
    const v1 = await svc.appendIfChanged({ ...BASE });
    const v2 = await svc.appendIfChanged({ ...BASE, contentRaw: '# Spec v2' });
    const v3 = await svc.appendIfChanged({ ...BASE, contentRaw: '# Spec v3' });
    expect([v1.version.versionNumber, v2.version.versionNumber, v3.version.versionNumber]).toEqual([
      1, 2, 3,
    ]);
    expect(v1.appended && v2.appended && v3.appended).toBe(true);
  });

  it('saving IDENTICAL content appends nothing and returns the current version', async () => {
    const { svc } = build();
    const first = await svc.appendIfChanged({ ...BASE });
    const again = await svc.appendIfChanged({ ...BASE });
    expect(again.appended).toBe(false);
    expect(again.version.id).toBe(first.version.id);
    expect(await svc.listFor('ws_a', 's1')).toHaveLength(1);
  });

  it('prior versions stay retrievable and UNALTERED after later edits (SC-007)', async () => {
    const { svc } = build();
    await svc.appendIfChanged({ ...BASE });
    await svc.appendIfChanged({ ...BASE, contentRaw: '# Spec v2', authoredById: 'u2' });

    const history = await svc.listFor('ws_a', 's1');
    const v1 = history.find((v) => v.versionNumber === 1);
    expect(v1?.contentRaw).toBe('# Spec v1');
    expect(v1?.authoredById).toBe('u1');
    // The rows are frozen: mutation throws, mirroring the database trigger.
    expect(() => {
      (v1 as { contentRaw: string }).contentRaw = 'rewritten';
    }).toThrow();
  });

  it('the raw engine output is stored verbatim alongside the parsed structure (R-007)', async () => {
    const { svc } = build();
    const raw = '# Title\n\nwhatever the engine wrote, byte for byte\n';
    const { version } = await svc.appendIfChanged({ ...BASE, contentRaw: raw });
    expect(version.contentRaw).toBe(raw);
    expect(version.contentParsed).toEqual({ title: 'Spec' });
  });

  it('records who authored each version and when (FR-014)', async () => {
    const { svc } = build();
    const { version } = await svc.appendIfChanged({ ...BASE, authoredById: 'author-9' });
    expect(version.authoredById).toBe('author-9');
    expect(version.authoredAt).toBeInstanceOf(Date);
  });

  it('the store port is append-only — no update or delete exists to call', () => {
    const { store } = build();
    for (const forbidden of ['update', 'updateMany', 'delete', 'deleteMany', 'remove']) {
      expect(
        (store as unknown as Record<string, unknown>)[forbidden],
        `store must not expose ${forbidden}()`,
      ).toBeUndefined();
    }
  });

  it('versions are workspace-scoped like everything else (FR-002)', async () => {
    const { svc } = build();
    await svc.appendIfChanged({ ...BASE });
    expect(await svc.listFor('ws_other', 's1')).toEqual([]);
  });
});
