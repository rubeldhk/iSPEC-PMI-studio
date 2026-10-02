/**
 * `T1236` (EPIC-038) — three boundaries this module must not cross.
 *
 * Asserted over every source file in `backend/src/modules/context/`, so the
 * guarantee holds for files that do not exist yet. A boundary checked only
 * against today's code is one the next file crosses.
 *
 * ## The three, and why each is a boundary rather than a preference
 *
 * **No source payload.** `FR-CTX-041`, `R-038-7`. A copy of governed material
 * here would sit under this Epic's access rules rather than the artifact's,
 * which is how a classified specification becomes readable by everyone who can
 * open a context package. `EPIC-035`'s `T997m` bans the same thing one Room
 * over, and its reasoning transfers exactly: reproduction detail was the one
 * place a user was encouraged to paste a payload, and here it is the whole
 * corpus.
 *
 * **No second access model.** `FR-CTX-054`. `EPIC-024` adjudicates. A second
 * check is a second thing that can be wrong, and the two would disagree
 * silently — the version that grants more being the one nobody notices.
 *
 * **No embedding vendor in the data model.** `FR-CTX-013`, `R-038-4`. This Epic
 * builds retrieval, which is precisely the decision that invites a vendor's
 * vector shape into the stored record. Building it is not licence to bind the
 * record to one provider, because the record is the part that cannot be
 * swapped later.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(here, '../../src/modules/context');

interface Source {
  readonly path: string;
  readonly code: string;
}

/** Every `.ts` under the module, comments stripped. */
function sources(dir: string): Source[] {
  const found: Source[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sources(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    found.push({
      path: entry,
      // Stripped before matching. A structural check that fires on its own
      // explanatory prose has caught this repository out at least five times,
      // and each time the fix was to strip rather than to reword.
      code: readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    });
  }
  return found;
}

const SOURCES = sources(MODULE_DIR);

describe('T1236 · the module has files to check', () => {
  it('reads a substantial number, or every assertion below is vacuous', () => {
    expect(SOURCES.length).toBeGreaterThan(2);
  });
});

describe('T1236 · no source payload is stored here', () => {
  it.each(['content', 'body', 'payload', 'blob', 'base64', 'excerpt'])(
    'no field is called %s',
    (field) => {
      for (const source of SOURCES) {
        expect(
          new RegExp(`readonly ${field}\\b`, 'i').test(source.code),
          `${source.path} carries ${field}`,
        ).toBe(false);
      }
    },
  );

  it('the payload check can fire', () => {
    expect(/readonly payload\b/i.test('  readonly payload: Buffer;')).toBe(true);
  });

  it('but source references ARE present, so the absence is not the absence of the concept', () => {
    // The positive half. A module storing no reference at all would pass every
    // assertion above and fail `FR-CTX-040`.
    expect(SOURCES.some((s) => /sourceId/.test(s.code))).toBe(true);
  });
});

describe('T1236 · no second access model', () => {
  it.each(['PolicyEngine', 'RoleResolver', 'PermissionService', 'AccessControlService'])(
    'never imports %s',
    (name) => {
      // `FR-CTX-054`. `AccessPolicy` is a port this module declares and
      // `EPIC-024` fills; importing an adjudicator directly would be the second
      // model arriving through the back door.
      for (const source of SOURCES) {
        expect(
          new RegExp(`import[^;]*\\b${name}\\b`).test(source.code),
          `${source.path} imports ${name}`,
        ).toBe(false);
      }
    },
  );

  it('the import check can fire', () => {
    expect(/import[^;]*\bPolicyEngine\b/.test("import { PolicyEngine } from '../access';")).toBe(
      true,
    );
  });

  it('and AccessPolicy IS declared as a port, so the rule has something to point at', () => {
    expect(SOURCES.some((s) => /AccessPolicy/.test(s.code))).toBe(true);
  });
});

describe('T1236 · no embedding vendor in the data model', () => {
  it.each(['openai', 'cohere', 'voyage', 'text-embedding', 'ada-002', 'sentence-transformers'])(
    'never names %s',
    (vendor) => {
      // `FR-CTX-013`. The model identifier is a value stored on a row
      // (`R-038-4`), never a name compiled into the shape of the record.
      for (const source of SOURCES) {
        expect(
          new RegExp(vendor, 'i').test(source.code),
          `${source.path} names ${vendor}`,
        ).toBe(false);
      }
    },
  );

  it('the vendor check can fire', () => {
    expect(/text-embedding/i.test("const model = 'text-embedding-3-small';")).toBe(true);
  });

  it('and the model is carried as data, so it can be swapped', () => {
    // The positive half: `R-038-4` requires every entry to record which model
    // produced it, because two models of one dimension rank nonsense together
    // without erroring.
    expect(SOURCES.some((s) => /embeddingModelId/.test(s.code))).toBe(true);
  });
});
