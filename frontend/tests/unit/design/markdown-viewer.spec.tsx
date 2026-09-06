/**
 * `T1646` (EPIC-045, `FR-ART-017`, `FR-ART-023`, `FR-ART-025`) — the
 * `MarkdownViewer`, rendering half.
 *
 * Every construct the artifact set actually contains is asserted from a
 * fixture: headings, paragraphs, lists, GFM task lists and tables, block
 * quotes, fenced code with its language named, emphasis and links. The safety
 * half — the hostile corpus — is `T1663` in the same file.
 *
 * The size fallback is here rather than beside safety because it is an honesty
 * rule, not a security one: a file above the limit renders as raw text with the
 * reason, and **no** *render anyway* control is offered. Offering one would
 * make the limit advisory, and a limit a reader can wave away protects nobody.
 *
 * Written to FAIL before `T1647`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarkdownViewer } from '../../../src/design/components/MarkdownViewer';
import { RENDER_LIMIT_BYTES } from '../../../src/config/viewer';

afterEach(cleanup);

const FIXTURE = `# Reports

A paragraph with **bold**, *italic* and ~~struck~~ text.

## Lists

- first
- second
  - nested

1. one
2. two

## Tasks

- [x] done
- [ ] not done

## A table

| Requirement | State |
| --- | --- |
| FR-ART-017 | met |

> A block quote.

\`\`\`ts
const x: number = 1;
\`\`\`

\`\`\`
plain fence
\`\`\`

Inline \`code\` and a [link](https://example.test/docs).
`;

function view(markdown = FIXTURE, props: Record<string, unknown> = {}): HTMLElement {
  const { container } = render(<MarkdownViewer markdown={markdown} sizeBytes={new TextEncoder().encode(markdown).length} {...props} />);
  return container;
}

describe('T1646 · the constructs an artifact actually contains render', () => {
  it('renders headings at their level', () => {
    view();
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lists' })).toBeDefined();
  });

  it('renders paragraphs, emphasis and strikethrough', () => {
    const container = view();
    expect(container.querySelector('p')?.textContent).toContain('A paragraph');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    // GFM: `~~struck~~` is `<del>`, which needs remark-gfm and nothing else.
    expect(container.querySelector('del')?.textContent).toBe('struck');
  });

  it('renders unordered, ordered and nested lists', () => {
    const container = view();
    expect(container.querySelectorAll('ul').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('ol')?.textContent).toContain('one');
    expect(container.querySelector('ul ul')?.textContent).toContain('nested');
  });

  it('renders a GFM table with header cells', () => {
    view();
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('FR-ART-017');
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Requirement', 'State']);
  });

  it('renders a block quote', () => {
    expect(view().querySelector('blockquote')?.textContent).toContain('A block quote.');
  });

  it('renders fenced code and NAMES the language on the element', () => {
    const container = view();
    const code = [...container.querySelectorAll('code')].find((c) => c.textContent?.includes('const x'));
    expect(code, 'the fenced block did not render').toBeDefined();
    expect(code?.className, 'the language is not named on the element').toContain('ts');
  });

  it('renders a fence with no language as a code block', () => {
    const container = view();
    const code = [...container.querySelectorAll('code')].find((c) => c.textContent?.includes('plain fence'));
    expect(code).toBeDefined();
  });

  it('renders an unknown fenced language as a code block naming the language (FR-ART-025)', () => {
    const container = view('```dhall-with-frills\nlet x = 1\n```\n');
    const code = container.querySelector('code');
    expect(code?.textContent).toContain('let x = 1');
    expect(code?.className).toContain('dhall-with-frills');
    // Nothing is dropped: the language is legible to the reader, not only to the class attribute.
    expect(container.textContent).toContain('dhall-with-frills');
  });

  it('renders inline code', () => {
    const container = view();
    expect([...container.querySelectorAll('code')].some((c) => c.textContent === 'code')).toBe(true);
  });

  it('renders GFM task-list checkboxes DISABLED — the viewer is read-only (FR-ART-010)', () => {
    const container = view();
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(boxes.length).toBe(2);
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    for (const box of boxes) expect(box.disabled, 'a task-list checkbox was editable').toBe(true);
  });

  it('renders an external link that cannot reach back into this tab', () => {
    view();
    const link = screen.getByRole('link', { name: 'link' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.test/docs');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
  });
});

describe('T1646 · relative sibling links open the file rather than navigating (FR-ART-018)', () => {
  it('calls onOpenSibling with the path and does not navigate', () => {
    const onOpenSibling = vi.fn();
    render(<MarkdownViewer markdown={'See [the plan](plan.md).\n'} sizeBytes={20} path="specs/003-reports/spec.md" onOpenSibling={onOpenSibling} />);
    const link = screen.getByRole('link', { name: 'the plan' });
    link.click();
    expect(onOpenSibling).toHaveBeenCalledWith('specs/003-reports/plan.md');
  });

  it('resolves a link into a sibling directory', () => {
    const onOpenSibling = vi.fn();
    render(<MarkdownViewer markdown={'See [the API](contracts/api.md).\n'} sizeBytes={20} path="specs/003-reports/spec.md" onOpenSibling={onOpenSibling} />);
    screen.getByRole('link', { name: 'the API' }).click();
    expect(onOpenSibling).toHaveBeenCalledWith('specs/003-reports/contracts/api.md');
  });

  it('says *no synced version* for a relative link the Epic has no version of (FR-ART-018)', () => {
    render(
      <MarkdownViewer
        markdown={'See [the tasks](tasks.md) and [the plan](plan.md).\n'}
        sizeBytes={40}
        path="specs/003-reports/spec.md"
        syncedPaths={['specs/003-reports/plan.md']}
        onOpenSibling={vi.fn()}
      />,
    );
    // The one with a version is a link; the one without is text with the reason.
    expect(screen.getByRole('link', { name: 'the plan' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'the tasks' })).toBeNull();
    expect(screen.getByText(/the tasks/).textContent).toContain('no synced version');
  });
});

describe('T1646 · a file above the render limit is raw text with the reason (FR-ART-023)', () => {
  const big = `# Big\n${'x'.repeat(64)}\n`;

  it('renders raw text, not markdown, and says why', () => {
    render(<MarkdownViewer markdown={big} sizeBytes={RENDER_LIMIT_BYTES + 1} />);
    expect(screen.queryByRole('heading', { name: 'Big' }), 'the oversized file was rendered as markdown').toBeNull();
    expect(screen.getByText(/# Big/)).toBeDefined();
    const reason = screen.getByRole('status').textContent ?? '';
    expect(reason).toMatch(/too large|above/i);
    expect(reason, 'the reason does not name the limit').toMatch(/\d/);
  });

  it('offers NO *render anyway* control — a limit a reader can wave away protects nobody', () => {
    render(<MarkdownViewer markdown={big} sizeBytes={RENDER_LIMIT_BYTES + 1} />);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(document.body.textContent).not.toMatch(/render anyway/i);
  });

  it('renders normally exactly at the limit — the boundary is inclusive', () => {
    render(<MarkdownViewer markdown={'# At the limit\n'} sizeBytes={RENDER_LIMIT_BYTES} />);
    expect(screen.getByRole('heading', { name: 'At the limit' })).toBeDefined();
  });

  it('the limit is 2 MiB, stated in one place', () => {
    expect(RENDER_LIMIT_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe('T1646 · the empty document', () => {
  it('renders nothing rather than throwing', () => {
    const container = view('');
    expect(container.textContent?.trim()).toBe('');
  });
});

/**
 * `T1663` (EPIC-045, `FR-ART-020`–`FR-ART-024`, `SC-ART-004`) — the safety
 * half, over the hostile corpus in `frontend/tests/fixtures/hostile-markdown/`.
 *
 * Synced markdown is untrusted: an agent wrote it on a developer's machine and
 * a connector credential uploaded it. Six properties are asserted over EVERY
 * file of the corpus at once, so a construct added to one fixture is checked
 * against all six without anyone remembering to:
 *
 * 1. no `script` element;
 * 2. no attribute whose name starts `on`;
 * 3. no `href` whose scheme is `javascript`, `data` or `vbscript`;
 * 4. no element with a `src` at all;
 * 5. no `iframe`, `object` or `embed`;
 * 6. **zero** network requests during render.
 *
 * And a seventh that is easy to forget and matters just as much: **nothing is
 * silently dropped**. A viewer that deleted every hostile construct would pass
 * the first six and lie to the reader about what the file contains
 * (`FR-ART-024`).
 *
 * ## The mutation observations this file owes (`quickstart.md`)
 *
 * Replacing `urlTransform` with the identity must fail `images.md` and
 * `links.md`; removing the `components.img` override must fail `images.md`.
 * Both are recorded at closure.
 */
import { readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, '../../fixtures/hostile-markdown');

/** Every fixture, by name — read from disk so a new one is covered without an edit here. */
const FIXTURES = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((name) => [name, readFileSync(join(CORPUS, name), 'utf8')] as const);

const BLOCKED_SCHEME = /^\s*(javascript|data|vbscript):/i;

function renderFixture(markdown: string): HTMLElement {
  const { container } = render(
    <MarkdownViewer markdown={markdown} sizeBytes={new TextEncoder().encode(markdown).length} path="specs/003-reports/spec.md" syncedPaths={['specs/003-reports/plan.md', 'specs/003-reports/contracts/reports-api.md']} onOpenSibling={vi.fn()} />,
  );
  return container;
}

describe('T1663 · the corpus is real', () => {
  it('reads at least six fixtures, or every assertion below proves nothing', () => {
    // Anti-vacuity. A wrong directory would make the whole suite pass over an
    // empty list, silently, forever.
    expect(FIXTURES.length).toBeGreaterThanOrEqual(6);
    expect(FIXTURES.map(([name]) => name)).toEqual(expect.arrayContaining(['script.md', 'links.md', 'images.md', 'html.md', 'fences.md', 'relative.md']));
  });

  it('every fixture actually carries something hostile', () => {
    for (const [name, body] of FIXTURES) {
      expect(body.length, `${name} is empty`).toBeGreaterThan(20);
    }
    expect(FIXTURES.find(([n]) => n === 'script.md')?.[1]).toContain('<script>');
    expect(FIXTURES.find(([n]) => n === 'links.md')?.[1]).toContain('javascript:');
    expect(FIXTURES.find(([n]) => n === 'images.md')?.[1]).toContain('https://tracker.test');
  });
});

describe.each(FIXTURES)('T1663 · %s renders without executing or fetching anything', (name, body) => {
  it('renders no script element (FR-ART-020)', () => {
    const container = renderFixture(body);
    expect(container.querySelectorAll('script'), `${name} produced a script element`).toHaveLength(0);
    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('renders no attribute whose name starts "on" (FR-ART-020)', () => {
    const container = renderFixture(body);
    for (const element of container.querySelectorAll('*')) {
      const handlers = [...element.attributes].map((a) => a.name).filter((n) => /^on/i.test(n));
      expect(handlers, `${name}: <${element.tagName.toLowerCase()}> carries ${handlers.join(', ')}`).toEqual([]);
    }
  });

  it('renders no href with a javascript, data or vbscript scheme (FR-ART-021)', () => {
    const container = renderFixture(body);
    for (const anchor of container.querySelectorAll('a')) {
      const href = anchor.getAttribute('href') ?? '';
      expect(BLOCKED_SCHEME.test(href), `${name}: href "${href}"`).toBe(false);
    }
  });

  it('renders NO element with a src — nothing is fetched (FR-ART-022)', () => {
    const container = renderFixture(body);
    const withSrc = [...container.querySelectorAll('[src]')].map((e) => e.tagName.toLowerCase());
    expect(withSrc, `${name} produced elements with a src: ${withSrc.join(', ')}`).toEqual([]);
  });

  it('renders no iframe, object or embed (FR-ART-022)', () => {
    const container = renderFixture(body);
    for (const tag of ['iframe', 'object', 'embed', 'form', 'style', 'link']) {
      expect(container.querySelectorAll(tag), `${name} produced a <${tag}>`).toHaveLength(0);
    }
  });

  it('renders raw HTML as TEXT, so nothing is silently dropped (FR-ART-024)', () => {
    const container = renderFixture(body);
    // Every `<tag` in the source is still legible to the reader somewhere.
    const tags = [...body.matchAll(/<([a-z][a-z0-9]*)\b/gi)].map((m) => (m[1] as string).toLowerCase());
    for (const tag of new Set(tags)) {
      // Skipped only for fenced content, which is checked as code below.
      expect(container.textContent, `${name}: <${tag}> vanished from the rendering`).toContain(`<${tag}`);
    }
  });
});

describe('T1663 · zero network requests during render (SC-ART-004)', () => {
  const original = globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;
  const imageLoads: string[] = [];

  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{}'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    imageLoads.length = 0;
    // jsdom does not fetch images, so the `src` SETTER is the observation
    // point: an `img` that never receives one can never load one.
    vi.spyOn(globalThis.HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement, value: string) {
      imageLoads.push(value);
    });
  });

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it.each(FIXTURES)('%s makes no request of any kind', (name, body) => {
    renderFixture(body);
    expect(fetchSpy, `${name} called fetch`).not.toHaveBeenCalled();
    expect(imageLoads, `${name} set an image src`).toEqual([]);
    expect(document.querySelectorAll('[src]'), `${name} left an element that would load`).toHaveLength(0);
  });
});

describe('T1663 · what the reader still sees', () => {
  it('images.md shows the alternative text of every image it did not fetch (FR-ART-022)', () => {
    const container = renderFixture(FIXTURES.find(([n]) => n === 'images.md')?.[1] ?? '');
    expect(container.textContent).toContain('a remote tracker');
    expect(container.textContent).toContain('an inline image');
    expect(container.querySelectorAll('[data-image="not-fetched"]').length).toBeGreaterThanOrEqual(2);
  });

  it('links.md keeps the blocked link\'s TEXT, and keeps the ordinary link a link', () => {
    const container = renderFixture(FIXTURES.find(([n]) => n === 'links.md')?.[1] ?? '');
    expect(container.textContent).toContain('javascript scheme');
    expect(container.textContent).toContain('data scheme');
    expect(container.textContent).toContain('vbscript scheme');
    const safe = [...container.querySelectorAll('a')].find((a) => a.textContent === 'an ordinary external link');
    expect(safe?.getAttribute('href')).toBe('https://example.test/safe');
    expect(safe?.getAttribute('rel')).toContain('noopener');
  });

  it('fences.md renders the unknown language and the diagram grammar as CODE, naming each', () => {
    const container = renderFixture(FIXTURES.find(([n]) => n === 'fences.md')?.[1] ?? '');
    const classes = [...container.querySelectorAll('code')].map((c) => c.className).join(' ');
    expect(classes).toContain('dhall-with-frills');
    expect(classes).toContain('mermaid');
    expect(container.textContent).toContain('let configuration');
    expect(container.textContent).toContain('graph TD;');
    // The html fence's content is code, not markup.
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.textContent).toContain('<script>window.__pwned = true;</script>');
  });

  it('html.md shows the raw block as text, headings and all', () => {
    const container = renderFixture(FIXTURES.find(([n]) => n === 'html.md')?.[1] ?? '');
    expect(container.querySelector('div.card')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain('A heading inside raw HTML');
    expect(container.textContent).toContain('<form action="https://evil.test/collect"');
  });

  it('relative.md links the siblings it has and marks the one it does not', () => {
    const container = renderFixture(FIXTURES.find(([n]) => n === 'relative.md')?.[1] ?? '');
    const links = [...container.querySelectorAll('a')].map((a) => a.textContent);
    expect(links).toContain('the plan');
    expect(links).toContain('the API contract');
    expect(links).not.toContain('the tasks');
    expect(container.textContent).toContain('no synced version');
    // A path that climbs out resolves to nothing this Epic has, so it is text.
    expect(links).not.toContain('up and out');
  });

  it('nothing in the whole corpus set a global the fixtures try to set', () => {
    for (const [, body] of FIXTURES) renderFixture(body);
    expect((globalThis as unknown as { __pwned?: boolean }).__pwned, 'a fixture executed').toBeUndefined();
  });
});

/**
 * `T1663` — a file above the limit is raw text, and raw text is not a rendering
 * path: `large.md` is GENERATED here rather than committed, because a
 * two-megabyte fixture in the repository would cost every clone forever to
 * assert one boundary (`contracts/viewer-contract.md` §6).
 */
describe('T1663 · large.md (generated above the limit)', () => {
  const large = `# Large\n\n<script>window.__pwned = true;</script>\n\n${'x'.repeat(64)}\n`;

  it('shows the content as text and executes nothing', () => {
    render(<MarkdownViewer markdown={large} sizeBytes={RENDER_LIMIT_BYTES + 1} />);
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(screen.getByText(/window\.__pwned/)).toBeDefined();
    expect((globalThis as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });
});
