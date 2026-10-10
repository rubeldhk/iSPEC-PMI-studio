/**
 * `T2138` (EPIC-039, `R-039-6`) — the `Ticker` port.
 *
 * Nothing periodic existed in the repository: `jobs/` is on-demand BullMQ, and
 * its queue is optional (`jobs.module.ts` binds a `NullJobQueue` without
 * `VALKEY_URL`), so a health interval built on it would silently never run on a
 * local stack — and "stale reads unknown" would hide that. This is the smallest
 * honest mechanism: an unref'd timer started in `OnModuleInit` and stopped on
 * destroy, a manual binding for tests, and `off` for every test process.
 */
export interface Ticker {
  start(everyMs: number, fn: () => Promise<void>): void;
  stop(): void;
  /** Live timer handles — empty for the manual and disabled bindings. */
  handles(): NodeJS.Timeout[];
}

export class TimerTicker implements Ticker {
  private readonly timers: NodeJS.Timeout[] = [];

  start(everyMs: number, fn: () => Promise<void>): void {
    let busy = false;
    const timer = setInterval(() => {
      if (busy) return; // a slow tick is skipped, never stacked
      busy = true;
      fn()
        .catch(() => undefined) // one failed tick must not stop the interval; its own records say why
        .finally(() => {
          busy = false;
        });
    }, everyMs);
    timer.unref();
    this.timers.push(timer);
  }

  stop(): void {
    for (const t of this.timers.splice(0)) clearInterval(t);
  }

  handles(): NodeJS.Timeout[] {
    return [...this.timers];
  }
}

/** Tests drive time; nothing runs until `advance()`. */
export class ManualTicker implements Ticker {
  private jobs: (() => Promise<void>)[] = [];

  start(_everyMs: number, fn: () => Promise<void>): void {
    this.jobs.push(fn);
  }

  stop(): void {
    this.jobs = [];
  }

  handles(): NodeJS.Timeout[] {
    return [];
  }

  async advance(): Promise<void> {
    for (const fn of [...this.jobs]) await fn();
  }
}

/**
 * `PMI_INTEGRATION_SCHEDULER=off` — every test process sets it — starts nothing;
 * `manual` binds the `ManualTicker`, which a route test advances through the
 * `INTEGRATIONS_TICKER` token (the job handler driven as production drives it).
 */
export class DisabledTicker implements Ticker {
  start(): void {}
  stop(): void {}
  handles(): NodeJS.Timeout[] {
    return [];
  }
}

export function tickerFromEnvironment(env: Readonly<Record<string, string | undefined>>): Ticker {
  const mode = env['PMI_INTEGRATION_SCHEDULER'];
  if (mode === 'off') return new DisabledTicker();
  if (mode === 'manual') return new ManualTicker();
  return new TimerTicker();
}
