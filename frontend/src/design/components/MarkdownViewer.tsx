/**
 * `T1647` / `T1664` (EPIC-045, `FR-ART-017`, `FR-ART-020`–`FR-ART-025`,
 * `FR-ART-061`) — the ONE markdown renderer in this application.
 *
 * ## The sanitising strategy, in full
 *
 * Synced markdown is untrusted: it was written by an agent on a developer's
 * machine and uploaded by a connector credential. Four decisions, each of which
 * is asserted over a hostile corpus in `markdown-viewer.spec.tsx`:
 *
 * 1. **No `rehype-raw`.** `react-markdown` escapes raw HTML by default, so
 *    `<script>` in a document is the *text* `<script>`, never an element. This
 *    is why there is no `dangerouslySetInnerHTML` anywhere in `frontend/src`
 *    and no sanitiser beside the renderer: there is no HTML string to sanitise.
 *    `no-raw-html.spec.ts` is the boundary check that keeps it true.
 * 2. **`defaultUrlTransform` still runs.** Wrapping it rather than replacing it
 *    keeps the library's own blocking of `javascript:`, `data:` and `vbscript:`
 *    URLs — the check most easily lost by writing a `urlTransform` from scratch.
 * 3. **Every `src` returns null.** Not one image, frame or object is fetched, so
 *    rendering a synced file makes **zero** network requests and cannot be used
 *    to report that someone read it. `components.img` renders the alternative
 *    text in a marked span instead, so nothing is silently dropped.
 * 4. **Nothing is editable.** GFM task-list checkboxes render disabled: the
 *    project directory is authoritative and this is a mirror (`FR-ART-010`).
 *
 * ## Links
 *
 * A relative link to a sibling artifact opens that file **in the viewer**
 * rather than navigating the browser, because the target is a stored version
 * and not a URL. A relative link the Epic has no version of renders as text
 * saying so — better than a link that 404s, and better than hiding it.
 * External links open in a new tab with `noopener noreferrer` and no referrer.
 */
import type { ReactElement, ReactNode } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RENDER_LIMIT_BYTES } from '../../config/viewer';

export interface MarkdownViewerProps {
  /** The file, verbatim. */
  markdown: string;
  /** The stored byte length — the platform's measure, not `markdown.length`. */
  sizeBytes: number;
  /** The synced path this content came from; relative links resolve against it. */
  path?: string;
  /** Every path the Epic has a version of — a relative link outside it is not a link. */
  syncedPaths?: readonly string[];
  /** Called with the resolved path when a reader follows a relative sibling link. */
  onOpenSibling?: (path: string) => void;
}

/**
 * Resolve `href` against `path`'s directory. Deliberately small: `..` is
 * honoured so `../007-intake/spec.md` works, and the result is only ever
 * compared against `syncedPaths` — it never reaches a filesystem or a URL.
 */
function resolveRelative(href: string, path: string | undefined): string | null {
  if (path === undefined) return null;
  const base = path.split('/').slice(0, -1);
  const out: string[] = [...base];
  for (const segment of href.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.length > 0 ? out.join('/') : null;
}

/** A link that names a file rather than an address: no scheme, no `//`, no anchor-only. */
function isRelativeArtifactLink(href: string): boolean {
  return href.length > 0 && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !href.startsWith('//') && !href.startsWith('#');
}

/**
 * Wraps the library's own transform instead of replacing it, so the
 * `javascript:`/`data:`/`vbscript:` blocking stays; then drops every `src`, so
 * nothing is fetched (`FR-ART-021`, `FR-ART-022`).
 */
function urlTransform(url: string, key: string, node: { tagName?: string }): string | null {
  if (key === 'src') return null;
  if (node.tagName === 'iframe' || node.tagName === 'object' || node.tagName === 'embed') return null;
  const safe = defaultUrlTransform(url);
  return safe === '' ? null : safe;
}

export function MarkdownViewer({ markdown, sizeBytes, path, syncedPaths, onOpenSibling }: MarkdownViewerProps): ReactElement {
  if (sizeBytes > RENDER_LIMIT_BYTES) {
    // Raw text with the reason. No control is offered to render it anyway: a
    // limit a reader can wave away is not a limit (`FR-ART-023`).
    return (
      <section className="ds-markdown ds-markdown--raw">
        <p className="ds-markdown__notice" role="status">
          This file is {sizeBytes} bytes, above the {RENDER_LIMIT_BYTES}-byte rendering limit, so it is shown as plain text. The project directory holds the original.
        </p>
        <pre className="ds-markdown__pre">{markdown}</pre>
      </section>
    );
  }

  const known = new Set(syncedPaths ?? []);
  const hasVersion = (resolved: string): boolean => syncedPaths === undefined || known.has(resolved);

  return (
    <section className="ds-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          // Never fetched. The alternative text is shown so the reader knows
          // an image was there and what it said (`FR-ART-024`: nothing is
          // silently dropped).
          img: ({ alt }): ReactElement => (
            <span className="ds-markdown__image" data-image="not-fetched">
              {alt && alt.length > 0 ? `Image: ${alt}` : 'Image (not fetched)'}
            </span>
          ),
          a: ({ href, children }): ReactElement => {
            const target = typeof href === 'string' ? href : '';
            if (isRelativeArtifactLink(target)) {
              const resolved = resolveRelative(target, path);
              if (resolved !== null && hasVersion(resolved)) {
                return (
                  <a
                    href={`?file=${encodeURIComponent(resolved)}`}
                    onClick={(event): void => {
                      event.preventDefault();
                      onOpenSibling?.(resolved);
                    }}
                  >
                    {children as ReactNode}
                  </a>
                );
              }
              return (
                <span className="ds-markdown__dead-link">
                  {children as ReactNode} <span className="ds-markdown__note">(no synced version)</span>
                </span>
              );
            }
            if (target === '') return <span>{children as ReactNode}</span>;
            return (
              <a href={target} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                {children as ReactNode}
              </a>
            );
          },
          // A GFM task list is a picture of the file's state, not a control.
          input: (props): ReactElement => <input {...props} disabled readOnly />,
          code: ({ className, children, ...rest }): ReactElement => {
            const language = /language-(\S+)/.exec(className ?? '')?.[1];
            if (language === undefined) {
              return (
                <code className={className} {...rest}>
                  {children as ReactNode}
                </code>
              );
            }
            // The language is named to the READER as well as to the class
            // attribute, so an unknown grammar is visibly a code block in that
            // language rather than mysterious monospace (`FR-ART-025`).
            return (
              <>
                <span className="ds-markdown__language" aria-hidden="true">
                  {language}
                </span>
                <code className={className} {...rest}>
                  {children as ReactNode}
                </code>
              </>
            );
          },
        }}
      >
        {markdown}
      </Markdown>
    </section>
  );
}
