/**
 * T337s — what the shared Room contract must never contain. `FR-RQR-002`,
 * `FR-RQR-003`, `D-33`.
 *
 * `packages/room-contract` is imported by three Epics. Anything that leaks into
 * it leaks into all three, and the leak that matters most is the first one
 * below.
 *
 * **No requirement-storage type.** `FR-RQR-002` and `D-33`: this Room *consumes*
 * the register `EPIC-007` owns. The contract's own comment names this as the
 * boundary most likely to be crossed, *"because a local cache of requirement
 * text would feel convenient every single day"* — and a convenient cache in a
 * package three Rooms import is a second source of truth for all of them.
 *
 * **The rule is about what the contract DECLARES.** An earlier draft scanned
 * every identifier and failed three ways on its first run:
 *
 *   - `ports.ts` declares a port named `RequirementRegister` — which the
 *     contract *must* name, because it is the seam through which this Room
 *     reaches `EPIC-007`'s register. Naming a seam is not storing what is
 *     behind it;
 *   - the same file's `because` strings say "baseline" and "Evidence Contract",
 *     because a reason has to explain what it is a reason for;
 *   - `epistemic.ts` has `isEpistemic(candidate: string)` — a parameter name,
 *     and a coincidence of English.
 *
 * So comments *and string literals* are stripped, and only **declared names**
 * are checked. `EPIC-030`'s `T958` reached the same conclusion the same way: a
 * check that has to be loosened three times is measuring the wrong thing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SRC = resolve(here, '../../../packages/room-contract/src');
const SHELL_SRC = resolve(here, '../../../frontend/src/rooms');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

/** Comments and string literals removed — see the note above on why both. */
function code(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/** The names this file declares — interface, type, class, enum, const, function. */
function declaredNames(body: string): string[] {
  return [...body.matchAll(/\b(?:interface|type|class|enum|const|function)\s+([A-Za-z_$][\w$]*)/g)]
    .map((m) => m[1] ?? '')
    .filter(Boolean);
}

const contract = walk(CONTRACT_SRC).map((p) => ({
  rel: relative(CONTRACT_SRC, p),
  body: code(readFileSync(p, 'utf8')),
}));

const shell = walk(SHELL_SRC).map((p) => ({
  rel: relative(SHELL_SRC, p),
  body: code(readFileSync(p, 'utf8')),
}));

describe('T337s · there is contract source to check', () => {
  it('found it', () => {
    // Anti-vacuity: an empty list makes every assertion below pass forever.
    expect(contract.length).toBeGreaterThan(3);
    expect(shell.length).toBeGreaterThan(1);
  });

  it('reads declarations from it, or the name-based rules see nothing', () => {
    const all = contract.flatMap((f) => declaredNames(f.body));
    expect(all).toContain('ROOM_REGIONS');
    expect(all).toContain('Labelled');
  });
});

describe('FR-RQR-002, D-33 · no requirement storage in the shared contract', () => {
  it('declares no requirement type or store', () => {
    const offenders = contract.filter((f) =>
      declaredNames(f.body).some((n) => /requirement/i.test(n)),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('declares no candidate, baseline, clarification or acceptance-criteria type', () => {
    const offenders = contract.filter((f) =>
      declaredNames(f.body).some((n) =>
        /(candidate|baseline|acceptanceCriteri|clarification)/i.test(n),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('would notice one if it were added — the check checks itself', () => {
    const planted = 'export interface RequirementCache { text: string }';
    expect(declaredNames(planted)).toContain('RequirementCache');
  });

  it('does NOT flag a port that merely names the seam', () => {
    // The false positive this rule was rewritten to avoid, asserted so a later
    // tightening cannot reintroduce it without an argument.
    const seam = "const ROOM_PORTS = [{ name: 'RequirementRegister' }];";
    expect(declaredNames(code(seam)).some((n) => /requirement/i.test(n))).toBe(false);
  });
});

describe('FR-RQR-003 · no Change or Defect Room vocabulary', () => {
  it.each(['changeRequest', 'impactView', 'defect', 'triage', 'reproduction'])(
    'declares no type or const containing "%s"',
    (word) => {
      const offenders = contract.filter((f) =>
        declaredNames(f.body).some((n) => new RegExp(word, 'i').test(n)),
      );
      expect(offenders.map((o) => o.rel)).toEqual([]);
    },
  );

  it('imports nothing from a Room module', () => {
    // Read RAW, not stripped: `code()` blanks string literals, and an import
    // specifier IS a string literal. Stripping is right for the vocabulary rules
    // and wrong for this one — the same file needs both readings.
    const offenders = contract.filter((f) =>
      /from\s+['"][^'"]*(requirement-room|change-room|defect-room|backend\/src)/.test(
        readFileSync(join(CONTRACT_SRC, f.rel), 'utf8'),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe("the contract borrows no other Epic's vocabulary either", () => {
  it('declares no loop stage name — EPIC-030 owns that', () => {
    // `RoomShell` renders the loop-progress PROJECTION; it does not know the
    // stages. A stage name declared here would make the shared contract carry
    // EPIC-030's model as well as its own.
    const offenders = contract.filter((f) =>
      declaredNames(f.body).some((n) =>
        /^(Analyze|Decide|Evidence|Outcome|LOOP_STAGES|LoopStage)$/.test(n),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('declares no risk band or evidence type — EPIC-031 and EPIC-032 own those', () => {
    const offenders = contract.filter((f) =>
      declaredNames(f.body).some((n) =>
        /(riskBand|riskClass|attestation|evidenceItem)/i.test(n),
      ),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('imports no framework — the contract stays renderer-free', () => {
    // A React import in `packages/` would put a framework dependency in a
    // package the backend also imports, and would stop a Room's tests
    // constructing these props without a renderer.
    const offenders = contract.filter((f) =>
      /from\s+['"]react/.test(readFileSync(join(CONTRACT_SRC, f.rel), 'utf8')),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('UX-0035 · the shell derives no vocabulary of its own', () => {
  it('takes its region names from the contract rather than restating them', () => {
    // If RoomShell listed the six names itself, it could drift from
    // ROOM_REGIONS — and the comparison EPIC-034 T994t and EPIC-035 T998y run
    // against that tuple would pass over a shell rendering something else.
    const raw = readFileSync(join(SHELL_SRC, 'RoomShell.tsx'), 'utf8');
    expect(raw).toMatch(/from '@pmi\/room-contract'/);
  });

  it('accepts no layout, className or breakpoint prop', () => {
    // The bypass that ends the one-shell guarantee, asserted in source as well
    // as in types: a Room passing its own layout is three Rooms with three
    // breakpoint sets.
    const shellFile = shell.find((f) => f.rel === 'RoomShell.tsx');
    expect(shellFile?.body).not.toMatch(/\bclassName\?:/);
    expect(shellFile?.body).not.toMatch(/\bbreakpoint/i);
  });
});
