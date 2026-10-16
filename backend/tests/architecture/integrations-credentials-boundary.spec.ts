/**
 * `T2176` (EPIC-039, `R-039-10`, `FR-HUB-043`, `FR-HUB-044`) — ciphertext has
 * one reader, and a credential handle never reaches a response.
 *
 * 1. Only the vault (`credential.vault.ts`), the cipher that seals for it, the
 *    PostgreSQL store that selects the column, and the port's type
 *    (`integrations.store.ts`) name `ciphertext`.
 * 2. No adapter package imports the vault — adapters receive a handle, never
 *    the means to open one.
 * 3. No controller's return type names `CredentialHandle`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    if (e === 'node_modules' || e === 'dist') return [];
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
const files = (dir: string) => walk(join(REPO, dir)).map((p) => ({ rel: relative(REPO, p).replace(/\\/g, '/'), body: strip(readFileSync(p, 'utf8')) }));

const PERMITTED = new Set([
  'backend/src/modules/integrations/credentials/credential.vault.ts',
  'backend/src/modules/integrations/credentials/credential.cipher.ts',
  'backend/src/modules/integrations/integrations.store.prisma.ts',
  'backend/src/modules/integrations/integrations.store.ts',
]);

describe('T2176 · one reader of ciphertext', () => {
  const backend = files('backend/src');

  it('has sources to check, and the vault does reach the column', () => {
    expect(backend.length).toBeGreaterThan(100);
    expect(backend.some((f) => PERMITTED.has(f.rel) && /ciphertext/.test(f.body))).toBe(true);
  });

  it('no other file in the integrations module names ciphertext', () => {
    const hub = backend.filter((f) => f.rel.startsWith('backend/src/modules/integrations/'));
    expect(hub.filter((f) => /ciphertext/i.test(f.body) && !PERMITTED.has(f.rel)).map((f) => f.rel)).toEqual([]);
  });

  it('no file outside the integrations module touches the credentials table', () => {
    // EPIC-025's storage TokenCipher has its own `ciphertext` and is not this
    // table; the rule here is about integration_credentials.
    const outside = backend.filter((f) => !f.rel.startsWith('backend/src/modules/integrations/'));
    expect(outside.filter((f) => /integrationCredential|integration_credentials/.test(f.body)).map((f) => f.rel)).toEqual([]);
  });

  it('the store selects ciphertext only inside vaultPort()', () => {
    const prisma = backend.find((f) => f.rel.endsWith('integrations.store.prisma.ts'))!.body;
    const outside = prisma.slice(0, prisma.indexOf('vaultPort(): CredentialVaultPort'));
    expect(outside).not.toMatch(/ciphertext/);
  });
});

describe('T2176 · adapters never hold the means to open a credential', () => {
  it('no adapter package imports the vault, the cipher or the backend', () => {
    const adapters = files('packages/capability-adapters');
    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters.filter((f) => /credential\.(vault|cipher)|@pmi\/backend|backend\/src/.test(f.body)).map((f) => f.rel)).toEqual([]);
  });
});

describe('T2176 · no controller returns a handle', () => {
  it('no controller in the integrations module names CredentialHandle', () => {
    const controllers = files('backend/src/modules/integrations').filter((f) => f.rel.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThan(0);
    expect(controllers.filter((f) => /CredentialHandle/.test(f.body)).map((f) => f.rel)).toEqual([]);
  });
});
