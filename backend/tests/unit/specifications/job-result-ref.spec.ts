/**
 * T844 — a succeeded job points at what it produced (F4).
 *
 * Written to FAIL before T845 exists (Constitution V).
 *
 * Found by the `/speckit-converge EPIC-008` pass. The job body in
 * `contracts/platform-api.md` declares `resultRef`, and Quickstart **V4** step 4
 * — "open the resulting specification" — depends on it. It existed in no
 * schema: not `schema.prisma`, not `_shared/schema.sql`, not `data-model.md`.
 * A field the contract promises and the database cannot hold is null on every
 * path, including the composed one.
 *
 * A failed, cancelled or timed-out job carries none, for the same reason it
 * carries no artifact (FR-027, SC-006): there is nothing to point at.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JobsService } from '../../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
} from '../../../src/modules/specifications/generate-specification.service.js';
import {
  InMemorySpecificationStore,
  PrismaSpecificationStore,
  type SpecificationDelegates,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { OUTPUT, PROJECT, StubEngine, WS, selection } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

function model(name: string): string {
  const m = schema.match(new RegExp(`model ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m?.[1]) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

describe('the schema can hold a result reference (T845)', () => {
  it('GenerationJob declares resultRef, nullable until there is a result', () => {
    expect(model('GenerationJob')).toMatch(/resultRef\s+String\?/);
  });

  it('the migration creates the column', () => {
    const migrations = readFileSync(
      resolve(here, '../../../prisma/migrations/20260820000400_epic008_job_result_ref/migration.sql'),
      'utf8',
    );
    expect(migrations).toMatch(/ALTER TABLE "generation_jobs"[\s\S]*"resultRef"/);
  });
});

function world(): {
  service: GenerateSpecificationService;
  ledger: InMemoryGenerationJobLedger;
  store: InMemorySpecificationStore;
} {
  const ledger = new InMemoryGenerationJobLedger();
  const store = new InMemorySpecificationStore();
  return {
    ledger,
    store,
    service: new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() },
      store,
      {
        jobs: new JobsService(ledger),
        ledger,
        requirements: new InMemoryRequirementSelection(
          selection().map((r) => ({ id: r.id, workspaceId: WS, projectId: PROJECT })),
        ),
      },
    ),
  };
}

async function queued(ledger: InMemoryGenerationJobLedger): Promise<string> {
  const row = await ledger.create({
    workspaceId: WS,
    projectId: PROJECT,
    kind: 'generate_specification',
    requestedById: 'u1',
    engineName: 'stub',
    engineVersion: '1.0.0',
    correlationId: 'corr_1',
    inputRefs: { requirementIds: ['req_1'] },
    jobKey: 'key_1',
  });
  return row.id;
}

const order = (jobId: string, over: Record<string, unknown> = {}) => ({
  jobId,
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements: selection(),
  timeoutMs: 50,
  ...over,
});

describe('a succeeded job carries the specification it produced', () => {
  it('the commit names the specification as the job result', async () => {
    const { service, store, ledger } = world();
    const jobId = await queued(ledger);
    const outcome = await service.run(order(jobId) as never);

    expect(store.commits[0]!.job).toEqual({
      id: jobId,
      state: 'succeeded',
      resultRef: outcome.specification!.id,
    });
  });

  it('the readable job carries it, so a client can open the result', async () => {
    const { service, ledger } = world();
    const jobId = await queued(ledger);
    const outcome = await service.run(order(jobId) as never);

    const job = await service.job(WS, jobId);
    expect(job.resultRef).toBe(outcome.specification!.id);
    expect(job.state).toBe('succeeded');
  });
});

describe('a job with no result carries none (FR-027, SC-006)', () => {
  it.each([
    ['a failing engine', { engine: StubEngine.failing('engine_error') }],
    ['empty output', { engine: StubEngine.returning({ ...OUTPUT, contentRaw: '  ' }) }],
  ])('%s leaves resultRef null', async (_label, { engine }) => {
    const ledger = new InMemoryGenerationJobLedger();
    const service = new GenerateSpecificationService(
      { resolveForProject: async () => engine },
      new InMemorySpecificationStore(),
      {
        jobs: new JobsService(ledger),
        ledger,
        requirements: new InMemoryRequirementSelection(
          selection().map((r) => ({ id: r.id, workspaceId: WS, projectId: PROJECT })),
        ),
      },
    );
    const jobId = await queued(ledger);
    await service.run(order(jobId) as never);

    const job = await service.job(WS, jobId);
    expect(job.resultRef).toBeNull();
    expect(job.state).toBe('failed');
  });

  it('a cancelled job leaves resultRef null and names its reason', async () => {
    const { service, ledger } = world();
    const jobId = await queued(ledger);
    await service.run(order(jobId, { signal: AbortSignal.abort() }) as never);

    const job = await service.job(WS, jobId);
    expect(job.resultRef).toBeNull();
    expect(job.state).toBe('cancelled');
    expect(job.failureReason).toBe('cancelled');
  });
});

describe('the Prisma path writes it inside the SAME transaction', () => {
  it('sets state, endedAt and resultRef on the job in one commit', async () => {
    const written: Record<string, unknown>[] = [];
    const delegates = {
      specification: {
        create: async ({ data }: { data: Record<string, unknown> }) => data,
        findFirst: async () => null,
        findMany: async () => [],
        count: async () => 0,
        updateMany: async () => ({ count: 1 }),
      },
      specificationVersion: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'ver_1' }),
        findFirst: async () => null,
        findMany: async () => [],
      },
      generationJob: {
        updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          written.push({ ...args.where, ...args.data });
          return { count: 1 };
        },
      },
      traceabilityLink: { createMany: async () => undefined, findMany: async () => [] },
    } as unknown as SpecificationDelegates;

    const store = new PrismaSpecificationStore(delegates, async (fn) => fn(delegates));
    await store.commitGeneration({
      specification: {
        id: 'spec_1',
        workspaceId: WS,
        projectId: PROJECT,
        title: 'Payments',
        lifecycleState: 'draft',
        currentVersionId: null,
        engineName: 'stub',
        engineVersion: '1.0.0',
        generatedAt: new Date('2026-08-20T10:00:00.000Z'),
        isOutOfDate: false,
        createdById: 'u1',
        updatedById: 'u1',
      },
      version: {
        id: 'ver_1',
        workspaceId: WS,
        specificationId: 'spec_1',
        versionNumber: 1,
        contentRaw: '# Payments',
        contentParsed: { a: 1 },
        lifecycleStateAtCreation: 'draft',
        authoredById: 'u1',
      },
      links: [],
      job: { id: 'job_1', state: 'succeeded', resultRef: 'spec_1' },
    });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ id: 'job_1', state: 'succeeded', resultRef: 'spec_1' });
    expect(written[0]!['endedAt']).toBeInstanceOf(Date);
  });
});
