/**
 * `@pmi/capability-adapter-resend` (EPIC-039, `R-039-9`) — `resend-email`:
 * `SendNotification` over the Resend API. The only code that names Resend.
 *
 * Never throws: every failure is a result with a contract error category.
 * HTTP is an injected `FetchLike`, Node's global `fetch` by default — tests
 * inject a replay of recorded responses.
 */
import type { AdapterCall, AdapterContext, AdapterDescriptor, AdapterResult, CapabilityAdapter, FetchLike, HealthObservation } from '@pmi/capability-contract';
import { RESEND_API, RESEND_DESCRIPTOR } from './descriptor.js';
import { probe } from './health.js';
import { ResendError } from './http.js';
import { send, type SendInput } from './send.js';

export { RESEND_DESCRIPTOR, RESEND_ADAPTER_VERSION } from './descriptor.js';

export interface ResendOptions {
  readonly fetch?: FetchLike;
  readonly clock?: () => Date;
}

function isSendInput(v: unknown): v is SendInput {
  if (v === null || typeof v !== 'object') return false;
  const i = v as Record<string, unknown>;
  return Array.isArray(i['recipients']) && typeof i['subject'] === 'string' && typeof i['idempotencyKey'] === 'string' && i['body'] !== null && typeof i['body'] === 'object' && typeof (i['body'] as Record<string, unknown>)['text'] === 'string';
}

export class ResendEmailAdapter implements CapabilityAdapter {
  readonly descriptor: AdapterDescriptor = RESEND_DESCRIPTOR;
  private readonly fetch: FetchLike;
  private readonly clock: () => Date;

  constructor(options: ResendOptions = {}) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init as RequestInit));
    this.clock = options.clock ?? ((): Date => new Date());
  }

  private base(ctx: AdapterContext): string {
    const configured = ctx.binding['apiBaseUrl'];
    return typeof configured === 'string' && configured.length > 0 ? configured.replace(/\/$/, '') : RESEND_API;
  }

  private async withKey<T>(ctx: AdapterContext, fn: (key: string) => Promise<T>): Promise<T> {
    if (ctx.credential === null) throw new ResendError('credential-rejected', 'resend-email needs a key, and none is set for this project');
    return ctx.credential.use(fn);
  }

  async invoke(call: AdapterCall): Promise<AdapterResult> {
    try {
      if (call.capability !== 'SendNotification') return { ok: false, errorCategory: 'adapter-fault', message: `resend-email does not implement ${call.capability}` };
      const from = call.binding['from'];
      if (typeof from !== 'string' || from.length < 3) return { ok: false, errorCategory: 'adapter-fault', message: 'resend-email needs a binding { from: "Name <address>" }' };
      if (!isSendInput(call.input)) return { ok: false, errorCategory: 'adapter-fault', message: 'SendNotification needs recipients, a subject, a body and an idempotency key' };
      const input = call.input;
      return await this.withKey(call, (key) => send(this.fetch, this.base(call), key, from, input, call.signal, this.clock));
    } catch (err) {
      if (err instanceof ResendError) return { ok: false, errorCategory: err.category, message: err.message, ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) };
      return { ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'resend-email fault' };
    }
  }

  async checkHealth(ctx: AdapterContext): Promise<HealthObservation> {
    try {
      return await this.withKey(ctx, (key) => probe(this.fetch, this.base(ctx), key, ctx.signal));
    } catch (err) {
      if (err instanceof ResendError && err.category === 'credential-rejected') return { state: 'unhealthy', reason: 'credential-missing' };
      return { state: 'unhealthy', reason: 'provider-unreachable' };
    }
  }
}
