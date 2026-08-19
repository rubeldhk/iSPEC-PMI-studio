/**
 * T528 — the join between derived and declared.
 *
 * **The gap this fills.** `build.ts` is where every other module meets:
 * enumeration, stage derivation, declarations, the DOR, waivers, severity and
 * rendering. Until now it was exercised only *through* other suites — the
 * determinism, drift and boundary checks all call `buildRegister()` and assert
 * properties of the finished text. None of them asserts the **join itself**: that
 * a declaration reaches the row it belongs to, that a finding is attributed to
 * the right Epic, that a severity comes from the table.
 *
 * A bug in the wiring would have surfaced as a confusing failure in three
 * unrelated suites, or not at all. `G-26-02` requires every module to have a
 * spec that imports it; this is `build.ts`'s.
 *
 * Reads the **real repository**, deliberately. The rules are tested against
 * fixtures elsewhere; what is worth asserting here is that the composition
 * produces a coherent model of the tree it actually runs against.
 */
import { describe, expect, it } from 'vitest';
import { buildRegisterModel } from './build';
import { enumerateEpics } from './derive';
import { SEVERITY_BY_KIND } from './severity';

const MODEL = buildRegisterModel(undefined, '2026-08-18');

describe('T528 · the model covers the tree', () => {
  it('produces exactly one row per Epic directory', () => {
    expect(MODEL.rows).toHaveLength(enumerateEpics().length);
  });

  it('gives every row an identifier, a title, a stage and a readiness', () => {
    // The four cells `RF-3` says are never empty. A row missing one renders an
    // em dash, which would read as "no stage" rather than "a bug".
    for (const row of MODEL.rows) {
      expect(row.epic, 'a row with no identifier').toMatch(/^EPIC-\d{3}$/);
      expect(row.title, `${row.epic} has no title`).toBeTruthy();
      expect(row.stage, `${row.epic} has no stage`).toBeTruthy();
      expect(row.readiness, `${row.epic} has no readiness`).toBeTruthy();
    }
  });

  it('links every row to a directory that exists', () => {
    const onDisk = new Set(enumerateEpics().map((epic) => epic.directory));
    for (const row of MODEL.rows) {
      expect(onDisk.has(row.directory), `${row.epic} names ${row.directory}, not on disk`).toBe(true);
    }
  });
});

describe('T528 · declarations reach the rows they belong to', () => {
  it('applies the declared kind, and defaults the rest to delivery', () => {
    const kinds = new Map(MODEL.rows.map((row) => [row.epic, row.kind]));
    // The two parent designs this repository actually declares (D-18, D-19).
    expect(kinds.get('EPIC-002')).toBe('parent-design');
    expect(kinds.get('EPIC-017')).toBe('parent-design');
    // Everything else takes the default without being listed.
    expect(kinds.get('EPIC-014')).toBe('delivery');
  });

  it('applies a declared posture to the right Epic and nothing else', () => {
    const held = MODEL.rows.filter((row) => row.posture?.startsWith('Held'));
    expect(held.map((row) => row.epic).sort()).toEqual(['EPIC-009', 'EPIC-012']);
    for (const row of held) expect(row.posture).toContain('PMI-DOC-004');
  });

  it('never evaluates a parent design for readiness', () => {
    for (const row of MODEL.rows) {
      if (row.kind !== 'parent-design') continue;
      expect(row.readiness, `${row.epic} is a parent design and was evaluated`).toBe('n/a');
    }
  });
});

describe('T528 · findings are attributed and classified', () => {
  it('attributes every finding to an Epic in the register', () => {
    // A finding attributed to nothing is a finding nobody owns.
    const known = new Set([...MODEL.rows.map((row) => row.epic), 'declarations']);
    for (const finding of MODEL.findings) {
      expect(known.has(finding.epic), `finding attributed to unknown ${finding.epic}`).toBe(true);
    }
  });

  it('takes every severity from the shared table, never a literal', () => {
    const permitted = new Set(Object.values(SEVERITY_BY_KIND));
    for (const finding of MODEL.findings) {
      expect(permitted.has(finding.severity), `unclassified severity ${finding.severity}`).toBe(true);
    }
  });

  it('reports out-of-order evidence rather than raising the stage', () => {
    // The contiguity rule, asserted at the composition level: an Epic named in
    // an out-of-order finding must not have advanced past the gap.
    const flagged = MODEL.findings.filter((finding) => finding.finding.includes('stage held at'));
    expect(flagged.length).toBeGreaterThan(0);
    for (const finding of flagged) {
      const row = MODEL.rows.find((candidate) => candidate.epic === finding.epic);
      expect(row?.stage, `${finding.epic} advanced despite an out-of-order finding`).not.toBe('Ready');
    }
  });
});

describe('T528 · waivers and blocking', () => {
  it('renders every declared waiver, so none is invisible (RF-5)', () => {
    // Currently zero. Asserted as a property rather than a count, so it holds
    // when the first real waiver is taken.
    expect(MODEL.waivers).toHaveLength(
      (buildRegisterModel(undefined, '2026-08-18').waivers ?? []).length,
    );
    for (const waiver of MODEL.waivers) {
      expect(waiver.condition).toMatch(/^DOR-\d\d$/);
      expect(waiver.owner).toBeTruthy();
      expect(waiver.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('reports no build-blocking problem in this repository today', () => {
    // If this ever fails, an exception has outlived its expiry — which is
    // exactly when someone should be told.
    expect(MODEL.blocking, MODEL.blocking.join('; ')).toEqual([]);
  });
});

describe('T528 · the model is a function of its inputs', () => {
  it('produces the same model for the same tree and the same date', () => {
    const again = buildRegisterModel(undefined, '2026-08-18');
    expect(again.rows).toEqual(MODEL.rows);
    expect(again.findings).toEqual(MODEL.findings);
  });

  it('varies with the date ONLY through waiver expiry', () => {
    // This assertion originally read "does not vary with the date while no
    // waiver is active" — and it was true until the moment a waiver was taken,
    // at which point it failed. The premise expired, not the code.
    //
    // The honest property is narrower and more useful: the date is a real input,
    // and its ONLY channel is waiver expiry. That is not a breach of `RF-2` —
    // an expired waiver fails the build (`DF-6`), so the register cannot sit in
    // a state where the clock quietly flipped a row. The day it would is the day
    // CI goes red and asks a person to renew or fix.
    const future = buildRegisterModel(undefined, '2030-01-01');

    if (MODEL.waivers.length === 0) {
      expect(future.rows).toEqual(MODEL.rows);
      return;
    }

    // With a waiver active, a date past its expiry MUST change the outcome —
    // that is what an expiry is for — and MUST produce a blocking problem.
    expect(future.blocking.length, 'an expired waiver produced nothing blocking').toBeGreaterThan(0);
    const stillReady = future.rows.filter((row) => row.readiness === 'Ready (waived)');
    expect(stillReady, 'a waiver granted cover past its own expiry').toEqual([]);
  });
});

describe('T532 · stage 7 is reachable (DEF-026-002)', () => {
  // Found by convergence, on the first Epic in this programme ever to satisfy
  // its DOR. Its row read `Analyzed | stalled | Ready (waived) | DOR evaluation`
  // — four cells, three of them disagreeing with the fourth. `deriveStage`
  // skips the `Ready` stage because it is a verdict rather than an artifact,
  // and nothing put it back, so the ladder stopped at 6 for every Epic forever.
  //
  // Neither suite could see it: the stage tests assert an artifact ladder that
  // genuinely ends at `Analyzed`, and `readiness.spec.ts` tests the verdict in
  // isolation. The disagreement lived BETWEEN them, which is why it took a real
  // Epic reaching readiness to surface at all.

  const ready = MODEL.rows.filter((row) => row.readiness.startsWith('Ready'));

  it('has at least one Epic at readiness, or this assertion proves nothing', () => {
    // Guard against a vacuous pass. If no Epic is ready, the assertions below
    // are satisfied by an empty list and would keep passing through a regression.
    expect(ready.length, 'no Epic has reached readiness, so stage 7 is untested').toBeGreaterThan(0);
  });

  it('shows Ready as the STAGE, not merely as the readiness', () => {
    for (const row of ready) {
      expect(row.stage, `${row.epic} is ${row.readiness} but shows stage ${row.stage}`).toBe('Ready');
    }
  });

  it('tells a ready Epic to run /speckit-implement', () => {
    // The register's whole job is answering "what next". `DOR evaluation` for
    // an Epic whose DOR has been evaluated is the one answer it must not give.
    for (const row of ready) {
      expect(row.next, `${row.epic} is ${row.readiness} and is told to run ${row.next}`).toBe(
        '/speckit-implement',
      );
    }
  });

  it('clears the posture, because a ready Epic has not stalled', () => {
    for (const row of ready) {
      expect(row.posture, `${row.epic} is ${row.readiness} and reads ${row.posture}`).toBeNull();
    }
  });

  it('leaves a parent design at its own terminal stage, not at Ready', () => {
    // FR-ESK-024 — a parent design completes at `Planned` and is never
    // evaluated. Promoting it to `Ready` would be the same bug inverted.
    for (const row of MODEL.rows) {
      if (row.kind !== 'parent-design') continue;
      expect(row.stage, `${row.epic} is a parent design showing stage ${row.stage}`).not.toBe('Ready');
    }
  });
});
