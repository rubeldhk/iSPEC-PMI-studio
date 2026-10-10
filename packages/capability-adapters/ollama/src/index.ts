/**
 * `@pmi/capability-adapter-ollama` (EPIC-039, `R-039-18`) — `ollama-embed`:
 * `Embed` over a local Ollama model server. The only code that names Ollama.
 *
 * Never throws: every failure is a result with a contract error category.
 * HTTP is an injected `FetchLike`, Node's global `fetch` by default — tests
 * inject a replay of recorded responses.
 */
import type { AdapterCall, AdapterContext, AdapterDescriptor, AdapterResult, CapabilityAdapter, FetchLike, HealthObservation } from '@pmi/capability-contract';
import { OLLAMA_DESCRIPTOR } from './descriptor.js';
import { OllamaError, embedBatch, modelDigest, type OllamaCall } from './embed.js';
import { probe } from './health.js';
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_MODELS, isOllamaModel } from './models.js';

export { OLLAMA_DESCRIPTOR, OLLAMA_ADAPTER_VERSION } from './descriptor.js';
export { OLLAMA_MODELS, DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, isOllamaModel, type OllamaModel } from './models.js';

export interface OllamaOptions {
  readonly fetch?: FetchLike;
}

export class OllamaEmbedAdapter implements CapabilityAdapter {
  readonly descriptor: AdapterDescriptor = OLLAMA_DESCRIPTOR;
  private readonly fetch: FetchLike;

  constructor(options: OllamaOptions = {}) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init as RequestInit));
  }

  private base(ctx: AdapterContext): string {
    const configured = ctx.binding['baseUrl'];
    return typeof configured === 'string' && configured.length > 0 ? configured.replace(/\/$/, '') : DEFAULT_OLLAMA_BASE_URL;
  }

  /** The call context — the bearer token is read from the handle only when one is bound. */
  private async withCall<T>(ctx: AdapterContext, fn: (c: OllamaCall) => Promise<T>): Promise<T> {
    const c = { fetch: this.fetch, base: this.base(ctx), signal: ctx.signal };
    if (ctx.credential === null) return fn({ ...c, bearer: null });
    return ctx.credential.use((token) => fn({ ...c, bearer: token }));
  }

  async invoke(call: AdapterCall): Promise<AdapterResult> {
    try {
      if (call.capability !== 'Embed') return { ok: false, errorCategory: 'adapter-fault', message: `ollama-embed does not implement ${call.capability}` };
      const model = call.binding['model'];
      if (!isOllamaModel(model)) return { ok: false, errorCategory: 'adapter-fault', message: `the bound model ${String(model)} is not in ollama-embed's model table; its dimension is unknown, so it is refused rather than probed (FR-HUB-081)` };
      const input = call.input as { texts?: unknown } | null;
      if (input === null || typeof input !== 'object' || !Array.isArray(input.texts) || !input.texts.every((t) => typeof t === 'string')) {
        return { ok: false, errorCategory: 'adapter-fault', message: 'Embed needs texts: string[]' };
      }
      const texts = input.texts as string[];
      return await this.withCall(call, async (c) => {
        const version = await modelDigest(c, model);
        const vectors = await embedBatch(c, model, texts);
        return { ok: true as const, output: { model: { id: model, version, dimension: OLLAMA_MODELS[model] }, vectors } };
      });
    } catch (err) {
      if (err instanceof OllamaError) return { ok: false, errorCategory: err.category, message: err.message, ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) };
      return { ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'ollama-embed fault' };
    }
  }

  async checkHealth(ctx: AdapterContext): Promise<HealthObservation> {
    const model = ctx.binding['model'];
    if (!isOllamaModel(model)) return { state: 'unhealthy', reason: 'model-not-listed', detail: `${String(model)} is not in ollama-embed's model table` };
    try {
      return await this.withCall(ctx, (c) => probe(c, model));
    } catch {
      return { state: 'unhealthy', reason: 'provider-unreachable' };
    }
  }
}
