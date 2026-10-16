/**
 * `T2152`, `T2153` (EPIC-039, `FR-HUB-061`, `R-039-17`, `SC-HUB-001`) — platform
 * business rules never name a provider and never depend on an adapter.
 *
 * A member of the independence family (`engine-`, `storage-`, `transport-`,
 * `agent-independence.spec.ts`). The permitted location is one path: adapters
 * live in `packages/capability-adapters/**`, and `backend/src` reaches them
 * through ONE file, `composition/integration-adapters.ts`. So the rule reads:
 *
 * 1. **No provider names** in `backend/src/**` (except that file) or in any
 *    `packages/*\/src` (except the adapters) — not in code, not in a string.
 * 2. **No adapter imports** outside that file — static or dynamic.
 * 3. **Callers name capabilities**: no module outside `integrations/` reaches
 *    into it except through `CapabilityRequests` (and the contract package).
 * 4. Every failure names **the file and the line**.
 *
 * Comments are stripped (line-preserving), because these files explain the
 * rules they obey. Package **tests** are out of scope: test data naming a host
 * is not a business rule. Analysis C6: rule 1 is also what enforces
 * `FR-HUB-050` — a bespoke per-tool intake path would have to name its tool's
 * provider outside the adapters, and fail here.
 *
 * The mutation proof (`T2228`) inserts a provider into the resolver and an
 * adapter import into the loop, and records this file failing on each.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const COMPOSITION = 'backend/src/composition/integration-adapters.ts';

export const PROVIDER_PATTERN = /\b(github|gitlab|bitbucket|resend|postmark|sendgrid|mailgun|ses|jenkins|circleci|buildkite|octokit|ollama)\b|api\.github\.com|api\.resend\.com|:11434\b/i;
export const ADAPTER_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:@pmi\/capability-adapter-[\w-]+|[^'"]*capability-adapters\/)[^'"]*['"]/;

/**
 * Allow-list, by path AND line content, never by directory (`R-039-17`).
 * Empty: the first run was green on the tree as it stands.
 */
const ALLOWED: readonly { file: string; line: RegExp; reason: string }[] = [];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mts)$/.test(p) ? [p] : [];
  });
}

/** Comments blanked line-for-line, so a reported line number is the real one. */
function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

interface Source {
  readonly rel: string;
  readonly lines: string[];
}

function sources(dirs: string[]): Source[] {
  return dirs.flatMap((d) => walk(join(REPO, d))).map((p) => ({ rel: relative(REPO, p).replace(/\\/g, '/'), lines: stripComments(readFileSync(p, 'utf8')).split('\n') }));
}

/** `file:line: content` for every line matching, minus the allow-list. */
export function offenders(files: readonly Source[], pattern: RegExp): string[] {
  return files.flatMap((f) =>
    f.lines.flatMap((line, i) => (pattern.test(line) && !ALLOWED.some((a) => a.file === f.rel && a.line.test(line)) ? [`${f.rel}:${i + 1}: ${line.trim()}`] : [])),
  );
}

const packageSrcDirs = readdirSync(join(REPO, 'packages'))
  .filter((d) => d !== 'capability-adapters' && statSync(join(REPO, 'packages', d)).isDirectory())
  .map((d) => `packages/${d}/src`);

const backend = sources(['backend/src']).filter((f) => f.rel !== COMPOSITION);
const packages = sources(packageSrcDirs);

describe('T2152 · anti-vacuity', () => {
  it('has backend and package sources to check', () => {
    expect(backend.length).toBeGreaterThan(100);
    expect(packages.length).toBeGreaterThan(10);
  });

  it('the composition file exists — the one permitted place', () => {
    expect(existsSync(join(REPO, COMPOSITION))).toBe(true);
  });
});

describe('T2152 · rule 1 — no provider names outside the adapters (FR-HUB-061)', () => {
  it('backend/src names no provider (the composition file excepted)', () => {
    expect(offenders(backend, PROVIDER_PATTERN), 'a business-rule module names a provider').toEqual([]);
  });

  it('no package source outside capability-adapters names a provider', () => {
    expect(offenders(packages, PROVIDER_PATTERN), 'a package names a provider').toEqual([]);
  });

  it('the check can fail, and names the file and line', () => {
    const planted: Source = { rel: 'backend/src/modules/integrations/resolver/resolver.service.ts', lines: ['import x from "y";', "const PROVIDER = 'github';"] };
    expect(offenders([planted], PROVIDER_PATTERN)).toEqual(["backend/src/modules/integrations/resolver/resolver.service.ts:2: const PROVIDER = 'github';"]);
  });
});

describe('T2152 · rule 2 — no adapter import outside the composition file', () => {
  it('backend/src imports no @pmi/capability-adapter-* (statically or dynamically)', () => {
    expect(offenders(backend, ADAPTER_IMPORT)).toEqual([]);
  });

  it('no package outside capability-adapters imports an adapter', () => {
    expect(offenders(packages, ADAPTER_IMPORT)).toEqual([]);
  });

  it('the check can fail on a static and a dynamic import', () => {
    expect(ADAPTER_IMPORT.test("import { GitHubRestAdapter } from '@pmi/capability-adapter-github';")).toBe(true);
    expect(ADAPTER_IMPORT.test("import '@pmi/capability-adapter-github';")).toBe(true);
    expect(ADAPTER_IMPORT.test("await import('@pmi/capability-adapter-resend')")).toBe(true);
    expect(ADAPTER_IMPORT.test("import { x } from '@pmi/capability-contract';")).toBe(false);
  });
});

describe('T2152 · rule 3 — callers name capabilities, never the Hub\'s internals', () => {
  const PERMITTED = /integrations\/(requests\/capability-requests\.service|integrations\.module|hub\.token)(\.js)?['"]/;

  it('no module outside integrations/ imports anything else from it', () => {
    const outside = backend.filter((f) => f.rel.startsWith('backend/src/modules/') && !f.rel.startsWith('backend/src/modules/integrations/'));
    const reaching = /from\s+['"][^'"]*\/integrations\/[^'"]*['"]/;
    const hits = offenders(outside, reaching).filter((h) => !PERMITTED.test(h));
    expect(hits).toEqual([]);
  });
});

describe('T2152 · a seam, not a wall', () => {
  it('the backend DOES depend on @pmi/capability-contract', () => {
    const manifest = JSON.parse(readFileSync(join(REPO, 'backend/package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['@pmi/capability-contract']).toBe('workspace:*');
    expect(backend.some((f) => f.lines.some((l) => /@pmi\/capability-contract/.test(l)))).toBe(true);
  });

  it('the composition file DOES import the adapters it composes', () => {
    const body = readFileSync(join(REPO, COMPOSITION), 'utf8');
    expect(ADAPTER_IMPORT.test(body)).toBe(true);
  });

  it('an adapter package IS allowed to name its own provider', () => {
    const adapters = sources(['packages/capability-adapters']).filter((f) => !f.rel.includes('/tests/') && !f.rel.includes('/fixture/'));
    if (adapters.length === 0) return; // before the real adapters exist
    expect(adapters.some((f) => f.lines.some((l) => PROVIDER_PATTERN.test(l)))).toBe(true);
  });
});
