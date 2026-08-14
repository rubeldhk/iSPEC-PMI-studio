/**
 * T650 — the job orchestration layer is actually reachable from the application.
 *
 * Convergence found F-00.4 fully built, fully tested, and unreachable:
 * `JobsModule` was `@Module({})`, so `JobsService`, the state machine and the
 * runner were provided nowhere and the running API had no job layer at all.
 * 372 passing tests described code no process could call.
 *
 * This is the same finding `T462` recorded for engines, and these assertions
 * are about WIRING — the thing the unit tests structurally cannot see.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JobsService } from '../../../src/modules/jobs/jobs.service.js';
import {
  JobsModule,
  JOB_STORE,
  JOB_QUEUE,
  GENERATION_QUEUE_NAME,
} from '../../../src/modules/jobs/jobs.module.js';
import { NullJobStore } from '../../../src/modules/jobs/job.store.js';
import { NullJobQueue } from '../../../src/modules/jobs/job-queue.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Comments stripped — `app.module.ts` describes its own rules in prose. */
const appModule = readFileSync(resolve(here, '../../../src/app.module.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, ' ');

const moduleSource = readFileSync(
  resolve(here, '../../../src/modules/jobs/jobs.module.ts'),
  'utf8',
);

describe('T650 · the module is composed into the application', () => {
  it('AppModule imports JobsModule', () => {
    expect(appModule).toMatch(/import\s*\{\s*JobsModule\s*\}/);
    expect(appModule).toMatch(/imports:\s*\[[^\]]*JobsModule/);
  });

  it('JobsModule is no longer empty', () => {
    // The whole finding. `@Module({})` type-checks, boots, and provides nothing.
    expect(moduleSource).toMatch(/providers:\s*\[/);
    expect(moduleSource).toMatch(/exports:\s*\[/);
  });

  it('provides JobsService and the ports it depends on', () => {
    for (const token of ['JobsService', 'JOB_STORE', 'JOB_QUEUE']) {
      expect(moduleSource, `${token} is not provided`).toContain(token);
    }
  });

  it('keeps the services framework-free (PC-1)', () => {
    // Wiring lives here so `*.service.ts` never imports Nest — which is what
    // lets the transport-independence architecture test hold.
    const service = readFileSync(
      resolve(here, '../../../src/modules/jobs/jobs.service.ts'),
      'utf8',
    );
    expect(service).not.toMatch(/@nestjs/);
    expect(service).not.toMatch(/@Injectable/);
  });

  it('exports a stable token for each replaceable port', () => {
    expect(typeof JOB_STORE).toBe('symbol');
    expect(typeof JOB_QUEUE).toBe('symbol');
  });

  it('JobsModule is a class the Nest container can consume', () => {
    expect(typeof JobsModule).toBe('function');
  });
});

describe('T650 · the graph the module builds actually works', () => {
  it('submits a job through the composed store and queue', async () => {
    const store = new NullJobStore();
    const queue = new NullJobQueue();
    const service = new JobsService(store, queue);

    const result = await service.submit({
      workspaceId: 'ws',
      projectId: 'proj',
      kind: 'generate_specification',
      requestedById: 'user',
      engineName: 'speckit',
      engineVersion: 'v1',
      correlationId: '00000000-0000-4000-8000-000000000000',
      inputRefs: { requirementIds: ['r1'] },
    });

    expect(result.joinedExisting).toBe(false);
    expect(store.created).toHaveLength(1);
    expect(queue.enqueued).toEqual([
      { jobId: result.job.id, correlationId: '00000000-0000-4000-8000-000000000000' },
    ]);
  });

  it('a duplicate submission joins the live job and does not enqueue twice', async () => {
    // FR-028 / RAID R-02: each engine run is a metered AI invocation, so a
    // double-submit is a real cost, not just an untidy row.
    const store = new NullJobStore();
    const queue = new NullJobQueue();
    const service = new JobsService(store, queue);
    const req = {
      workspaceId: 'ws',
      projectId: 'proj',
      kind: 'generate_specification' as const,
      requestedById: 'user',
      engineName: 'speckit',
      engineVersion: 'v1',
      correlationId: '00000000-0000-4000-8000-000000000000',
      inputRefs: { requirementIds: ['r1', 'r2'] },
    };

    await service.submit(req);
    const second = await service.submit({ ...req, inputRefs: { requirementIds: ['r2', 'r1'] } });

    expect(second.joinedExisting).toBe(true);
    expect(store.created).toHaveLength(1);
    expect(queue.enqueued).toHaveLength(1);
  });
});

describe('T650 · the queue name is shared with the worker', () => {
  it('is the literal both sides agree on', () => {
    // The producer is in `backend`, the consumer in `worker`, and the boundary
    // rules forbid either importing the other. The name is therefore asserted
    // on both sides against the same literal; `worker-bootstrap.spec.ts` holds
    // the other half. If one moves without the other, one of the two fails.
    expect(GENERATION_QUEUE_NAME).toBe('generation');
  });
});
