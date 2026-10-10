/**
 * `T2155` (EPIC-039, `R-039-9`, `FR-HUB-034`) — GitHub authentication, narrowed
 * per request.
 *
 * - **`github-app-installation`** — `{ appId, installationId, privateKeyPem }`.
 *   The adapter signs an app JWT (RS256 with `node:crypto`; no Octokit) and
 *   mints an installation token with `permissions` limited to exactly what the
 *   resolver granted and `repositories` limited to the bound repository
 *   (`POST /app/installations/{id}/access_tokens`). Narrowing: `exact`.
 *   Tokens are cached per (installation, permission set, repository) until five
 *   minutes before `expires_at`.
 * - **`github-token`** — a classic or fine-grained token, used as given. The
 *   platform cannot narrow it: `not-narrowable`.
 *
 * The credential's value is read only inside `handle.use()`, for the one call.
 */
import { createSign } from 'node:crypto';
import type { CredentialHandle, FetchLike } from '@pmi/capability-contract';

export const GITHUB_API = 'https://api.github.com';
export const API_VERSION = '2022-11-28';

export class GitHubError extends Error {
  constructor(
    readonly category: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export function appJwt(appId: string, privateKeyPem: string, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000) - 60; // clock drift allowance GitHub recommends
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 540, iss: appId })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKeyPem).toString('base64url')}`;
}

/** `contents:read` → `{ contents: 'read' }`. Nothing granted → metadata only, never "everything". */
export function permissionsFor(granted: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of granted) {
    const [name, level] = g.split(':');
    if (name && level) out[name] = level;
  }
  return Object.keys(out).length === 0 ? { metadata: 'read' } : out;
}

export interface BearerToken {
  readonly bearer: string;
  readonly narrowing: 'exact' | 'not-narrowable';
}

interface AppCredential {
  appId: string;
  installationId: string;
  privateKeyPem: string;
}

export interface GitHubAuthOptions {
  readonly fetch: FetchLike;
  readonly clock: () => Date;
  readonly apiBaseUrl: string;
}

export class GitHubAuth {
  private readonly cache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly options: GitHubAuthOptions) {}

  async token(credential: CredentialHandle, scope: { granted: readonly string[]; repository: string }, signal?: AbortSignal): Promise<BearerToken> {
    if (credential.kind === 'github-token') {
      return credential.use((value) => ({ bearer: value, narrowing: 'not-narrowable' as const }));
    }
    if (credential.kind !== 'github-app-installation') throw new GitHubError('credential-rejected', `github-rest cannot use a ${credential.kind} credential`);
    const app = await credential.use((value) => {
      try {
        const parsed = JSON.parse(value) as Partial<AppCredential>;
        if (!parsed.appId || !parsed.installationId || !parsed.privateKeyPem) throw new Error('incomplete');
        return parsed as AppCredential;
      } catch {
        throw new GitHubError('credential-rejected', 'the GitHub App credential must be { appId, installationId, privateKeyPem }');
      }
    });
    const permissions = permissionsFor(scope.granted);
    const repositoryName = scope.repository.split('/')[1] ?? scope.repository;
    const key = `${app.installationId}|${Object.entries(permissions).sort().map(([k, v]) => `${k}:${v}`).join(',')}|${repositoryName}`;
    const now = this.options.clock().getTime();
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt - 5 * 60_000 > now) return { bearer: cached.token, narrowing: 'exact' };

    let jwt: string;
    try {
      jwt = appJwt(String(app.appId), app.privateKeyPem, this.options.clock());
    } catch {
      throw new GitHubError('credential-rejected', 'the GitHub App private key could not sign a token');
    }
    const res = await this.options.fetch(`${this.options.apiBaseUrl}/app/installations/${encodeURIComponent(String(app.installationId))}/access_tokens`, {
      method: 'POST',
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${jwt}`, 'x-github-api-version': API_VERSION, 'content-type': 'application/json', 'user-agent': 'pmi-studio' },
      body: JSON.stringify({ permissions, repositories: [repositoryName] }),
      ...(signal ? { signal } : {}),
    });
    if (res.status === 401 || res.status === 404) throw new GitHubError('credential-rejected', `GitHub refused the app installation credential (${res.status})`);
    if (res.status === 403 || res.status === 429) throw new GitHubError('provider-throttled', 'GitHub throttled the token request', Number(res.headers.get('retry-after') ?? 60));
    if (res.status === 422) throw new GitHubError('credential-rejected', 'GitHub refused to narrow the installation token to the requested permissions');
    if (!res.ok) throw new GitHubError('provider-unavailable', `GitHub answered ${res.status} to the token request`);
    const body = (await res.json()) as { token?: string; expires_at?: string };
    if (typeof body.token !== 'string') throw new GitHubError('adapter-fault', 'GitHub returned no installation token');
    this.cache.set(key, { token: body.token, expiresAt: body.expires_at ? Date.parse(body.expires_at) : now + 3600_000 });
    return { bearer: body.token, narrowing: 'exact' };
  }
}
