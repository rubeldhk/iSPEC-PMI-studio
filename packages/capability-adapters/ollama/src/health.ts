/**
 * `T2197` (EPIC-039, `R-039-18`) — the health probe, one request:
 * `GET /api/tags`. Healthy when the bound model is present (its digest is the
 * observed `modelVersion`, `FR-HUB-082`); `unhealthy: model-not-present` when
 * absent. A digest differing from the boot observation is detected by the Hub's
 * deployment binding, which compares versions — the adapter reports what it sees.
 */
import type { HealthObservation } from '@pmi/capability-contract';
import { OllamaError, modelDigest, type OllamaCall } from './embed.js';

export async function probe(c: OllamaCall, model: string): Promise<HealthObservation> {
  try {
    return { state: 'healthy', modelVersion: await modelDigest(c, model) };
  } catch (err) {
    if (err instanceof OllamaError) {
      if (err.category === 'model-not-present') return { state: 'unhealthy', reason: 'model-not-present', detail: err.message };
      if (err.category === 'credential-rejected') return { state: 'unhealthy', reason: 'credential-rejected', detail: err.message };
      if (err.category === 'provider-throttled') return { state: 'degraded', reason: 'provider-throttled', ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) };
      if (err.category === 'timed-out') return { state: 'unhealthy', reason: 'timed-out' };
      if (err.category === 'provider-unavailable' && /answered/.test(err.message)) return { state: 'unhealthy', reason: 'provider-error', detail: err.message };
    }
    return { state: 'unhealthy', reason: 'provider-unreachable' };
  }
}
