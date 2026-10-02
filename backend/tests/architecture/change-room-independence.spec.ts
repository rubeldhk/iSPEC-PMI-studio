/**
 * `T406l`, `T406m` (EPIC-034) — what this Room must not contain.
 *
 * Every assertion here is an **absence**, which is why they read the directory
 * as text rather than importing it. A verb that must not exist cannot be proved
 * gone by calling it.
 *
 * Four bans, each with a reason that is not style:
 *
 * - **No region vocabulary of its own** (`FR-CHR-002`, `R-034-3`). Three Rooms
 *   naming the same six regions three ways is how they stop looking like one
 *   product. `packages/room-contract` names them; this Room imports.
 * - **No second impact traversal** (`FR-CHR-031`, `R-034-1`). `ImpactService`
 *   and `ChainTraversalService` own the graph at depth 25. A second traversal
 *   would eventually disagree with the first, and nobody would know which was
 *   right.
 * - **No `TaskRegenerationService`** (`R-034-2`, `FR-CHR-065`). It replaces a
 *   task list; `BR-0154` requires revision without destroying completed work.
 *   **The import ban is the load-bearing clause** — a boundary that depends on
 *   remembering is not a boundary.
 * - **No requirement text and no Defect Room vocabulary.** `EPIC-007` owns
 *   requirement bodies (`D-33`) and `EPIC-035` owns defects; a Room that stored
 *   either would be a second home for something that already has one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(here, '../../src/modules/change-room');

function sourcesUnder(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourcesUnder(full));
    } else if (name.endsWith('.ts')) {
      out.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

/** Comments removed: the rule is about the declared code, not the prose. */
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const SOURCES = sourcesUnder(MODULE_DIR).map((s) => ({ ...s, code: stripComments(s.text) }));

describe('T406l · the module exists and is read', () => {
  it('has sources to check', () => {
    // The control every assertion below rests on. An empty directory would
    // satisfy every ban vacuously.
    expect(SOURCES.length).toBeGreaterThan(0);
  });

  it('the comment stripper does not eat code', () => {
    expect(stripComments('const a = 1; // note\n/* block */ const b = 2;')).toContain('const a = 1;');
    expect(stripComments('/* TaskRegenerationService */ const c = 3;')).not.toContain(
      'TaskRegeneration',
    );
  });
});

describe('T406l · no second impact traversal', () => {
  it.each(['ChainTraversalService', 'ImpactService'])(
    'never re-implements %s',
    (service) => {
      // Consuming them is the design (`T406o` composes both). Declaring a class
      // of the same name here would be the second graph `R-034-1` forbids.
      for (const source of SOURCES) {
        expect(source.code.includes(`class ${service}`), `${source.path} declares ${service}`).toBe(
          false,
        );
      }
    },
  );

  it('configures no traversal depth of its own', () => {
    // `R-034-1` adopts `DEFAULT_IMPACT_DEPTH`. A local constant would be a
    // second answer to "how deep", and the two would drift.
    for (const source of SOURCES) {
      expect(source.code.includes('DEFAULT_IMPACT_DEPTH ='), source.path).toBe(false);
      expect(/maxDepth\s*[:=]\s*\d+/.test(source.code), `${source.path} hardcodes a depth`).toBe(
        false,
      );
    }
  });
});

describe('T406l · no TaskRegenerationService, at all', () => {
  it('never imports it', () => {
    // The load-bearing clause. `FR-CHR-062` asks for re-planning and
    // `regenerate()` would satisfy the sentence in one call while violating
    // `BR-0154` in the same call, because it REPLACES a task list.
    for (const source of SOURCES) {
      expect(source.code.includes('TaskRegeneration'), `${source.path} reaches for it`).toBe(false);
      expect(source.code.includes('task-regeneration'), source.path).toBe(false);
    }
  });

  it('never calls a `regenerate` verb', () => {
    for (const source of SOURCES) {
      expect(/\bregenerate\s*\(/.test(source.code), `${source.path} calls regenerate()`).toBe(false);
    }
  });

  it('the import check can actually fail', () => {
    // Anti-tautology: without this the bans above would pass against a matcher
    // that never matched anything.
    expect(
      stripComments("import { TaskRegenerationService } from 'x';").includes('TaskRegeneration'),
    ).toBe(true);
  });
});

describe('T406l · no vocabulary of its own', () => {
  it('declares no region names', () => {
    // `FR-CHR-002` — the six regions are `packages/room-contract`'s. A Room
    // declaring its own is how three Rooms stop looking like one product.
    for (const source of SOURCES) {
      expect(source.code.includes('ROOM_REGIONS ='), `${source.path} redeclares the regions`).toBe(
        false,
      );
      expect(source.code.includes('objectState'), source.path).toBe(false);
      expect(source.code.includes('activityTimeline'), source.path).toBe(false);
    }
  });

  it('declares no epistemic vocabulary', () => {
    // `R-034-3` — imported, never derived. `option.types.ts` narrows the
    // contract's `Epistemic`; it does not restate the kinds.
    for (const source of SOURCES) {
      expect(source.code.includes('EPISTEMIC_KINDS ='), source.path).toBe(false);
    }
  });

  it('holds no requirement text', () => {
    // `D-33` — `EPIC-007` owns requirement bodies. A change references the
    // versions it freezes; it does not copy what they say.
    for (const source of SOURCES) {
      expect(/readonly\s+description\s*:/.test(source.code), `${source.path} stores a body`).toBe(
        false,
      );
    }
  });

  it('holds no Defect Room vocabulary', () => {
    // `EPIC-035` owns defects. A change request is not a defect, and a Room that
    // typed one would be a second home for something that has one.
    for (const source of SOURCES) {
      expect(source.code.includes('DefectRoom'), source.path).toBe(false);
      expect(/\bdefectId\b/.test(source.code), `${source.path} names a defect`).toBe(false);
    }
  });
});
