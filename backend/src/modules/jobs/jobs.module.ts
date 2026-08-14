/**
 * T651 — job module.
 *
 * Convergence found F-00.4 fully built, fully tested, and **unreachable**: this
 * file was `@Module({})`, so `JobsService` was provided nowhere and the running
 * API had no job layer at all. This is the wiring — the same finding, and the
 * same fix, as `T462` for engines.
 *
 * The services stay framework-free (PC-1) — no `@Injectable()`, no decorators,
 * no Nest import in a `.service.ts` file. They are plain classes wired here with
 * factory providers, which is why the architecture test can assert that services
 * never import an HTTP type while this file legitimately does.
 */
import { Module } from '@nestjs/common';
import { JobsService, type JobQueue, type JobStore } from './jobs.service.js';
import { NullJobStore } from './job.store.js';
import { NullJobQueue } from './job-queue.js';

/** Injection tokens for the two replaceable ports. */
export const JOB_STORE = Symbol('JOB_STORE');
export const JOB_QUEUE = Symbol('JOB_QUEUE');

/**
 * The queue both sides bind to.
 *
 * The producer lives in `backend` and the consumer in `worker`, and the
 * dependency-boundary rule forbids either importing the other — so the name is
 * declared on both sides and asserted against the same literal by
 * `jobs.module.spec.ts` and `worker-bootstrap.spec.ts`. If one moves without
 * the other, one of those two tests fails.
 */
export const GENERATION_QUEUE_NAME = 'generation';

/**
 * Defaults are the null implementations, not the Prisma and BullMQ ones.
 *
 * Deliberate: the API boots and serves without a database or a broker, and a
 * deployment that wants persistence supplies the delegates by overriding these
 * tokens. A default that reached for a live connection would make the module
 * un-bootable in exactly the environment where it is most often started — a
 * test run.
 */
@Module({
  providers: [
    { provide: JOB_STORE, useFactory: (): JobStore => new NullJobStore() },
    { provide: JOB_QUEUE, useFactory: (): JobQueue => new NullJobQueue() },
    {
      provide: JobsService,
      inject: [JOB_STORE, JOB_QUEUE],
      useFactory: (store: JobStore, queue: JobQueue): JobsService =>
        new JobsService(store, queue),
    },
  ],
  exports: [JobsService, JOB_STORE, JOB_QUEUE],
})
export class JobsModule {}
