/**
 * `T2154` (EPIC-039, `R-039-9`, `FR-HUB-034`) — least privilege, minted per
 * request.
 *
 * With a GitHub App installation credential the adapter signs an app JWT
 * (RS256, `node:crypto`, no Octokit) and mints an installation token carrying
 * exactly the permissions the resolver granted, for exactly the bound
 * repository. Tokens are cached per (installation, permission set, repository)
 * until five minutes before they expire. A plain token cannot be narrowed by
 * the platform and says so.
 *
 * Written to FAIL before `T2155`.
 */
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { createCredentialHandle } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { GitHubAuth, appJwt, permissionsFor } from '../src/auth.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const NOW = new Date('2026-10-10T12:00:00Z');

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('T2154 · the app JWT', () => {
  it('is RS256-signed, issued by the app, valid for under ten minutes', () => {
    const jwt = appJwt('12345', PEM, NOW);
    const [h, p, s] = jwt.split('.') as [string, string, string];
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const payload = decode(p);
    expect(payload['iss']).toBe('12345');
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBeLessThanOrEqual(600);
    expect(verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey(PEM), Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('T2154 · installation tokens', () => {
  it('maps the granted permissions one to one', () => {
    expect(permissionsFor(['checks:read', 'statuses:read'])).toEqual({ checks: 'read', statuses: 'read' });
    expect(permissionsFor([])).toEqual({ metadata: 'read' });
  });

  function harness(): { auth: GitHubAuth; calls: { url: string; body: unknown }[]; clock: { now: Date } } {
    const calls: { url: string; body: unknown }[] = [];
    const clock = { now: NOW };
    const auth = new GitHubAuth({
      fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(JSON.stringify({ token: `ghs_minted${String(calls.length).padStart(20, '0')}`, expires_at: new Date(clock.now.getTime() + 3600_000).toISOString() }), { status: 201 });
      },
      clock: () => clock.now,
      apiBaseUrl: 'https://api.example.test',
    });
    return { auth, calls, clock };
  }

  const appCredential = () => createCredentialHandle(JSON.stringify({ appId: '12345', installationId: '4242', privateKeyPem: PEM }), 'github-app-installation');

  it('requests exactly the capability\'s permissions and the bound repository', async () => {
    const { auth, calls } = harness();
    const t = await auth.token(appCredential(), { granted: ['actions:read'], repository: 'acme/widgets' });
    expect(t).toMatchObject({ narrowing: 'exact' });
    expect(calls).toEqual([{ url: 'https://api.example.test/app/installations/4242/access_tokens', body: { permissions: { actions: 'read' }, repositories: ['widgets'] } }]);
  });

  it('caches per (installation, permission set, repository) until five minutes before expiry', async () => {
    const { auth, calls, clock } = harness();
    await auth.token(appCredential(), { granted: ['actions:read'], repository: 'acme/widgets' });
    await auth.token(appCredential(), { granted: ['actions:read'], repository: 'acme/widgets' });
    expect(calls).toHaveLength(1);
    await auth.token(appCredential(), { granted: ['checks:read', 'statuses:read'], repository: 'acme/widgets' });
    expect(calls).toHaveLength(2);
    clock.now = new Date(NOW.getTime() + 56 * 60_000);
    await auth.token(appCredential(), { granted: ['actions:read'], repository: 'acme/widgets' });
    expect(calls).toHaveLength(3);
  });

  it('a github-token credential is used as given and reports not-narrowable', async () => {
    const { auth, calls } = harness();
    const t = await auth.token(createCredentialHandle('ghp_classicTOKENvalue000000000000', 'github-token'), { granted: ['contents:read'], repository: 'acme/widgets' });
    expect(t).toMatchObject({ narrowing: 'not-narrowable', bearer: 'ghp_classicTOKENvalue000000000000' });
    expect(calls).toHaveLength(0);
  });

  it('a rejected app credential is credential-rejected, with no secret in the message', async () => {
    const auth = new GitHubAuth({ fetch: async () => new Response(JSON.stringify({ message: 'A JSON web token could not be decoded' }), { status: 401 }), clock: () => NOW, apiBaseUrl: 'https://api.example.test' });
    const r = await auth.token(appCredential(), { granted: ['contents:read'], repository: 'acme/widgets' }).catch((e: unknown) => e as Error);
    expect(r).toBeInstanceOf(Error);
    expect((r as Error & { category?: string }).category).toBe('credential-rejected');
    expect((r as Error).message).not.toContain('PRIVATE KEY');
  });
});
