/**
 * `DEF-044-003` (EPIC-044, `R-044-5`) — the Prisma store's number allocation
 * under contention: `max(number) + 1` guarded by the unique `(projectId, number)`
 * index. A number conflict is retried a bounded number of times and then
 * refused as a coded conflict, never surfaced as a raw driver error; a
 * violation of any OTHER unique index is the caller's to handle and is
 * rethrown at once. The in-memory store enforces the decision index the
 * database enforces, so unit tests see the race integration tests see.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryEpicStore, PrismaEpicStore, type EpicDelegate, type EpicRecord, type NewEpic } from '../../../src/modules/epics/epic.store.js';

const NEW: NewEpic = { id: 'e1', workspaceId: 'ws_a', projectId: 'p_a', slug: 'intake', title: 'Intake', description: '', status: 'active', parentEpicId: null, splitSuffix: null, decisionCommentId: null, lastDecisionCommentId: null, createdById: 'u', closedAt: null };

function unique(target: string[]): Error & { code: string; meta: { target: string[] } } {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target } });
}

function delegate(plan: (attempt: number) => 'ok' | Error): EpicDelegate & { attempts: number } {
  const d = {
    attempts: 0,
    async create({ data }: { data: Record<string, unknown> }): Promise<EpicRecord> {
      d.attempts += 1;
      const outcome = plan(d.attempts);
      if (outcome !== 'ok') throw outcome;
      return { ...(data as unknown as EpicRecord), createdAt: new Date(), updatedAt: new Date() };
    },
    async findUnique() { return null; },
    async findMany() { return []; },
    async update() { throw new Error('unused'); },
    async aggregate() { return { _max: { number: d.attempts } }; },
  };
  return d as unknown as EpicDelegate & { attempts: number };
}

describe('DEF-044-003 · PrismaEpicStore.create under contention', () => {
  it('retries a number conflict and succeeds on the fourth attempt', async () => {
    const d = delegate((n) => (n < 4 ? unique(['projectId', 'number']) : 'ok'));
    const row = await new PrismaEpicStore(d).create(NEW);
    expect(d.attempts).toBe(4);
    expect(row.number).toBe(4);
  });

  it('gives up after five conflicts with a coded conflict, not a driver error', async () => {
    const d = delegate(() => unique(['projectId', 'number']));
    await expect(new PrismaEpicStore(d).create(NEW)).rejects.toMatchObject({ details: { code: 'epic_number_contended' } });
    expect(d.attempts).toBe(5);
  });

  it('rethrows a violation of another unique index at once — the decision index is the caller\'s to handle', async () => {
    const d = delegate(() => unique(['decisionCommentId', 'splitSuffix']));
    await expect(new PrismaEpicStore(d).create(NEW)).rejects.toMatchObject({ code: 'P2002' });
    expect(d.attempts).toBe(1);
  });
});

describe('DEF-044-003 · InMemoryEpicStore enforces the decision index', () => {
  it('refuses a second child for the same decision and suffix with a P2002-shaped error', async () => {
    const store = new InMemoryEpicStore();
    await store.create({ ...NEW, id: 'c1', decisionCommentId: 'cmt_1', splitSuffix: 'a' });
    await expect(store.create({ ...NEW, id: 'c2', decisionCommentId: 'cmt_1', splitSuffix: 'a' })).rejects.toMatchObject({ code: 'P2002' });
    await expect(store.create({ ...NEW, id: 'c3', decisionCommentId: 'cmt_1', splitSuffix: 'b' })).resolves.toMatchObject({ number: 2 });
  });
});
