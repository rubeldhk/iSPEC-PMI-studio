/**
 * T685 · Check `G-26-12` — a hold stated in prose must be declared.
 *
 * **The gap this closes, and how it was found.** `T684` declared eighteen held
 * postures that had existed only as prose. A mutation then removed one of them
 * and **every test stayed green**: the assertion in `build.spec.ts` compares the
 * register's held set against the *declared* set, and those two move together.
 * It can see a declaration reaching the wrong Epic; it cannot see a declaration
 * that should exist and does not.
 *
 * That is the same gap `T684` spent a whole task fixing by hand — eighteen
 * Epics whose `spec.md` said `⏸ HELD` while the register read `stalled`. Without
 * this check nothing stops it reopening one Epic at a time.
 *
 * **`SC-ESK-010`**: *"the register agrees with the repository where
 * hand-maintained prose does not."* Agreement is only checkable if something
 * compares the two, and this is that something.
 *
 * ## Why the FIRST marker
 *
 * A spec may quote another Epic's posture — EPIC-026's discusses EPIC-009 and
 * EPIC-012 reading `⏸ HELD pending PMI-DOC-004`. Scanning for any occurrence
 * declared EPIC-026, a **proceeding, closed** Epic, as Held. The first marker in
 * the document is the Epic's own delivery-posture statement; later ones are
 * commentary.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enumerateEpics } from './derive';
import { loadDeclarations } from './declarations';

/** The Epic's own posture, from the first marker in its specification. */
function statedPosture(epicPath: string): 'held' | 'proceeding' | null {
  const spec = join(epicPath, 'spec.md');
  if (!existsSync(spec)) return null;
  const match = /(▶\s*\*{0,2}PROCEEDING|⏸\s*\*{0,2}HELD)/.exec(readFileSync(spec, 'utf8'));
  if (!match?.[1]) return null;
  return match[1].includes('HELD') ? 'held' : 'proceeding';
}

const DECLARATIONS = loadDeclarations();
const EPICS = enumerateEpics().map((epic) => ({
  ...epic,
  stated: statedPosture(epic.path),
  declared: DECLARATIONS.epics?.[epic.directory]?.posture,
}));

describe('G-26-12 · a stated hold is a declared hold (SC-ESK-010)', () => {
  it('finds Epics stating a posture, or this check proves nothing', () => {
    // Guard against a vacuous pass: if the marker convention ever changes, the
    // scan returns nothing and every assertion below is satisfied by an empty
    // list while the register quietly stops agreeing with the repository.
    expect(EPICS.filter((epic) => epic.stated !== null).length).toBeGreaterThan(20);
  });

  it('declares a posture for every Epic whose spec states HELD', () => {
    const undeclared = EPICS.filter((epic) => epic.stated === 'held' && !epic.declared);
    expect(
      undeclared.map((epic) => epic.id),
      'these Epics record ⏸ HELD in their own spec.md and declare no posture, so the register ' +
        'reads them as stalled — and DOR-12 passes, which means back-filling their analysis ' +
        'records would let them read Ready while decision D-10 blocks the work',
    ).toEqual([]);
  });

  it('declares that hold as Held, not as some other kind', () => {
    const wrong = EPICS.filter(
      (epic) => epic.stated === 'held' && epic.declared && epic.declared.kind !== 'Held',
    );
    expect(wrong.map((epic) => `${epic.id}:${epic.declared?.kind}`)).toEqual([]);
  });

  it('does NOT declare a proceeding Epic as held', () => {
    // The inverse, and the one a loose scan gets wrong. EPIC-026 is PROCEEDING
    // and its spec quotes two other Epics' holds; an "any occurrence" scan
    // declared it Held and would have taken a closed epic out of readiness.
    const contradicted = EPICS.filter(
      (epic) => epic.stated === 'proceeding' && epic.declared?.kind === 'Held',
    );
    expect(
      contradicted.map((epic) => epic.id),
      'declared Held while their own spec.md records ▶ PROCEEDING',
    ).toEqual([]);
  });

  it('names what would release every declared hold (DF-3)', () => {
    for (const epic of EPICS) {
      if (epic.declared?.kind !== 'Held') continue;
      expect(epic.declared.awaiting?.trim(), `${epic.id} is Held and names no awaiting input`).toBeTruthy();
    }
  });
});
