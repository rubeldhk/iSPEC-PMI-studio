/**
 * T483 — compose the register from the repository.
 *
 * The join between the derived side (`derive.ts`) and the rendered side
 * (`render.ts`). Kept separate from `register.spec.ts` so the composition can be
 * imported by the drift and determinism checks in Phase 4 without re-running a
 * suite.
 *
 * **Phase 6 scope.** Stage, declarations and the full DOR are all joined here.
 * Readiness is computed rather than assumed, and every failing condition travels
 * with it.
 *
 * **`today` is injected, never read from the clock inside a render.** Waiver
 * expiry depends on the date while `RF-2` forbids clock-derived content. Both
 * hold because an expired waiver **fails the build** (`DF-6`): the register
 * cannot legitimately sit in a state where the clock flipped a row, since the
 * day that happens is the day CI goes red and demands a decision.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { deriveStage, enumerateEpics, loadStageConfig } from './derive';
import {
  derivePosture,
  epicKindOf,
  evaluatesDor,
  loadDeclarations,
  validateDeclarations,
} from './declarations';
import { evaluateDor, resolveReadiness, type WaiverDeclaration } from './dor';
import { renderRegister, type Finding, type StageRow, type Waiver } from './render';
import { severityOf } from './severity';

export interface RegisterModel {
  readonly rows: StageRow[];
  readonly findings: Finding[];
  readonly waivers: Waiver[];
  /** Build-failing problems — expired waivers (`DF-6`). Surfaced by `G-26-10`. */
  readonly blocking: string[];
}

/**
 * Derive every row, finding and waiver from the tree plus the declarations.
 *
 * `today` defaults to the caller's clock ONLY at the outermost edge, and every
 * test injects it. See the note above on why that is not an RF-2 breach.
 */
export function buildRegisterModel(specsDir?: string, today?: string): RegisterModel {
  const config = loadStageConfig();
  const declarations = loadDeclarations();
  const declaredWaivers = (declarations.waivers ?? []) as WaiverDeclaration[];
  const asOf = today ?? new Date().toISOString().slice(0, 10);
  const rows: StageRow[] = [];
  const findings: Finding[] = [];
  const blocking: string[] = [];

  const epics = enumerateEpics(specsDir);

  // DF-3 — references are checked against what is actually on disk, so a
  // rename cannot leave a declaration pointing at nothing while still reading
  // as authoritative.
  const facts = Object.fromEntries(
    epics.map((epic) => [epic.directory, { hasTasks: existsSync(join(epic.path, 'tasks.md')) }]),
  );
  for (const problem of validateDeclarations(
    declarations,
    epics.map((epic) => epic.directory),
    facts,
  ).problems) {
    const directory = problem.split(':')[0] ?? '';
    const owner = epics.find((epic) => epic.directory === directory);
    findings.push({
      epic: owner?.id ?? 'declarations',
      finding: problem,
      severity: severityOf('malformedDeclaration'),
    });
  }

  for (const epic of epics) {
    // An invalid Epic directory is a finding, not a row with a blank stage —
    // an Epic without a specification is a mistake, and giving it a stage would
    // file the mistake as progress.
    for (const finding of epic.findings) {
      findings.push({ epic: epic.id, finding, severity: severityOf('invalidEpicDirectory') });
    }

    // DEF-026-007 — kind is resolved BEFORE stage derivation, because the
    // next-command half of the derivation takes it: a parent design must not
    // be told to run a command FR-ESK-024 defines it as never running.
    const kind = epicKindOf(epic.directory, declarations);

    const derived = deriveStage(epic.path, config, kind);
    for (const outOfOrder of derived.outOfOrder) {
      findings.push({
        epic: epic.id,
        finding: `${outOfOrder} — stage held at ${derived.stage ?? 'none'}`,
        severity: severityOf('outOfOrderArtifact'),
      });
    }
    const declaration = declarations.epics?.[epic.directory];
    const posture = derivePosture({
      directory: epic.directory,
      stage: derived.stage,
      kind,
      declaration,
    });

    // Evaluated for every Epic, including parent designs — `resolveReadiness`
    // returns `n/a` for those, but the conditions are still computed so a
    // contradiction (a parent design that somehow HAS tasks) still surfaces.
    //
    // T683 — the kind decides which conditions reach it. A parent design is not
    // judged on a task list `FR-ESK-024` defines it not to have; `DOR-07` and
    // `DOR-08` report not applicable rather than failing forever.
    const dor = evaluateDor(
      { epicPath: epic.path, directory: epic.directory, declarations },
      kind,
    );

    const resolved = resolveReadiness({
      directory: epic.directory,
      kind,
      failures: dor.failed,
      waivers: declaredWaivers,
      today: asOf,
      epicsOnDisk: epics.map((entry) => entry.directory),
    });

    blocking.push(...resolved.blocking);
    for (const problem of resolved.reported) {
      findings.push({ epic: epic.id, finding: problem, severity: severityOf('malformedWaiver') });
    }
    for (const problem of resolved.blocking) {
      findings.push({ epic: epic.id, finding: problem, severity: severityOf('expiredWaiver') });
    }

    // DEF-026-002 — stage 7 is a VERDICT, not an artifact, so `deriveStage`
    // cannot reach it and correctly stops at `Analyzed`. Layered here, at the
    // one seam where derived meets declared, rather than by making stage
    // derivation depend on declarations — which would cross the line the whole
    // design rests on.
    //
    // Without this the first Epic ever to satisfy its DOR read
    // `Analyzed | stalled | Ready (waived) | DOR evaluation`: four cells, three
    // disagreeing with the fourth, telling a ready Epic to evaluate the DOR
    // that had just said yes.
    const isReady = evaluatesDor(kind) && resolved.readiness.startsWith('Ready');
    const stage = isReady ? 'Ready' : (derived.stage ?? 'Unspecified');
    const next = isReady ? '/speckit-implement' : derived.next;

    rows.push({
      epic: epic.id,
      directory: epic.directory,
      title: epic.title,
      kind,
      stage,
      // A ready Epic has reached its terminal stage, so it has not stalled.
      posture: isReady ? null : posture,
      readiness: evaluatesDor(kind) ? resolved.readiness : 'n/a',
      next: next === '—' ? null : next,
    });
  }

  // RF-5 — a waiver is visible in the register or it does not exist. Burying an
  // exception in a config file nobody reads is how a gate gets quietly skipped.
  const waivers: Waiver[] = declaredWaivers.map((waiver) => ({
    // Declarations key by DIRECTORY (`DF-1`, "one identity, one spelling"); the
    // register displays the IDENTIFIER, as `RF-5`'s example shows. Mapped here
    // so the waivers table and the main table name the same Epic the same way —
    // a register that spells one Epic two ways is a register a reader has to
    // decode.
    epic: epics.find((entry) => entry.directory === waiver.epic)?.id ?? waiver.epic,
    condition: waiver.condition,
    owner: waiver.owner,
    expires: waiver.expires,
    reason: waiver.reason,
  }));

  return { rows, findings, waivers, blocking };
}

/** The register text, ready to compare or write. */
export function buildRegister(specsDir?: string, today?: string): string {
  const { rows, findings, waivers } = buildRegisterModel(specsDir, today);
  return renderRegister(rows, findings, waivers);
}
