/**
 * `T2157` (EPIC-039, `R-039-9`) — one HTTP call to GitHub's REST API, its
 * failures mapped onto the contract's error categories.
 *
 * | GitHub answers | Category |
 * |---|---|
 * | `401` | `credential-rejected` |
 * | `403`/`429` with `retry-after` or `x-ratelimit-remaining: 0` | `provider-throttled`, with the hint |
 * | `404` | `not-found` (callers refine it) |
 * | `422` on a commit | `revision-not-found` (callers decide) |
 * | `5xx`, a network error | `provider-unavailable` |
 * | an abort | `timed-out` |
 *
 * No message ever carries the token: errors are built from status codes and
 * GitHub's own `message`, which the Hub sanitises again before storing.
 */
import type { FetchLike } from '@pmi/capability-contract';
import { API_VERSION, GitHubError } from './auth.js';

export interface GitHubResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly requestId: string | undefined;
  json(): Promise<unknown>;
  bytes(): Promise<Uint8Array>;
}

export function retryAfter(headers: Headers, now: Date): number {
  const ra = headers.get('retry-after');
  if (ra !== null && Number.isFinite(Number(ra))) return Math.max(1, Number(ra));
  const reset = headers.get('x-ratelimit-reset');
  if (reset !== null && Number.isFinite(Number(reset))) return Math.max(1, Number(reset) - Math.floor(now.getTime() / 1000));
  return 60;
}

export async function githubGet(fetch: FetchLike, url: string, bearer: string, signal: AbortSignal, now: Date, accept = 'application/vnd.github+json'): Promise<GitHubResponse> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers: { accept, authorization: `Bearer ${bearer}`, 'x-github-api-version': API_VERSION, 'user-agent': 'pmi-studio' }, signal });
  } catch (err) {
    if (signal.aborted) throw new GitHubError('timed-out', 'GitHub did not answer in time');
    throw new GitHubError('provider-unavailable', `GitHub could not be reached (${err instanceof Error ? err.name : 'network error'})`);
  }
  const requestId = res.headers.get('x-github-request-id') ?? undefined;
  if (res.status === 401) throw new GitHubError('credential-rejected', 'GitHub rejected the credential (401)');
  if ((res.status === 403 || res.status === 429) && (res.headers.get('retry-after') !== null || res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429)) {
    throw new GitHubError('provider-throttled', 'GitHub rate-limited the request', retryAfter(res.headers, now));
  }
  if (res.status === 403) throw new GitHubError('credential-rejected', 'GitHub refused the request with the granted permissions (403)');
  if (res.status >= 500) throw new GitHubError('provider-unavailable', `GitHub answered ${res.status}`);
  return {
    status: res.status,
    headers: res.headers,
    requestId,
    json: () => res.json() as Promise<unknown>,
    bytes: async () => new Uint8Array(await res.arrayBuffer()),
  };
}
