/**
 * `T1225` (EPIC-038) — the package types, and the status that must never
 * default.
 *
 * `FR-CTX-042`, `FR-CTX-043`, `FR-CTX-044`.
 *
 * ## What a default would cost here
 *
 * `authoritativeStatus` answers *"is this still true?"* about material a model
 * is about to be given. A default of `current` fills the column for every item
 * whose status nobody resolved, and a reader cannot tell the two apart — the
 * item that was checked and is current, and the item nobody checked.
 *
 * A superseded requirement quoted as current is worse than one not quoted at
 * all: the model treats it as authoritative, the reviewer treats it as
 * authoritative, and nothing in the output says otherwise.
 *
 * So the union has three arms, all required, and two of them cannot exist
 * without the field that explains them. This is a type-level guarantee for the
 * reason `EPIC-035` gave one layer over: a validator runs where somebody
 * remembered to call it.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_STATUSES,
  type PackageItem,
} from '../../src/modules/context/package.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  resolve(here, '../../src/modules/context/package.types.ts'),
  'utf8',
);
/** Comments stripped before matching — a structural check must not fire on its own prose. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T1225 · authoritativeStatus is required, with no default', () => {
  it('names exactly three statuses', () => {
    expect([...AUTHORITATIVE_STATUSES].sort()).toEqual(
      ['current', 'superseded', 'undetermined'].sort(),
    );
  });

  it('and the field is not optional', () => {
    // `?:` here would let an item exist with no status at all, which reads as
    // "not recorded yet" and is treated as "fine".
    expect(CODE).toMatch(/readonly authoritativeStatus:/);
    expect(CODE).not.toMatch(/readonly authoritativeStatus\?:/);
  });

  it('and nothing in the module assigns a default', () => {
    // `FR-CTX-044`. The column fills with `current` for every unresolved item
    // the moment a default exists.
    //
    // Matched on ASSIGNMENT, not on `:`. The first version of this check used
    // `[:=]` and fired on the union's own discriminant —
    // `{ readonly authoritativeStatus: 'current' }` — which is the guarantee,
    // not a violation of it. A structural check that cannot tell a type
    // annotation from a default value reports the fix as the bug.
    expect(CODE).not.toMatch(/authoritativeStatus\s*=\s*['"]current['"]/);
    expect(CODE).not.toMatch(/authoritativeStatus.*(\?\?|\|\|)\s*['"]current['"]/);
  });

  it('the default check can fire', () => {
    // Anti-tautology, on both forms a default actually takes.
    expect(/authoritativeStatus\s*=\s*['"]current['"]/.test("authoritativeStatus = 'current'")).toBe(
      true,
    );
    expect(
      /authoritativeStatus.*(\?\?|\|\|)\s*['"]current['"]/.test(
        "authoritativeStatus: input.status ?? 'current',",
      ),
    ).toBe(true);
  });

  it('and does not fire on the union discriminant, which is the guarantee', () => {
    // The control for the correction above: the shape the module legitimately
    // contains must pass.
    expect(/authoritativeStatus\s*=\s*['"]current['"]/.test("readonly authoritativeStatus: 'current'")).toBe(
      false,
    );
  });
});

describe('T1225 · a superseded item names its successor, at the type level', () => {
  it('the superseded arm carries supersededBy', () => {
    // Not an optional field checked at runtime — a field somebody forgets to
    // check. An item marked superseded with nothing to point at does not
    // typecheck.
    const item: PackageItem = {
      id: 'pi_1',
      workspaceId: 'ws_1',
      packageId: 'cp_1',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v2',
      authoritativeStatus: 'superseded',
      supersededBy: 'rq_1@v3',
      inclusionReason: 'objective term: notification window',
      relevanceScore: 0.81,
      crossBoundary: false,
    };
    expect(item.supersededBy).toBe('rq_1@v3');
  });

  it('and the undetermined arm carries a reason', () => {
    const item: PackageItem = {
      id: 'pi_2',
      workspaceId: 'ws_1',
      packageId: 'cp_1',
      sourceType: 'specification',
      sourceId: 'sp_9',
      sourceVersion: 'v1',
      authoritativeStatus: 'undetermined',
      undeterminedReason: 'the baseline reader was unreachable',
      inclusionReason: 'objective term: booking',
      relevanceScore: 0.44,
      crossBoundary: false,
    };
    expect(item.undeterminedReason).toMatch(/unreachable/);
  });

  it('and a current item needs neither', () => {
    // The control. If every arm demanded every field, the union would be one
    // shape with optional members — which is what it exists not to be.
    const item: PackageItem = {
      id: 'pi_3',
      workspaceId: 'ws_1',
      packageId: 'cp_1',
      sourceType: 'requirement',
      sourceId: 'rq_2',
      sourceVersion: 'v4',
      authoritativeStatus: 'current',
      inclusionReason: 'objective term: notification',
      relevanceScore: 0.93,
      crossBoundary: false,
    };
    expect(item.authoritativeStatus).toBe('current');
  });
});

describe('T1225 · an item is a reference, never a copy', () => {
  it.each(['content', 'body', 'payload', 'text', 'excerpt'])(
    'no field is called %s',
    (field) => {
      // `FR-CTX-041`. A copy here would be a second source that can disagree,
      // and would put material under this Epic's access rules rather than the
      // artifact's — `EPIC-035`'s `T997m` bans the same thing one Room over.
      expect(new RegExp(`readonly ${field}\\b`, 'i').test(CODE), `carries ${field}`).toBe(false);
    },
  );

  it('the content check can fire', () => {
    expect(/readonly content\b/i.test('  readonly content: string;')).toBe(true);
  });

  it('but a source reference IS present, so the absence is not the absence of the concept', () => {
    expect(CODE).toMatch(/readonly sourceId:/);
    expect(CODE).toMatch(/readonly sourceVersion:/);
  });
});
