/**
 * T436m / T436n (EPIC-036) — what the shell must never contain.
 *
 * `contracts/shell-contract.md` §6 lists six prohibitions and says they are
 * *"asserted by the Epic's own architecture check"*. This is that check, and it
 * asserts **all six** — the analysis of 2026-08-24 (`C2`) found the task
 * enumerating five, missing exactly the one `FR-SHL-003` turns on.
 *
 * Extended by `T438i` (no selection rules), `T439l` (no Home store) and
 * `T440h` (no viewport floor above 360px), which are the same question asked
 * about three different requirements.
 *
 * **Comments and string literals are stripped before scanning.** `EPIC-033`
 * `T337s` established this after an architecture check failed on prose that
 * merely mentioned the thing it forbade — a check that cannot tell code from a
 * comment about code punishes documentation, and this file is full of it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src', 'shell');

interface Source {
  readonly name: string;
  readonly raw: string;
  /** Comments and string literals removed. */
  readonly code: string;
}

function strip(text: string): string {
  return (
    text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      // ARIA's `role` is a semantics attribute — `role="status"`, `role="alert"`
      // — and has nothing to do with authorization. Leaving it in would make
      // prohibition 2 unsatisfiable by any accessible component, which is the
      // opposite of what this Epic wants: `BR-0193` requires those attributes.
      .replace(/\brole\s*=\s*(""|\{[^}]*\})/g, ' ')
  );
}

const SOURCES: Source[] = readdirSync(SHELL)
  .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
  .map((name) => {
    const raw = readFileSync(join(SHELL, name), 'utf8');
    return { name, raw, code: strip(raw) };
  });

const CSS = readFileSync(join(SHELL, 'shell.css'), 'utf8');

function offenders(pattern: RegExp, except: readonly string[] = []): string[] {
  return SOURCES.filter((source) => !except.includes(source.name) && pattern.test(source.code)).map(
    (source) => source.name,
  );
}

describe('T436n · the scan reads the shell, or it proves nothing', () => {
  it('reads every shell module', () => {
    // Anti-vacuity. A wrong directory would make all six prohibitions below
    // pass over an empty list — the check that cannot fail, which this Epic
    // treats as decoration rather than as coverage.
    expect(SOURCES.length, 'no shell sources were read at all').toBeGreaterThanOrEqual(10);
    expect(SOURCES.map((source) => source.name)).toContain('AppShell.tsx');
    expect(SOURCES.map((source) => source.name)).toContain('areas.ts');
  });

  it('strips comments and string literals before scanning', () => {
    // The mechanism itself, asserted — `T337s`'s precedent. Every prohibition
    // below is a word this file's own prose uses freely.
    expect(strip('const a = 1; // role permission')).not.toContain('role');
    expect(strip("const a = 'localStorage';")).not.toContain('localStorage');
    expect(strip('/* ROOM_REGIONS */ const a = 1;')).not.toContain('ROOM_REGIONS');
    expect(strip('const roleModel = 1;'), 'stripping removed real code').toContain('roleModel');
    // ARIA out, authorization in — the distinction prohibition 2 rests on.
    expect(strip('<p role="status">')).not.toContain('role');
    expect(strip('const userRole = x;')).toContain('userRole');
  });
});

describe('T436m · contracts §6 — the six prohibitions', () => {
  it('1. implements no area content — the shell hosts screens and calls no domain endpoint', () => {
    // The clause `FR-SHL-003` turns on, and the one `C2` found unasserted.
    // `home-sources.ts` is the single exception: Home is the one area this
    // Epic DELIVERS rather than hosts, and `FR-SHL-034` requires it to compose
    // existing endpoints rather than introduce one of its own.
    expect(offenders(/\bapi\.[a-z]\w*\s*\(/i, ['home-sources.ts'])).toEqual([]);
  });

  it('2. defines no permission or role model', () => {
    // `FR-SHL-014` is deferred to `EPIC-024` and `FR-SHL-003` forbids a second
    // authorization model. Every declared area is visible to any signed-in
    // identity, and the shell must not claim an awareness it does not have.
    expect(offenders(/\b(role|permission|authoriz|canAccess|isAllowed|grant)\w*/i)).toEqual([]);
  });

  it('3. declares no second region vocabulary', () => {
    // `EPIC-034` `T994t` and `EPIC-035` `T998y` compare their region names
    // against `ROOM_REGIONS`. A seventh region declared here would make those
    // comparisons pass against a vocabulary that had quietly grown.
    expect(offenders(/\b(ROOM_REGIONS|REGIONS)\s*(=|:)/)).toEqual([]);
    expect(offenders(/\bRoomRegion\b\s*=/)).toEqual([]);
  });

  it('4. defines no workspace or project selection rules (T438i, FR-SHL-025)', () => {
    // `EPIC-004` owns scoping and supplies the selectable set;
    // `prototype-parity.md` declines this control to the shell precisely
    // because "the shell may not invent its selector". The shell asks for the
    // list somewhere else and renders it.
    expect(offenders(/\blistProjects\s*\(/)).toEqual([]);
    expect(offenders(/\bprojects\s*\.\s*filter\s*\(/)).toEqual([]);
  });

  it('5. persists nothing (T439l — no Home store either)', () => {
    // No table, no migration, no store. Home derives its content on every read
    // and keeps none of it (`FR-SHL-034`).
    expect(offenders(/\b(localStorage|sessionStorage|indexedDB)\b/)).toEqual([]);
  });

  it('6. declares no design token values', () => {
    // PMI-DOC-005 is authoritative, and `prototype-parity.md` already declined
    // the prototype's own colour, focus-ring and type values as illustrative.
    // A literal here would be a second design system.
    expect(offenders(/#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i)).toEqual([]);
    const literals = [...CSS.matchAll(/:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/gi)].map(
      (match) => match[1],
    );
    expect(literals, `shell.css declares colour values: ${literals.join(', ')}`).toEqual([]);
  });
});

describe('T440h · FR-SHL-051 — no minimum viewport above 360px', () => {
  it('sets no min-width above the UX-0040 floor', () => {
    const mins = [...CSS.matchAll(/min-width\s*:\s*(\d+)px/gi)].map((match) => Number(match[1]));
    for (const value of mins) {
      expect(value, `shell.css sets a ${value}px floor, above UX-0040's 360px`).toBeLessThanOrEqual(
        360,
      );
    }
  });

  it('uses its narrow breakpoint as a max-width, so 360px is inside it', () => {
    // A breakpoint is not a floor: `max-width` narrows the layout, `min-width`
    // would exclude the device. `G-UX-03` is about the second.
    expect(CSS).toMatch(/@media\s*\(max-width:\s*767px\)/);
  });
});
