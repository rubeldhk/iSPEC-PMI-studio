/**
 * `T1665` (EPIC-045, `FR-ART-061`, `R-045-13`) — there is exactly ONE markdown
 * renderer, and no raw-HTML path anywhere in the web client.
 *
 * `markdown-viewer.spec.tsx` proves that `MarkdownViewer` is safe. This file
 * proves that being safe is *enough* — that no second renderer, and no
 * `dangerouslySetInnerHTML`, exists beside it to be unsafe on its own.
 *
 * Three rules, read from source rather than from a running application, so the
 * check runs everywhere and fails on the commit that breaks it:
 *
 * 1. Nothing under `frontend/src/` imports `rehype-raw` — the plugin whose
 *    entire purpose is admitting the raw HTML this viewer escapes.
 * 2. Nothing under `frontend/src/` uses `dangerouslySetInnerHTML`. If no
 *    component builds an HTML string, no component can inject one.
 * 3. `MarkdownViewer.tsx` is the ONLY importer of `react-markdown`. A second
 *    one would be a second set of `components` and `urlTransform` options to
 *    keep right, and the one nobody would think to test.
 *
 * Written to FAIL before `T1666`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../../src');
const VIEWER = 'design/components/MarkdownViewer.tsx';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

/**
 * Comments removed. The viewer's own header DOCUMENTS the sanitising strategy —
 * naming `rehype-raw` and `dangerouslySetInnerHTML` as the things it does not
 * do — and a check that read prose would report the documentation as the
 * violation. Explaining a rule must not break it.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = walk(SRC).map((p) => ({ rel: relative(SRC, p).replace(/\\/g, '/'), body: code(readFileSync(p, 'utf8')), source: readFileSync(p, 'utf8') }));

describe('T1665 · the boundary is real', () => {
  it('reads a substantial number of source files, or every assertion below proves nothing', () => {
    // Anti-vacuity: a wrong root would make this whole file pass over an empty
    // list — the shape `T436n` guards for elsewhere in this repository.
    expect(FILES.length, 'no frontend source files were read at all').toBeGreaterThan(20);
    expect(FILES.map((f) => f.rel)).toContain(VIEWER);
  });
});

describe('T1665 · no raw-HTML path exists in the web client (FR-ART-061)', () => {
  it('nothing imports rehype-raw', () => {
    const offenders = FILES.filter((f) => /rehype-raw/.test(f.body)).map((f) => f.rel);
    expect(offenders, `these files import rehype-raw: ${offenders.join(', ')}`).toEqual([]);
  });

  it('nothing uses dangerouslySetInnerHTML', () => {
    const offenders = FILES.filter((f) => /dangerouslySetInnerHTML/.test(f.body)).map((f) => f.rel);
    expect(offenders, `these files inject an HTML string: ${offenders.join(', ')}`).toEqual([]);
  });

  it('nothing writes to innerHTML or outerHTML either', () => {
    // The same hole by another name. `insertAdjacentHTML` too, which is the one
    // a linter rule for `dangerouslySetInnerHTML` alone would miss.
    const offenders = FILES.filter((f) => /\.(inner|outer)HTML\s*=|insertAdjacentHTML\s*\(/.test(f.body)).map((f) => f.rel);
    expect(offenders, `these files write HTML directly: ${offenders.join(', ')}`).toEqual([]);
  });

  it('nothing installs a second markdown or sanitising library', () => {
    // If a second renderer ever arrives it must arrive through the register
    // (`TS-001`) and a plan change, not through an import nobody noticed.
    const offenders = FILES.filter((f) => /from\s+['"](marked|markdown-it|dompurify|sanitize-html|showdown|micromark)['"]/.test(f.body)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

describe('T1665 · one renderer, one place to keep safe (R-045-13)', () => {
  const importers = FILES.filter((f) => /from\s+['"]react-markdown['"]/.test(f.body)).map((f) => f.rel);

  it('MarkdownViewer.tsx imports react-markdown', () => {
    // The converse of the rule below: a check that only forbade OTHER importers
    // would pass if the viewer stopped rendering markdown altogether.
    expect(importers).toContain(VIEWER);
  });

  it('and it is the ONLY importer', () => {
    expect(importers, `react-markdown is imported by more than one file: ${importers.join(', ')}`).toEqual([VIEWER]);
  });

  it('remark-gfm travels with it and nowhere else', () => {
    const gfm = FILES.filter((f) => /from\s+['"]remark-gfm['"]/.test(f.body)).map((f) => f.rel);
    expect(gfm).toEqual([VIEWER]);
  });

  it('the viewer keeps its sanitising decisions — urlTransform, no rehypePlugins', () => {
    const viewer = FILES.find((f) => f.rel === VIEWER)?.source ?? '';
    // `defaultUrlTransform` is WRAPPED, not replaced: replacing it would drop
    // the library's own blocking of javascript:/data:/vbscript: URLs, which is
    // the check most easily lost in a rewrite (`FR-ART-021`).
    expect(viewer, 'the viewer no longer wraps defaultUrlTransform').toContain('defaultUrlTransform');
    expect(viewer, 'the viewer no longer transforms URLs').toContain('urlTransform');
    const viewerCode = FILES.find((f) => f.rel === VIEWER)?.body ?? '';
    expect(viewerCode, 'the viewer passes rehype plugins, which admit raw HTML').not.toMatch(/rehypePlugins/);
  });
});
