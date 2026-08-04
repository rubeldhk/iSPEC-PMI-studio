/**
 * T160 — correlation identifier: generation, inbound reuse, and queue transport.
 *
 * One id, generated once at the API edge, carried across four hops:
 *
 *   API edge  ->  BullMQ payload  ->  worker  ->  sandbox (env var)
 *
 * It is CARRIED, never regenerated — regenerating at any hop would break the
 * trace exactly where it is most useful (PC-3).
 */
import { randomUUID } from 'node:crypto';

export const CORRELATION_HEADER = 'x-correlation-id';
export const CORRELATION_FIELD = 'correlationId';

const VALID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newCorrelationId(): string {
  return randomUUID();
}

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && VALID.test(value);
}

/**
 * Reuse an inbound id so a trace spans the caller too — but only if it is
 * well-formed. An unvalidated header is an injection point into every log line
 * and trace the request touches.
 */
export function correlationFromHeaders(headers: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === CORRELATION_HEADER && isValidCorrelationId(v)) return v;
  }
  return newCorrelationId();
}

export function attachCorrelation<T extends Record<string, unknown>>(
  payload: T,
  correlationId: string,
): T & { correlationId: string } {
  if (!isValidCorrelationId(correlationId)) {
    throw new Error('Refusing to attach a malformed correlation id to a job payload.');
  }
  return { ...payload, [CORRELATION_FIELD]: correlationId };
}

export function extractCorrelation(payload: Record<string, unknown>): string {
  const id = payload[CORRELATION_FIELD];
  if (!isValidCorrelationId(id)) {
    throw new Error(
      'Job payload has no valid correlation id. The API edge must attach one before enqueueing (PC-3).',
    );
  }
  return id;
}
