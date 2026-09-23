/**
 * The REST client behind every tool (`R-043-1`, `R-043-5`, `R-043-6`).
 *
 * `pmi-studio` is a translation of the mounted routes and nothing more: this
 * is the only place the platform is spoken to. Every request carries the
 * bearer credential, the contract version, the surface header that makes a
 * registration `mcp-client`, and — on POST — the idempotency key. A 4xx body
 * becomes a structured refusal with the platform's own code; a network failure
 * becomes `platform_unreachable` carrying the host and nothing else.
 *
 * The credential is held here and appears in exactly one place: the
 * `Authorization` header. Never in a result, a message or an error
 * (`FR-PIC-026`).
 */
import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER, IDEMPOTENCY_KEY_HEADER, PMI_SURFACE_HEADER } from '@pmi/execution-registry-contract';
import { INVALID_CREDENTIAL_MESSAGE, sanitise, type Refusal } from './refusals.js';

export interface PlatformCall {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: unknown;
  readonly surface: 'mcp-client';
  readonly idempotencyKey?: string;
  /** FR-PIC-004 — travels as `x-correlation-id` when the request type carries none of its own. */
  readonly correlationId?: string;
}

export type PlatformResult =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false; readonly refusal: Refusal };

/** The port the server is written against; tests supply a stub, `main` the real client. */
export interface PlatformPort {
  call(call: PlatformCall): Promise<PlatformResult>;
  describe(): { address: string; credentialPresent: boolean };
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface PlatformClientOptions {
  readonly baseUrl: string;
  readonly credential: string;
  readonly fetch?: FetchLike;
}

function hostOf(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch {
    return sanitise(baseUrl);
  }
}

export function createPlatformClient(options: PlatformClientOptions): PlatformPort {
  const base = options.baseUrl.replace(/\/+$/, '');
  const credential = options.credential.trim();
  const fetchImpl: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const address = hostOf(base);

  return {
    describe: () => ({ address, credentialPresent: credential.length > 0 }),

    async call(call): Promise<PlatformResult> {
      // An absent credential never reaches the platform: the one refusal, locally.
      if (credential.length === 0) {
        return { ok: false, refusal: { code: 'invalid_connector_credential', message: INVALID_CREDENTIAL_MESSAGE } };
      }
      const headers: Record<string, string> = {
        authorization: `Bearer ${credential}`,
        accept: 'application/json',
        [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION,
        [PMI_SURFACE_HEADER]: call.surface,
      };
      if (call.correlationId !== undefined) headers['x-correlation-id'] = call.correlationId;
      const init: RequestInit = { method: call.method, headers };
      if (call.method === 'POST') {
        headers['content-type'] = 'application/json';
        if (call.idempotencyKey !== undefined) headers[IDEMPOTENCY_KEY_HEADER] = call.idempotencyKey;
        init.body = JSON.stringify(call.body ?? {});
      }

      let response: Response;
      try {
        response = await fetchImpl(`${base}${call.path}`, init);
      } catch {
        return { ok: false, refusal: { code: 'platform_unreachable', message: `PMI Studio at ${address} did not answer.`, address } };
      }

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text.length > 0 ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (response.ok) return { ok: true, status: response.status, body: parsed };

      const error = (parsed as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
      if (error?.code) {
        const details = error.details !== null && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : {};
        const safe: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(details)) safe[k] = typeof v === 'string' ? sanitise(v) : v;
        // The registry's own word wins over the transport's status vocabulary (R-043-5).
        const code = typeof safe['refusal'] === 'string' ? (safe['refusal'] as string) : error.code;
        return { ok: false, refusal: { code, message: sanitise(error.message ?? error.code), ...safe } };
      }
      return {
        ok: false,
        refusal: { code: 'platform_error', message: sanitise(`PMI Studio answered ${response.status}: ${text.slice(0, 200)}`), status: response.status },
      };
    },
  };
}
