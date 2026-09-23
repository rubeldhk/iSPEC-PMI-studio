/**
 * T1142 (C3B) — connector-facing packages cannot reach identity.
 *
 * The trusted context is only worth having if the code that would most like to
 * forge one cannot see it. `packages/*` is what connectors and SDKs consume;
 * `backend/src` is where identity is resolved and minted. This asserts the wall
 * between them, and that the wall is checkable rather than assumed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..');
const PACKAGES = join(ROOT, 'packages');
const BACKEND_SRC = join(ROOT, 'backend', 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const packageFiles = walk(PACKAGES);
const backendFiles = walk(BACKEND_SRC);

describe('T1142 · the scan is real', () => {
  it('found package sources to check — an empty scan proves nothing', () => {
    expect(packageFiles.length).toBeGreaterThan(20);
    expect(backendFiles.length).toBeGreaterThan(50);
  });
});

describe('T1142 · connector-facing packages cannot reach identity', () => {
  it('no package imports the backend at all', () => {
    // Structural, and the reason forgery is impossible rather than merely
    // discouraged: a package physically cannot see `TrustedPrincipalContext`.
    const offenders = packageFiles.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*backend\/src/.test(src);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('no package names the trusted-principal module or the identity tables', () => {
    const forbidden = [
      'trusted-principal',
      'principal-registry.service',
      'principal_identity_snapshots',
      'principal_state_events',
      'principal_delegations',
    ];
    const offenders: string[] = [];
    for (const f of packageFiles) {
      const src = readFileSync(f, 'utf8');
      for (const needle of forbidden) {
        if (src.includes(needle)) offenders.push(`${relative(ROOT, f)} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no package imports a Prisma client', () => {
    // Identity persistence is reachable only through the services that guard
    // it. A package holding a client could read the registry directly.
    const offenders = packageFiles.filter((f) =>
      /from\s+['"]@prisma\/client['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});

describe('T1142 · the trusted context has exactly one door', () => {
  const trustedFile = join(BACKEND_SRC, 'modules', 'agents', 'trusted-principal.ts');

  it('keeps its brand symbol unexported', () => {
    const src = readFileSync(trustedFile, 'utf8');
    // An exported brand would let any module construct a passing look-alike.
    expect(/export\s+const\s+TRUSTED/.test(src), 'the brand symbol is exported').toBe(false);
    expect(src).toMatch(/const TRUSTED = Symbol\(/);
  });

  it('keeps its constructor private', () => {
    const src = readFileSync(trustedFile, 'utf8');
    expect(src).toMatch(/private constructor\(/);
  });

  it('is instantiated nowhere else in the backend', () => {
    // `new TrustedPrincipalContext(` outside its own file would not compile,
    // and asserting it here means the rule is visible rather than implied by a
    // type error somebody might silence with a cast.
    const offenders = backendFiles.filter(
      (f) => f !== trustedFile && /new\s+TrustedPrincipalContext\s*\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('can actually detect a violation — proven by construction', () => {
    // The anti-tautology check. Each rule above is re-run against text that
    // SHOULD trip it, so a scan that silently matches nothing cannot pass.
    const violating = `import { x } from '../../backend/src/modules/agents/trusted-principal.js';`;
    expect(/from\s+['"][^'"]*backend\/src/.test(violating)).toBe(true);
    expect(violating.includes('trusted-principal')).toBe(true);
    expect(/new\s+TrustedPrincipalContext\s*\(/.test('new TrustedPrincipalContext(1)')).toBe(true);
    expect(/from\s+['"]@prisma\/client['"]/.test(`import {a} from '@prisma/client';`)).toBe(true);
  });
});
