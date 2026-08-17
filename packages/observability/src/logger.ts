/**
 * T158 — structured logging.
 *
 * PP-010 makes logging first-class. Two exclusions are enforced in code rather
 * than left to reviewer discipline (research R-011, contract rule E9):
 *
 *   - **engine output is never logged** — it may carry customer requirements
 *   - **no credential is ever logged**, including inside `diagnostics`
 *
 * Records go to stdout as JSON, which keeps the container contract simple and
 * leaves the collector endpoint a deployment concern rather than a code one
 * (PP-015, no vendor lock-in).
 */

export const REDACTED = '[redacted]';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  workspaceId: string;
  actorId: string | null;
  correlationId: string;
  jobId?: string;
}

/**
 * Keys whose values never reach a log.
 *
 * `contentRaw`/`contentParsed` are engine output. `diagnostics` is the engine's
 * operator-facing detail, which may quote a command line containing a token.
 */
const FORBIDDEN_KEYS = new Set([
  'contentRaw',
  'contentParsed',
  'diagnostics',
  'password',
  'passwordHash',
  'apiKey',
  'token',
  'secret',
  'credential',
  'authorization',
  'cookie',
]);

/** Deep copy with forbidden keys replaced. Does not mutate the input. */
export function redact(value: unknown): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = FORBIDDEN_KEYS.has(k) ? REDACTED : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value) as Record<string, unknown>;
}

export function buildLogRecord(
  level: LogLevel,
  msg: string,
  ctx: LogContext,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  if (!ctx.correlationId) {
    throw new Error(
      'A correlation id is required on every log record — it is what ties API, queue, worker and sandbox together (PC-3).',
    );
  }
  const record: Record<string, unknown> = {
    level,
    msg,
    workspaceId: ctx.workspaceId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    ...redact(fields),
  };
  if (ctx.jobId) record['jobId'] = ctx.jobId;
  return record;
}

export interface Logger {
  log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(
  ctx: LogContext,
  sink: (record: Record<string, unknown>) => void = (r) => console.log(JSON.stringify(r)),
): Logger {
  return {
    log(level, msg, fields = {}) {
      sink(buildLogRecord(level, msg, ctx, fields));
    },
  };
}
