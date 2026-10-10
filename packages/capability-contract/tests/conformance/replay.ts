/**
 * EPIC-039 (`R-039-9`) — recorded provider responses, replayed.
 *
 * Real-adapter tests never touch the network: an adapter takes an injected
 * `FetchLike`, and here that is a replay of a dated recording file. The same
 * recordings can be served over loopback HTTP (`startReplayServer`) for a
 * backend route test that boots the whole application — the adapter's base
 * URL is a non-secret binding, so the composed stack talks to the replay
 * exactly as it would to the provider.
 *
 * An unmatched request answers `599` with the request named, so a test fails
 * loudly instead of passing on a response nobody recorded.
 *
 * Exported as `@pmi/capability-contract/replay`.
 */
import { createServer, type Server } from 'node:http';
import type { FetchLike } from '../../src/adapter.js';

export interface RecordedResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly json?: unknown;
  readonly text?: string;
  readonly bodyBase64?: string;
}

export interface Interaction {
  readonly request: { readonly method: string; readonly path: string };
  readonly response: RecordedResponse;
}

export interface Recording {
  readonly provider: string;
  readonly recordedOn: string;
  readonly provenance: string;
  readonly interactions: readonly Interaction[];
}

export interface SeenRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface ReplayOptions {
  /** Rewrite (or replace) a response before it is served — how a scenario is injected. */
  readonly overlay?: (request: SeenRequest, recorded: RecordedResponse | null) => RecordedResponse | null;
}

function key(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function toResponse(r: RecordedResponse): Response {
  const headers = new Headers(r.headers ?? {});
  let body: string | Buffer | null = null;
  if (r.json !== undefined) {
    body = JSON.stringify(r.json);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  } else if (r.bodyBase64 !== undefined) body = Buffer.from(r.bodyBase64, 'base64');
  else if (r.text !== undefined) body = r.text;
  return new Response(r.status === 204 ? null : body, { status: r.status, headers });
}

export class Replay {
  readonly seen: SeenRequest[] = [];
  private readonly table = new Map<string, RecordedResponse>();

  constructor(
    recordings: readonly Recording[],
    private readonly options: ReplayOptions = {},
  ) {
    for (const rec of recordings) for (const i of rec.interactions) this.table.set(key(i.request.method, i.request.path), i.response);
  }

  /** The response for one request — recorded, overlaid, or the loud 599. */
  respond(request: SeenRequest): RecordedResponse {
    this.seen.push(request);
    const recorded = this.table.get(key(request.method, request.path)) ?? null;
    const served = this.options.overlay ? this.options.overlay(request, recorded) : recorded;
    return served ?? { status: 599, json: { error: `no recorded interaction for ${request.method} ${request.path}` } };
  }

  /** An injected `fetch` for a unit test. `baseUrl` is stripped to find the recorded path. */
  fetch(baseUrl: string): FetchLike {
    return async (url, init) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const path = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : new URL(url).pathname + new URL(url).search;
      const body = typeof init?.body === 'string' ? init.body : init?.body instanceof Uint8Array ? Buffer.from(init.body).toString('utf8') : undefined;
      return toResponse(this.respond({ method: init?.method ?? 'GET', url, path, headers: { ...(init?.headers ?? {}) }, ...(body !== undefined ? { body } : {}) }));
    };
  }
}

/** Serve recordings over loopback HTTP — for a backend route test against the composed stack. */
export async function startReplayServer(replay: Replay): Promise<{ url: string; close(): Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
      const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
      const r = replay.respond({ method: req.method ?? 'GET', url: req.url ?? '/', path: req.url ?? '/', headers, ...(body !== undefined ? { body } : {}) });
      const out: Record<string, string> = { ...(r.headers ?? {}) };
      let payload: Buffer | string = '';
      if (r.json !== undefined) {
        payload = JSON.stringify(r.json);
        out['content-type'] ??= 'application/json';
      } else if (r.bodyBase64 !== undefined) payload = Buffer.from(r.bodyBase64, 'base64');
      else if (r.text !== undefined) payload = r.text;
      res.writeHead(r.status, out);
      res.end(payload);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
