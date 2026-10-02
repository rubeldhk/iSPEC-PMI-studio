# Contract: the file tree and the markdown viewer

**Epic**: `EPIC-045` · **Date**: 2026-09-05 · [research.md](../research.md) `R-045-5`, `R-045-13`

## §1 · Where (`FR-ART-011`, `FR-ART-019`)

- **Epic detail** (`/requirement-room/epics/:epicId`, `EPIC-044`): a *Files* section
  (`EpicFiles`) below the Stage section — the tree, the selected file's header and the rendered
  document. Selection in the URL: `?file=<path>&version=<versionId>`; no version means current.
  The board card's *Open Epic* leads here.
- **Specification detail** (`/specifications/:id`): the current version's content rendered by the
  same `MarkdownViewer`.

## §2 · The tree

Grouped by folder (`specs/<dir>/` then `contracts/`, `checklists/`), each file with kind, size,
digest (first 12 hex shown, full on hover/title), and the producing execution of its current
version (command · outcome · time). A file `notInLatestSync` is listed with that marker. Refusals
and the reported-versus-synced findings are listed under the tree, each naming the execution.
**No control** creates, uploads, renames, edits or deletes (`FR-ART-010`); a sentence states that
the project directory is authoritative and PMI Studio a mirror.

## §3 · The header of an open file

`path` · kind · *Version n of m* · digest · *produced by `<command>` · `<outcome>` · `<time>`
(execution id as a link to the timeline)* · **Not the current version** when applicable ·
the version picker (newest first; each entry: command · outcome · time · digest; an entry with
several executions lists them all).

## §4 · Rendering rules (`FR-ART-017`, `FR-ART-020` to `FR-ART-025`)

| Construct | Behaviour |
|---|---|
| Headings, paragraphs, lists, task lists, tables, block quotes, code, emphasis, links | rendered (GFM) |
| Raw HTML | escaped text (`react-markdown` default; no `rehype-raw`) |
| `javascript:`, `data:`, `vbscript:` URLs | dropped by `defaultUrlTransform` — the link renders as text |
| Images, frames, objects | never fetched: `urlTransform` returns null for `src`; `img` renders its alternative text in a marked span |
| Relative link to a sibling artifact | opens that file's current version in the viewer (`?file=`) |
| Relative link to a path the Epic has no version of | rendered as text with *no synced version* |
| External link | `target="_blank" rel="noopener noreferrer"`, referrer policy no-referrer |
| Unknown fenced language | code block with the language named |
| GFM task-list checkbox | rendered disabled |
| File above 2 MiB | raw text with the reason; a *render anyway* control is **not** offered |

## §5 · States (`FR-ART-015`)

Tree: *loading* · *empty* (“No governed command has synced files for this Epic yet; the first
completed specify produces `spec.md`.”) · *error* (the sentence and the rest of the Epic detail
standing) · *partial* (tree loaded, content failed, or the reverse). Viewer: *loading* ·
*rendered* · *raw (too large)* · *error*.

## §6 · The hostile corpus (`FR-ART-024`, `SC-ART-004`)

`frontend/tests/fixtures/hostile-markdown/`: `script.md` (script element, inline handler),
`links.md` (`javascript:`, `data:`, `vbscript:`), `images.md` (remote image, data-URL image,
frame, object), `html.md` (raw block and inline HTML), `fences.md` (unknown language, a diagram
grammar), `relative.md` (sibling links, one to a missing file), `large.md` (generated above the
limit). Tests assert: no `script` element, no `on*` attribute, no `href` with a blocked scheme,
no element with a `src`, no frame or object, every hostile construct present as text or code.
**Mutation**: replacing the viewer's `urlTransform` with the identity is observed to fail
`images.md` and `links.md`; removing the `components.img` override is observed to fail `images.md`.

## §7 · Tests

- `frontend/tests/unit/design/markdown-viewer.spec.tsx` — the rendering table and the corpus.
- `frontend/tests/unit/pages/epic-files.spec.tsx` — tree, header, picker, `notInLatestSync`,
  refusals, findings, four states, no editing control, URL selection.
- `frontend/tests/unit/pages/specification-detail.spec.tsx` (extended) — renders through the same
  component.
- `frontend/tests/unit/pages/epic-detail.spec.tsx` (extended) — the section is present and its
  failure leaves the rest standing.
