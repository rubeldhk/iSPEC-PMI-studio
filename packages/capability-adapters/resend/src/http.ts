/**
 * `T2190` (EPIC-039) — one HTTP call to Resend, its failures mapped onto the
 * contract's error categories.
 *
 * | Resend answers | Category |
 * |---|---|
 * | `401`, `403` | `credential-rejected` (except `restricted_api_key` on the probe, read by `health.ts`) |
 * | `422` naming a recipient | `recipient-rejected` |
 * | `429` | `provider-throttled`, with `retry-after` |
 * | `5xx`, a network error | `provider-unavailable` |
 * | an abort | `timed-out` |
 *
 * No message ever carries the key: errors are built from the status and
 * Resend's own `name`, which the Hub sanitises again before storing.
 */
import type { FetchLike } from '@pmi/capability-contract';

export class ResendError extends Error {
  constructor(
    readonly category: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export interface ResendResponse {
  readonly status: number;
  readonly name: string | null;
  readonly body: Record<string, unknown>;
  readonly retryAfterSeconds: number;
}

export async function resendCall(fetch: FetchLike, url: string, init: { method: string; key: string; body?: unknown; idempotencyKey?: string; signal: AbortSignal }): Promise<ResendResponse> {
  const headers: Record<string, string> = { authorization: `Bearer ${init.key}`, 'user-agent': 'pmi-studio' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.idempotencyKey !== undefined) headers['idempotency-key'] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(url, { method: init.method, headers, ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}), signal: init.signal });
  } catch (err) {
    if (init.signal.aborted) throw new ResendError('timed-out', 'Resend did not answer in time');
    throw new ResendError('provider-unavailable', `Resend could not be reached (${err instanceof Error ? err.name : 'network error'})`);
  }
  let body: Record<string, unknown> = {};
  try {
    const parsed = (await res.json()) as unknown;
    if (parsed !== null && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const ra = Number(res.headers.get('retry-after'));
  return { status: res.status, name: typeof body['name'] === 'string' ? (body['name'] as string) : null, body, retryAfterSeconds: Number.isFinite(ra) && ra > 0 ? ra : 1 };
}

/** Throw the contract category for a non-2xx answer. */
export function failFor(res: ResendResponse): never {
  if (res.status === 429) throw new ResendError('provider-throttled', 'Resend rate-limited the request', res.retryAfterSeconds);
  if (res.status === 401 || res.status === 403) throw new ResendError('credential-rejected', `Resend rejected the key (${res.status}${res.name ? ` ${res.name}` : ''})`);
  if (res.status === 422 || res.status === 400) throw new ResendError(res.name === 'validation_error' ? 'recipient-rejected' : 'adapter-fault', `Resend refused the message (${res.status}${res.name ? ` ${res.name}` : ''})`);
  if (res.status === 409) throw new ResendError('adapter-fault', `Resend refused the idempotency key (${res.name ?? '409'})`);
  if (res.status >= 500) throw new ResendError('provider-unavailable', `Resend answered ${res.status}`);
  throw new ResendError('adapter-fault', `Resend answered ${res.status}`);
}
