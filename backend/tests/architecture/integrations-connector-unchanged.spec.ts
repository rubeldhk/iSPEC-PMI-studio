/**
 * `T2167` (EPIC-039, `FR-HUB-022`, `R-039-5`) — listing a connector does not
 * change it.
 *
 * The registry lists `pmi-studio` and the `EPIC-037` surfaces, and reads their
 * facts. So the integrations module may import from `@pmi/mcp-server` only the
 * plain tool-name table (`/tool-names`) — never the server, its client or its
 * tools — and must call no write on a connector store: no credential minted,
 * revoked, touched or re-snapshotted, no workstation connection touched.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const MODULE = join(REPO, 'backend/src/modules/integrations');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = walk(MODULE).map((p) => ({ rel: relative(REPO, p).replace(/\\/g, '/'), body: readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ') }));

describe('T2167 · connectors are read, never changed', () => {
  it('has module sources to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('imports nothing from @pmi/mcp-server but its tool-name table', () => {
    const imports = files.flatMap((f) => [...f.body.matchAll(/from\s+['"](@pmi\/mcp-server[^'"]*)['"]/g)].map((m) => `${f.rel} → ${m[1]}`));
    expect(imports.filter((i) => !i.endsWith('→ @pmi/mcp-server/tool-names'))).toEqual([]);
    expect(imports.length, 'the connector facts are read from the server, so the table IS imported').toBeGreaterThan(0);
  });

  it('never reaches packages/mcp-server by path', () => {
    expect(files.filter((f) => /packages\/mcp-server/.test(f.body)).map((f) => f.rel)).toEqual([]);
  });

  it('calls no write on a connector store', () => {
    const WRITES = /\.(touchLastUsed|revoke|setSnapshot|touch)\s*\(|connectorCredential\.(create|update|delete|upsert)|workstationConnection\.(create|update|delete|upsert)|credentials?\.create\(\s*\{\s*[^}]*tokenHash/;
    expect(files.filter((f) => WRITES.test(f.body)).map((f) => f.rel)).toEqual([]);
  });

  it('the write check can fail', () => {
    expect(/\.(touchLastUsed|revoke|setSnapshot|touch)\s*\(/.test('await store.revoke(ws, id, by, at)')).toBe(true);
  });
});
