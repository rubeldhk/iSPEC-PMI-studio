/**
 * `T2199` (EPIC-039, `R-039-18` Decision 4) — `@pmi/capability-adapter-ollama/embedding-module`:
 * the module `EPIC-038`'s `T1282` names in `CONTEXT_EMBEDDING_MODULE`.
 *
 * Its default export returns an object of `EmbeddingPort`'s shape —
 * `modelId`, `dimension`, `embed(texts)` — over `ollama-embed`, configured
 * from `PMI_EMBED_BINDING` (`{ baseUrl?, model }`, default
 * `nomic-embed-text` on loopback). The interface is restated structurally
 * here: this package imports nothing from the backend.
 *
 * It applies the refusals `EPIC-038`'s `embedChecked` applies, and the `Embed`
 * contract's limits before anything is sent (`FR-HUB-083`).
 *
 * `dimension` is the model table's, known synchronously. `modelId` is
 * `ollama-embed:<model>@<digest[0..12]>` once the first call has read the
 * digest, `ollama-embed:<model>` before — the index compares it only to decide
 * whether a source must be re-embedded, so the early form costs one re-embed,
 * never a mixed vector space.
 */
import { createCredentialHandle, type FetchLike } from '@pmi/capability-contract';
import { OllamaEmbedAdapter } from './index.js';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, OLLAMA_MODELS, isOllamaModel } from './models.js';

/** `EPIC-038`'s `EmbeddingPort`, by shape. */
export interface EmbeddingPortShape {
  readonly modelId: string;
  readonly dimension: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export const MAX_TEXTS = 64;
export const MAX_TEXT_LENGTH = 8000;

export interface OllamaEmbeddingOptions {
  readonly baseUrl?: string;
  readonly model?: string;
  /** For an Ollama behind an authenticating proxy. */
  readonly bearerToken?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export function createOllamaEmbeddingPort(options: OllamaEmbeddingOptions = {}): EmbeddingPortShape {
  const model = options.model ?? DEFAULT_OLLAMA_MODEL;
  if (!isOllamaModel(model)) throw new Error(`ollama-embed: the model "${model}" is not in the model table (${Object.keys(OLLAMA_MODELS).join(', ')}); its dimension is unknown, so it is refused rather than probed (FR-HUB-081).`);
  const dimension = OLLAMA_MODELS[model];
  const adapter = new OllamaEmbedAdapter(options.fetch ? { fetch: options.fetch } : {});
  const binding = { baseUrl: options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL, model };
  let digest: string | null = null;

  return {
    get modelId(): string {
      return digest === null ? `ollama-embed:${model}` : `ollama-embed:${model}@${digest.slice(0, 12)}`;
    },
    dimension,
    async embed(texts: readonly string[]): Promise<number[][]> {
      if (texts.length > MAX_TEXTS) throw new Error(`ollama-embed: batch-too-large — ${texts.length} texts, the Embed contract admits ${MAX_TEXTS} (FR-HUB-083)`);
      const tooLong = texts.findIndex((t) => t.length > MAX_TEXT_LENGTH);
      if (tooLong >= 0) throw new Error(`ollama-embed: text-too-long — the text at index ${tooLong} has ${texts[tooLong]!.length} characters, the Embed contract admits ${MAX_TEXT_LENGTH} (FR-HUB-083)`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
      try {
        const result = await adapter.invoke({
          workspaceId: null,
          projectId: null,
          binding,
          credential: options.bearerToken === undefined ? null : createCredentialHandle(options.bearerToken, 'bearer-token'),
          scope: { requested: { access: 'read', resources: ['model.embed'] }, granted: ['ollama:embed'], narrowing: 'exact' },
          signal: controller.signal,
          timeoutMs: options.timeoutMs ?? 60_000,
          capability: 'Embed',
          contractVersion: '1.0',
          input: { texts },
        });
        if (!result.ok) throw new Error(`ollama-embed: ${result.errorCategory} — ${result.message}`);
        const output = result.output as { model: { version: string }; vectors: number[][] };
        const refuse = (why: string): Error => new Error(`ollama-embed: the embedding provider (${model}) ${why} (FR-CTX-013)`);
        if (output.vectors.length !== texts.length) throw refuse(`returned ${output.vectors.length} vectors for ${texts.length} texts`);
        for (const v of output.vectors) {
          if (v.length !== dimension) throw refuse(`returned a vector of dimension ${v.length}, declared ${dimension}`);
          if (!v.every((x) => Number.isFinite(x))) throw refuse('returned a vector with a non-finite component');
          if (v.every((x) => x === 0)) throw refuse('returned a zero vector, which every candidate is equally near');
        }
        digest = output.model.version;
        return output.vectors;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Read `PMI_EMBED_BINDING` — the same non-secret binding the Hub reads at boot. */
function fromEnvironment(): OllamaEmbeddingOptions {
  const raw = process.env['PMI_EMBED_BINDING'];
  if (raw === undefined || raw.trim() === '') return {};
  const parsed = JSON.parse(raw) as { baseUrl?: unknown; model?: unknown };
  return {
    ...(typeof parsed.baseUrl === 'string' ? { baseUrl: parsed.baseUrl } : {}),
    ...(typeof parsed.model === 'string' ? { model: parsed.model } : {}),
  };
}

/** `CONTEXT_EMBEDDING_MODULE`'s contract: a default export returning an `EmbeddingPort`. */
export default function createEmbeddingPort(): EmbeddingPortShape {
  return createOllamaEmbeddingPort(fromEnvironment());
}
