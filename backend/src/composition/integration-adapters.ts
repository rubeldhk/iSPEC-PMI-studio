/**
 * `T2136`, `T2160`, `T2190`, `T2197` (EPIC-039, `R-039-1`) — the adapter
 * catalog, composed.
 *
 * **The one backend file that imports a capability adapter package**, on the
 * precedent of `composition/governed-loop.ts`. Everything else in `backend/src`
 * asks for a capability and never learns who serves it;
 * `tests/architecture/capability-independence.spec.ts` fails the build if any
 * other file imports an adapter or names a provider (`FR-HUB-061`).
 *
 * Adapters here are runtime dependencies of the backend (the callers are
 * backend workflows) — the deliberate divergence from engine and agent
 * adapters, which are composed in the worker (`R-039-1`).
 */
import { FixtureCiAdapter, FixtureEmbedAdapter, FixtureGitAdapter, FixtureNotifyAdapter } from '@pmi/capability-adapter-fixture';
import { GitHubRestAdapter } from '@pmi/capability-adapter-github';
import { OllamaEmbedAdapter } from '@pmi/capability-adapter-ollama';
import { ResendEmailAdapter } from '@pmi/capability-adapter-resend';
import { AdapterCatalog } from '../modules/integrations/catalog.service.js';

export interface CatalogOptions {
  /** Injected HTTP for the real adapters; Node's global `fetch` by default. */
  readonly fetch?: typeof fetch;
}

export function createAdapterCatalog(options: CatalogOptions = {}): AdapterCatalog {
  const fetchLike = options.fetch;
  return new AdapterCatalog([
    new FixtureGitAdapter(),
    new FixtureCiAdapter(),
    new FixtureNotifyAdapter(),
    new FixtureEmbedAdapter(),
    new GitHubRestAdapter(fetchLike ? { fetch: (url, init) => fetchLike(url, init as RequestInit) } : {}),
    new ResendEmailAdapter(fetchLike ? { fetch: (url, init) => fetchLike(url, init as RequestInit) } : {}),
    new OllamaEmbedAdapter(fetchLike ? { fetch: (url, init) => fetchLike(url, init as RequestInit) } : {}),
  ]);
}
