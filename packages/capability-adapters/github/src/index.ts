/**
 * `@pmi/capability-adapter-github` (EPIC-039, `R-039-9`) — `github-rest`:
 * `ReadRepository`, `ReadBuildStatus` and `ReadTestResults` over the GitHub
 * REST API (version header `2022-11-28`). The only code that names GitHub.
 *
 * Never throws (the storage-contract rule): every failure becomes a result with
 * a contract error category. HTTP is an injected `FetchLike`, Node's global
 * `fetch` by default — tests inject a replay of recorded responses.
 */
import type { AdapterCall, AdapterContext, AdapterDescriptor, AdapterResult, CapabilityAdapter, FetchLike, HealthObservation } from '@pmi/capability-contract';
import { GITHUB_API, GitHubAuth, GitHubError } from './auth.js';
import { GITHUB_DESCRIPTOR } from './descriptor.js';
import { githubGet } from './http.js';
import { readBuildStatus } from './read-build-status.js';
import { readRepository, type ReadContext } from './read-repository.js';
import { readTestResults } from './read-test-results.js';

export { GITHUB_DESCRIPTOR } from './descriptor.js';
export { GitHubAuth, appJwt, permissionsFor } from './auth.js';
export { parseJUnitArtifact, MAX_EXPANDED_BYTES, MAX_TEST_NAMES } from './read-test-results.js';

export interface GitHubRestOptions {
  readonly fetch?: FetchLike;
  readonly clock?: () => Date;
}

const FULL_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

export class GitHubRestAdapter implements CapabilityAdapter {
  readonly descriptor: AdapterDescriptor = GITHUB_DESCRIPTOR;
  private readonly fetch: FetchLike;
  private readonly clock: () => Date;
  private readonly auths = new Map<string, GitHubAuth>();

  constructor(options: GitHubRestOptions = {}) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init as RequestInit));
    this.clock = options.clock ?? ((): Date => new Date());
  }

  private base(ctx: AdapterContext): string {
    const configured = ctx.binding['apiBaseUrl'];
    return typeof configured === 'string' && configured.length > 0 ? configured.replace(/\/$/, '') : GITHUB_API;
  }

  private auth(base: string): GitHubAuth {
    let a = this.auths.get(base);
    if (a === undefined) {
      a = new GitHubAuth({ fetch: this.fetch, clock: this.clock, apiBaseUrl: base });
      this.auths.set(base, a);
    }
    return a;
  }

  private async readContext(ctx: AdapterContext): Promise<ReadContext & { narrowing: 'exact' | 'not-narrowable' }> {
    const repository = ctx.binding['repository'];
    if (typeof repository !== 'string' || !repository.includes('/')) throw new GitHubError('adapter-fault', 'github-rest needs a binding { repository: "owner/name" }');
    if (ctx.credential === null) throw new GitHubError('credential-rejected', 'github-rest needs a credential, and none is set for this project');
    const base = this.base(ctx);
    const token = await this.auth(base).token(ctx.credential, { granted: ctx.scope.granted, repository }, ctx.signal);
    return { fetch: this.fetch, base, repository, bearer: token.bearer, signal: ctx.signal, now: this.clock(), narrowing: token.narrowing };
  }

  async invoke(call: AdapterCall): Promise<AdapterResult> {
    try {
      const input = (call.input ?? {}) as { revision?: unknown; mode?: unknown; paths?: unknown };
      if (typeof input.revision !== 'string') return { ok: false, errorCategory: 'adapter-fault', message: 'the input names no revision' };
      const ctx = await this.readContext(call);
      switch (call.capability) {
        case 'ReadRepository':
          if (input.mode !== 'tree' && input.mode !== 'files') return { ok: false, errorCategory: 'adapter-fault', message: 'mode must be tree or files' };
          return await readRepository(ctx, { revision: input.revision, mode: input.mode, ...(Array.isArray(input.paths) ? { paths: input.paths as string[] } : {}) });
        case 'ReadBuildStatus':
          if (!FULL_SHA.test(input.revision)) return { ok: false, errorCategory: 'revision-not-found', message: 'ReadBuildStatus needs a full commit id' };
          return await readBuildStatus(ctx, input.revision);
        case 'ReadTestResults': {
          if (!FULL_SHA.test(input.revision)) return { ok: false, errorCategory: 'revision-not-found', message: 'ReadTestResults needs a full commit id' };
          const name = typeof call.binding['artifactName'] === 'string' ? (call.binding['artifactName'] as string) : 'test-results';
          return await readTestResults(ctx, input.revision, name);
        }
        default:
          return { ok: false, errorCategory: 'adapter-fault', message: `github-rest does not implement ${call.capability}` };
      }
    } catch (err) {
      if (err instanceof GitHubError) return { ok: false, errorCategory: err.category, message: err.message, ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) };
      return { ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'github-rest fault' };
    }
  }

  /** One request: `GET /repos/{owner}/{repo}` with the narrowed token. */
  async checkHealth(ctx: AdapterContext): Promise<HealthObservation> {
    try {
      const rc = await this.readContext(ctx);
      const res = await githubGet(rc.fetch, `${rc.base}/repos/${rc.repository}`, rc.bearer, rc.signal, rc.now);
      if (res.status === 200) return { state: 'healthy', narrowing: rc.narrowing };
      if (res.status === 404) return { state: 'unhealthy', reason: 'binding-invalid', detail: `the bound repository ${rc.repository} is not visible to the credential` };
      return { state: 'unhealthy', reason: 'provider-error', detail: `GitHub answered ${res.status}` };
    } catch (err) {
      if (err instanceof GitHubError) {
        if (err.category === 'credential-rejected') return { state: 'unhealthy', reason: 'credential-rejected', detail: err.message };
        if (err.category === 'provider-throttled') return { state: 'degraded', reason: 'provider-throttled', ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) };
        if (err.category === 'timed-out') return { state: 'unhealthy', reason: 'timed-out' };
        if (err.category === 'adapter-fault') return { state: 'unhealthy', reason: 'binding-invalid', detail: err.message };
      }
      return { state: 'unhealthy', reason: 'provider-unreachable' };
    }
  }
}
