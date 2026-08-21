/**
 * T231 — steering content is versioned, never destroyed (FR-ENH-003).
 * Written to FAIL before T232/T233 exist (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import {
  InMemorySteeringStore,
  SteeringService,
} from '../../../src/modules/steering/steering.service.js';

const WS = 'ws_a';

function build(): SteeringService {
  return new SteeringService(new InMemorySteeringStore());
}

async function created(service: SteeringService) {
  return service.create(WS, {
    scope: { scopeType: 'organization', scopeRef: 'org_1' },
    subject: 'coding_standards',
    content: 'All services are framework-free.',
    createdById: 'u1',
  });
}

describe('T231 · create (FR-ENH-003)', () => {
  it('starts a document at version 1, active', async () => {
    const doc = await created(build());
    expect(doc.version).toBe(1);
    expect(doc.status).toBe('active');
    expect(doc.subject).toBe('coding_standards');
  });

  it('empty content is refused naming the field', async () => {
    await expect(
      build().create(WS, {
        scope: { scopeType: 'organization', scopeRef: 'org_1' },
        subject: 'security',
        content: '   ',
        createdById: 'u1',
      }),
    ).rejects.toThrow(/content/);
  });
});

describe('T231 · edit — a meaningful change creates a NEW version', () => {
  it('appends version 2 and keeps version 1 retrievable, byte-identical', async () => {
    const service = build();
    const v1 = await created(service);
    const v2 = await service.edit(WS, v1.id, 'All services are framework-free. No exceptions.', 'u2');

    expect(v2.version).toBe(2);
    const history = await service.history(WS, v1.id);
    expect(history.map((d) => d.version)).toEqual([1, 2]);
    expect(history[0]?.content).toBe('All services are framework-free.');
  });

  it('an edit that changes nothing creates NO version — meaningful change only', async () => {
    const service = build();
    const v1 = await created(service);
    const same = await service.edit(WS, v1.id, v1.content, 'u2');
    expect(same.version).toBe(1);
    expect((await service.history(WS, v1.id)).length).toBe(1);
  });

  it('the history is append-only — editing never rewrites a prior version', async () => {
    const service = build();
    const v1 = await created(service);
    await service.edit(WS, v1.id, 'Changed once.', 'u2');
    await service.edit(WS, v1.id, 'Changed twice.', 'u2');
    const history = await service.history(WS, v1.id);
    expect(history.map((d) => d.content)).toEqual([
      'All services are framework-free.',
      'Changed once.',
      'Changed twice.',
    ]);
  });
});

describe('T231 · retire marks, never deletes', () => {
  it('a retired document stays retrievable, marked retired', async () => {
    const service = build();
    const doc = await created(service);
    const retired = await service.retire(WS, doc.id, 'u1');
    expect(retired.status).toBe('retired');
    const history = await service.history(WS, doc.id);
    expect(history.length).toBe(1);
    expect(history[0]?.status).toBe('retired');
  });

  it('a retired document may not be edited', async () => {
    const service = build();
    const doc = await created(service);
    await service.retire(WS, doc.id, 'u1');
    await expect(service.edit(WS, doc.id, 'posthumous edit', 'u1')).rejects.toThrow(/retired/);
  });
});

describe('T231 · tenancy', () => {
  it('another workspace cannot see or edit the document — opaque 404 shape', async () => {
    const service = build();
    const doc = await created(service);
    await expect(service.history('ws_b', doc.id)).rejects.toThrow();
    await expect(service.edit('ws_b', doc.id, 'cross-tenant edit', 'u9')).rejects.toThrow();
  });
});
