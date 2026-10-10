/**
 * `T2359` (EPIC-048) — the schedule for the learning sweeps.
 *
 * **Off unless the deployment turns it on** (`PMI_LEARNING_SWEEPS=on`). A
 * deviation from the plan, recorded in the closing report: the composed
 * application is booted by dozens of integration suites, and a sweep firing in
 * the background of a test that is asserting a candidate's state is a race the
 * test did not ask for. The jobs are the real entry points either way — tests
 * drive them through `LearningJobs.run`, a deployment through this schedule.
 *
 * Timers are `unref`'d and cleared on shutdown, so the schedule never keeps a
 * process alive by itself.
 */
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { LEARNING_JOB_INTERVALS_MS, LEARNING_JOB_NAMES, type LearningJobs } from './learning.jobs.js';

export class LearningSweeps implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly timers: ReturnType<typeof setInterval>[] = [];
  private readonly running = new Set<string>();

  constructor(
    private readonly jobs: Pick<LearningJobs, 'run'>,
    private readonly enabled: boolean = process.env['PMI_LEARNING_SWEEPS'] === 'on',
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    for (const name of LEARNING_JOB_NAMES) {
      const timer = setInterval(() => {
        // One run of a job at a time: a slow sweep is skipped, never stacked.
        if (this.running.has(name)) return;
        this.running.add(name);
        void this.jobs
          .run(name)
          .catch(() => undefined)
          .finally(() => this.running.delete(name));
      }, LEARNING_JOB_INTERVALS_MS[name]);
      timer.unref?.();
      this.timers.push(timer);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.splice(0)) clearInterval(timer);
  }

  get scheduled(): number {
    return this.timers.length;
  }
}
