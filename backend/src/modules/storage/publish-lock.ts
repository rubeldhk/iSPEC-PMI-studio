/**
 * T394 (the prevention half) — FR-PUB-040: two concurrent publishes of one
 * project are PREVENTED, not queued.
 *
 * The in-memory lock serves single-process deployments and tests; the
 * advisory lock rides PostgreSQL's `pg_try_advisory_lock` over a hash of the
 * project id, so two API processes contend on the same lock the moment they
 * share a database (R-002-6).
 */

export interface PublishLock {
  /** True = acquired. False = a publish is already running — refuse, do not wait. */
  acquire(projectId: string): Promise<boolean>;
  release(projectId: string): Promise<void>;
}

export class InMemoryPublishLock implements PublishLock {
  private readonly held = new Set<string>();

  async acquire(projectId: string): Promise<boolean> {
    if (this.held.has(projectId)) return false;
    this.held.add(projectId);
    return true;
  }

  async release(projectId: string): Promise<void> {
    this.held.delete(projectId);
  }
}

/** One SQL seam — a session-scoped connection that can run parameterised SQL. */
export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>>;
}

export class AdvisoryPublishLock implements PublishLock {
  constructor(private readonly sql: SqlExecutor) {}

  async acquire(projectId: string): Promise<boolean> {
    // try — never wait: FR-PUB-040 prevents, it does not queue.
    const rows = await this.sql.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [
      projectId,
    ]);
    return rows[0]?.['locked'] === true;
  }

  async release(projectId: string): Promise<void> {
    await this.sql.query('SELECT pg_advisory_unlock(hashtext($1))', [projectId]);
  }
}
