/**
 * `T1340` (EPIC-041) — the provisioning record store is append-only by interface.
 *
 * `data-model.md` §2. `append`, `latestForProject`, `listForProject` — and no
 * update, no delete. The project's state is a projection of the latest record.
 *
 * Written to FAIL before `T1341` exists.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryProvisioningRecordStore } from '../../../src/modules/projects/provisioning.store.js';
import type { ProvisioningRecord } from '../../../src/modules/projects/provisioning.types.js';

let seq = 0;
const record = (over: Partial<ProvisioningRecord> = {}): ProvisioningRecord => ({
  id: `prov_${(seq += 1)}`,
  workspaceId: 'ws',
  projectId: 'pr',
  actorId: 'u',
  correlationId: `c_${seq}`,
  startedAt: new Date(2026, 8, 3, 10, seq),
  endedAt: new Date(2026, 8, 3, 10, seq, 30),
  outcome: 'succeeded',
  stepsCompleted: ['check_root'],
  failedStep: null,
  failureReason: null,
  engineTag: null,
  bundleVersion: '0.1.0',
  filesWritten: [],
  ...over,
});

describe('T1340 · InMemoryProvisioningRecordStore', () => {
  it('appends and returns the newest as latest', async () => {
    const store = new InMemoryProvisioningRecordStore();
    await store.append(record());
    const newest = await store.append(record({ outcome: 'failed', failedStep: 'merge_mcp_json' }));
    expect(await store.latestForProject('ws', 'pr')).toEqual(newest);
  });

  it('lists newest first, scoped to the project and workspace', async () => {
    const store = new InMemoryProvisioningRecordStore();
    const a = await store.append(record());
    const b = await store.append(record());
    await store.append(record({ projectId: 'other' }));
    await store.append(record({ workspaceId: 'ws2' }));
    expect((await store.listForProject('ws', 'pr')).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('answers null for a project with no record', async () => {
    expect(await new InMemoryProvisioningRecordStore().latestForProject('ws', 'nope')).toBeNull();
  });

  it('exposes no update and no delete', () => {
    const store = new InMemoryProvisioningRecordStore() as unknown as Record<string, unknown>;
    expect(store['update']).toBeUndefined();
    expect(store['delete']).toBeUndefined();
    expect(store['remove']).toBeUndefined();
  });

  it('freezes what it returns — a record is history', async () => {
    const store = new InMemoryProvisioningRecordStore();
    const r = await store.append(record());
    expect(Object.isFrozen(r)).toBe(true);
  });
});
