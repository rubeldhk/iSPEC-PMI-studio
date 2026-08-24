/**
 * T200a (EPIC-010) — Constitution XI Tier 1's missing half: every delivered
 * page is reachable from the application root. `DEF-010-001`.
 *
 * > ## ⚠ THIS CHECK IS EXPECTED TO FAIL UNTIL `T200b` IS DECIDED.
 * >
 * > `DEF-010-001` is **OPEN**: five of nine page components are imported by
 * > nothing. The check exists to make that visible and to keep it from
 * > happening a ninth time — not to be silenced. Do not skip it, do not
 * > allow-list the five, and do not delete it to get a green run. It goes
 * > green when each page is either routed or removed (`T200b`).
 *
 * **Why every existing gate missed this.** `T899a` mounts the real entry module
 * and asserts a delivered page renders — and one does, so it passes. `T883`
 * renders page components directly, so each works in isolation. `T900a`'s
 * browser run walked sign-in → projects → requirements, and *"the run cannot
 * miss a page it never visits"*. Each gate asks **"does this artifact exist and
 * behave?"**; none asked **"can a user get to it?"**
 *
 * **Reachability of a MODULE is what this file checks.** Two claims, both
 * static:
 *
 *   1. every `src/pages/*.tsx` is in the import graph reachable from
 *      `src/main.tsx` — the module is wired at all;
 *   2. every exported page component is **rendered** somewhere in that graph —
 *      because an import that is never placed in JSX is the same defect one
 *      step later, and `import`-only would have passed it.
 *
 * **What this file honestly does NOT check**, stated so nobody reads more into
 * a green run than is there: reachability of a **route**. A page can be
 * imported and rendered inside a view state that no control ever sets, and this
 * check would pass. Proving *that* needs a driven browser run enumerating the
 * navigation graph — `T900a`'s tier, not this one. `DEF-010-001` records the
 * distinction; this closes the cheaper half of it.
 *
 * Framework-free: no renderer, no jsdom. It reads the tree.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../../src');
const ENTRY = join(SRC, 'main.tsx');
const PAGES = join(SRC, 'pages');

/** Resolve a relative specifier the way the bundler does: .tsx, .ts, /index. */
function resolveImport(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const IMPORT = /from\s+['"](\.[^'"]*)['"]/g;

/** Every module reachable from the entry point, transitively. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const body = readFileSync(file, 'utf8');
    for (const match of body.matchAll(IMPORT)) {
      const target = resolveImport(file, match[1]!);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

/** The component names a page module exports. */
function exportedComponents(file: string): string[] {
  const body = readFileSync(file, 'utf8');
  return [...body.matchAll(/export\s+(?:function|const)\s+([A-Z]\w*)/g)].map((m) => m[1]!);
}

const pageFiles = readdirSync(PAGES)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => join(PAGES, name));

const reachable = reachableFrom(ENTRY);
const rel = (file: string): string => relative(SRC, file).replace(/\\/g, '/');

describe('T200a · every delivered page is reachable from the application root', () => {
  it('finds the pages and the entry point — an empty scan would prove nothing', () => {
    // Anti-vacuity. A glob that matched nothing would make every assertion
    // below pass over an application with no pages at all.
    expect(pageFiles.length).toBeGreaterThanOrEqual(5);
    expect(existsSync(ENTRY)).toBe(true);
  });

  it('reaches the pages that ARE wired, or the graph walk is broken', () => {
    // The four DEF-010-001 names as wired. If these ever fall out, the failure
    // below stops meaning "unreachable page" and starts meaning "broken test".
    const wired = ['pages/Projects.tsx', 'pages/Requirements.tsx', 'pages/SignIn.tsx'];
    const reached = [...reachable].map(rel);
    for (const page of wired) {
      expect(reached).toContain(page);
    }
  });

  it('imports every page from the application root', () => {
    const unreachable = pageFiles.filter((file) => !reachable.has(file)).map(rel);

    // DEF-010-001. Each name here is a delivered capability a user cannot use
    // at all — not a styling gap, not a rough edge. Route it or remove it
    // (T200b); do not add it to an exception list.
    expect(unreachable).toEqual([]);
  });

  it('renders every page it imports, not merely imports it', () => {
    const graph = [...reachable].map((file) => readFileSync(file, 'utf8')).join('\n');
    const neverRendered: string[] = [];

    for (const file of pageFiles) {
      if (!reachable.has(file)) continue; // the harder failure is reported above
      const components = exportedComponents(file);
      if (components.length === 0) continue;
      const rendered = components.some((name) =>
        new RegExp(`<${name}[\\s/>]`).test(graph),
      );
      if (!rendered) neverRendered.push(`${rel(file)} (${components.join(', ')})`);
    }

    // An import that is never placed in JSX is the same defect one step later,
    // and an import-only check would have passed it.
    expect(neverRendered).toEqual([]);
  });
});
