/**
 * T403e — the handoff names no specification engine. `FR-RQR-062`, `BR-0027`.
 *
 * *"The handoff MUST be engine-agnostic — a baseline is not a Spec Kit
 * artifact."*
 *
 * **`BR-0027` says a baselined set is selectable by *one or more* specification
 * workflows** — plural, and unnamed. The moment `speckit` appears in the
 * handoff, that stops being true: a second engine needs a second field, or the
 * first one's vocabulary starts meaning "engine" generally, and a baseline has
 * quietly become a Spec Kit thing.
 *
 * **Comments are stripped; string literals are NOT**, and the asymmetry is
 * deliberate — it is the opposite choice from `room-contract-independence`
 * (`T337s`) and `transport-independence`, for a reason those two do not share.
 * Those checks look for a *type* being referenced, and a type cannot be
 * referenced from inside a string, so stripping strings only removed false
 * positives. Here the danger IS a string: `specificationWorkflowRef` is an
 * opaque string, and the way an engine gets named is a literal — a prefix
 * check, a `startsWith('speckit:')`, a default value. So literals are scanned,
 * and the prose explaining why Spec Kit is absent lives in comments where it
 * cannot trip the check.
 *
 * **Also asserted: the reference stays a plain `string`.** A structured
 * reference is where an `engine` field would eventually go, and it would look
 * like a reasonable refactor at the time.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src/modules/requirement-room');

/** The files that make up the handoff. */
const FILES = ['handoff.service.ts', 'requirement-room.store.ts'] as const;

/** Comments removed; string literals deliberately kept. See the note above. */
function code(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Engines and engine artifacts this repository knows about, plus the shapes a
 * new one would arrive in. Not a guess: `engine-adapters/` and
 * `packages/engine-contract` are where these names live, and none of them
 * belongs in a Room.
 */
const ENGINE_VOCABULARY = [
  /\bspec[\s_-]?kit\b/i,
  /\bspeckit\b/i,
  /\bengine[A-Za-z]*\s*[:=]/,
  /\bSpecificationEngine\b/,
  /\bengine-adapter/i,
  /--integration\b/,
  /\bslash[\s_-]?command\b/i,
];

/** Files that would drag an engine in by importing one. */
const ENGINE_IMPORT = /from\s+['"](@pmi\/engine-contract|@pmi\/engine-adapter[^'"]*|.*engine-adapters[^'"]*)['"]/;

describe('T403e · the handoff is engine-agnostic (FR-RQR-062)', () => {
  const sources = FILES.map((name) => ({
    name,
    body: readFileSync(resolve(SRC, name), 'utf8'),
  }));

  it('has the handoff files to check — an empty scan would prove nothing', () => {
    expect(sources).toHaveLength(FILES.length);
    for (const source of sources) {
      expect(source.body.length).toBeGreaterThan(0);
    }
  });

  it.each(FILES)('%s names no specification engine, in code or in a literal', (name) => {
    const source = sources.find((s) => s.name === name)!;
    const stripped = code(source.body);
    const hits = ENGINE_VOCABULARY.filter((pattern) => pattern.test(stripped)).map(String);

    expect(hits).toEqual([]);
  });

  it.each(FILES)('%s imports no engine contract or adapter', (name) => {
    const source = sources.find((s) => s.name === name)!;

    expect(ENGINE_IMPORT.test(source.body)).toBe(false);
  });

  it('keeps specificationWorkflowRef a plain string, not a structured reference', () => {
    const store = sources.find((s) => s.name === 'requirement-room.store.ts')!;

    // A structured reference is where an `engine` field eventually goes, and it
    // would look like a reasonable refactor at the time.
    expect(code(store.body)).toMatch(/specificationWorkflowRef:\s*string;/);
  });

  it('does not parse, split or match on the reference anywhere', () => {
    const service = sources.find((s) => s.name === 'handoff.service.ts')!;
    const stripped = code(service.body);

    // `trim()` is fine; the rest are how an opaque reference stops being one.
    // A `startsWith('speckit:')` is the exact shape FR-RQR-062 forbids, and it
    // would not be caught by the vocabulary scan if the prefix were a variable.
    for (const parsing of [/\.startsWith\(/, /\.split\(/, /\.match\(/, /\.includes\(/]) {
      expect(stripped).not.toMatch(parsing);
    }
  });

  it('still catches an engine name in a string, or the comment-stripping is a hole', () => {
    // Anti-vacuity for `code()`. If a future edit stripped string literals too —
    // matching the two sibling architecture tests — this whole file would pass
    // over a handoff that hard-coded an engine.
    const planted = code(`
      /* a comment mentioning Spec Kit, which must be allowed */
      const ref = 'speckit:workflow-7';
    `);

    expect(planted).not.toMatch(/comment mentioning/);
    expect(ENGINE_VOCABULARY.some((pattern) => pattern.test(planted))).toBe(true);
  });
});
