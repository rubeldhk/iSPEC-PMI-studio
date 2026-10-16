/**
 * `T2190` (EPIC-039, `R-039-6`, `FR-HUB-034`) — the health probe, one request:
 * `GET /domains`.
 *
 * | Resend answers | Health |
 * |---|---|
 * | `401 restricted_api_key` | healthy, `narrowed-at-issue` — a sending-only key |
 * | `200` | healthy, `not-narrowable` — a full-access key |
 * | any other `401`/`403` | unhealthy, `credential-rejected` |
 * | `429` | degraded, `provider-throttled` |
 * | `5xx`, unreachable | unhealthy |
 */
import type { FetchLike, HealthObservation } from '@pmi/capability-contract';
import { ResendError, resendCall } from './http.js';

export async function probe(fetch: FetchLike, base: string, key: string, signal: AbortSignal): Promise<HealthObservation> {
  try {
    const res = await resendCall(fetch, `${base}/domains`, { method: 'GET', key, signal });
    if (res.status === 401 && res.name === 'restricted_api_key') return { state: 'healthy', narrowing: 'narrowed-at-issue' };
    if (res.status >= 200 && res.status < 300) return { state: 'healthy', narrowing: 'not-narrowable' };
    if (res.status === 401 || res.status === 403) return { state: 'unhealthy', reason: 'credential-rejected', detail: `Resend answered ${res.status}${res.name ? ` ${res.name}` : ''}` };
    if (res.status === 429) return { state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: res.retryAfterSeconds };
    return { state: 'unhealthy', reason: 'provider-error', detail: `Resend answered ${res.status}` };
  } catch (err) {
    if (err instanceof ResendError && err.category === 'timed-out') return { state: 'unhealthy', reason: 'timed-out' };
    return { state: 'unhealthy', reason: 'provider-unreachable' };
  }
}
