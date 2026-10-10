/**
 * `T2197` (EPIC-039, `R-039-18`) — the two Ollama calls `ollama-embed` makes,
 * their failures mapped onto the contract's error categories.
 *
 * | Ollama answers | Category |
 * |---|---|
 * | `404` on `/api/embed`, or the model absent from `/api/tags` | `model-not-present` |
 * | `401`/`403` (an authenticating proxy) | `credential-rejected` |
 * | `429`, or `503` with `retry-after` | `provider-throttled` |
 * | `5xx`, a network error | `provider-unavailable` |
 * | an abort | `timed-out` |
 */
import type { FetchLike } from '@pmi/capability-contract';
import { tagMatches } from './models.js';

export class OllamaError extends Error {
  constructor(
    readonly category: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export interface OllamaCall {
  readonly fetch: FetchLike;
  readonly base: string;
  readonly bearer: string | null;
  readonly signal: AbortSignal;
}

async function call(c: OllamaCall, method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (c.bearer !== null) headers['authorization'] = `Bearer ${c.bearer}`;
  let res: Response;
  try {
    res = await c.fetch(`${c.base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: c.signal });
  } catch (err) {
    if (c.signal.aborted) throw new OllamaError('timed-out', 'Ollama did not answer in time');
    throw new OllamaError('provider-unavailable', `Ollama could not be reached (${err instanceof Error ? err.name : 'network error'})`);
  }
  if (res.status === 401 || res.status === 403) throw new OllamaError('credential-rejected', `the server in front of Ollama refused the credential (${res.status})`);
  const ra = Number(res.headers.get('retry-after'));
  if (res.status === 429 || (res.status === 503 && Number.isFinite(ra) && ra > 0)) throw new OllamaError('provider-throttled', 'Ollama is busy', Number.isFinite(ra) && ra > 0 ? ra : 1);
  if (res.status >= 500) throw new OllamaError('provider-unavailable', `Ollama answered ${res.status}`);
  return res;
}

/** The bound model's weights digest from `GET /api/tags`, or `model-not-present`. */
export async function modelDigest(c: OllamaCall, model: string): Promise<string> {
  const res = await call(c, 'GET', '/api/tags');
  if (res.status !== 200) throw new OllamaError('provider-unavailable', `Ollama answered ${res.status} to /api/tags`);
  const body = (await res.json()) as { models?: { name?: string; digest?: string }[] };
  const hit = (body.models ?? []).find((m) => typeof m.name === 'string' && tagMatches(m.name, model));
  if (hit === undefined || typeof hit.digest !== 'string' || hit.digest.length === 0) throw new OllamaError('model-not-present', `the model ${model} is not present on the Ollama server (pull it first)`);
  return hit.digest;
}

/** `POST /api/embed` with the whole batch as `input`. */
export async function embedBatch(c: OllamaCall, model: string, texts: readonly string[]): Promise<number[][]> {
  const res = await call(c, 'POST', '/api/embed', { model, input: texts });
  if (res.status === 404) throw new OllamaError('model-not-present', `the model ${model} is not present on the Ollama server (pull it first)`);
  if (res.status !== 200) throw new OllamaError('adapter-fault', `Ollama answered ${res.status} to /api/embed`);
  const body = (await res.json()) as { embeddings?: unknown };
  if (!Array.isArray(body.embeddings)) throw new OllamaError('adapter-fault', 'Ollama answered /api/embed without embeddings');
  return body.embeddings as number[][];
}
