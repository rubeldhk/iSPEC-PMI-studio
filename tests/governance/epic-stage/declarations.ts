/**
 * T497 / T498 / T499 — the declared side of the register.
 *
 *     DERIVED (from the file tree)          DECLARED (by a person)
 *     ────────────────────────────          ──────────────────────
 *     Stage        ─┐                    ┌─  Epic Kind      ← here
 *     DOR results  ─┤                    ├─  Posture        ← here
 *                   └──────► REGISTER ◄──┘   Waiver         ← here
 *
 * `derive.ts` reads the tree and never reads an intent. This file reads intent
 * and never reads the tree — except to check that the things a declaration
 * *points at* exist, which is `DF-3`.
 *
 * `epic-declarations.json` is the only hand-authored input to the register, and
 * therefore the only place it can be lied to. Every rule below exists to make a
 * lie visible rather than to prevent one.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../helpers';
import { loadStageConfig } from './derive';

export type EpicKind = 'delivery' | 'parent-design';

export interface PostureDeclaration {
  readonly kind: string;
  readonly awaiting?: string;
  readonly blockedBy?: string;
  readonly replacedBy?: string;
  readonly reason?: string;
}

export interface EpicDeclaration {
  readonly kind?: string;
  readonly children?: string[];
  readonly reason?: string;
  readonly posture?: PostureDeclaration;
}

export interface DeclarationsFile {
  readonly epics?: Record<string, EpicDeclaration>;
  readonly waivers?: unknown[];
}

const DECLARATIONS_PATH = join(REPO_ROOT, 'governance/epic-declarations.json');

/** The declarations, or an empty set. Absence is legitimate: the file lists exceptions. */
export function loadDeclarations(path: string = DECLARATIONS_PATH): DeclarationsFile {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8')) as DeclarationsFile;
}

// ------------------------------------------------------------------- kind

/** Declared kind, or the default. Absence is never a decision. */
export function epicKindOf(directory: string, declarations: DeclarationsFile): EpicKind {
  const declared = declarations.epics?.[directory]?.kind;
  return declared === 'parent-design' ? 'parent-design' : 'delivery';
}

/** Where each kind's journey ends (`FR-ESK-024`). Read from configuration. */
export function terminalStageFor(kind: EpicKind): string {
  return loadStageConfig().epicKinds[kind]?.terminalStage ?? 'Ready';
}

/**
 * Is this kind evaluated for readiness?
 *
 * A parent design is not: the DOR requires a task list, and evaluating an Epic
 * defined not to have one reports a permanent failure that means nothing.
 */
export function evaluatesDor(kind: EpicKind): boolean {
  return loadStageConfig().epicKinds[kind]?.evaluatesDor ?? true;
}

// ---------------------------------------------------------------- posture

export interface PostureInput {
  readonly directory: string;
  readonly stage: string | null;
  readonly kind: EpicKind;
  readonly declaration: EpicDeclaration | undefined;
}

/**
 * The Posture cell: a declared stop, `stalled`, or nothing.
 *
 * **`stalled` is derived and can never be declared** (`FR-ESK-006`). An Epic
 * stopped by decision and an Epic stopped by neglect look identical on disk;
 * presenting the second as the first converts drift into apparent governance
 * and removes any reason to look again. If `stalled` were declarable, the one
 * honest signal in this column could be switched off by whoever it reported on.
 *
 * "Stopped" is **structural**, not temporal — the register carries no timestamps
 * (`RF-2`), so it cannot know whether an Epic moved last week. An Epic short of
 * its terminal stage has stopped as far as this document can tell.
 */
export function derivePosture(input: PostureInput): string | null {
  const posture = input.declaration?.posture;

  // Only the three known kinds are rendered. Anything else — a typo, an
  // invented fourth kind, an attempt to declare `stalled` — falls through to
  // the derived reading and grants nothing, while `validateDeclarations`
  // reports it separately.
  //
  // Note there is deliberately NO `Object.hasOwn(postureKinds, ...)` guard here.
  // One was written and then removed: the switch already ignores every
  // unrecognised kind, so the guard could not change any outcome, and a
  // mutation removing it left every test green. Code that cannot be observed to
  // work is code that only appears to be a control.
  switch (posture?.kind) {
    case 'Held':
      return `Held — awaiting \`${posture.awaiting ?? '(unnamed)'}\``;
    case 'Blocked':
      return `Blocked — by \`${posture.blockedBy ?? '(unnamed)'}\``;
    case 'Superseded':
      return `Superseded — by \`${posture.replacedBy ?? '(unnamed)'}\``;
    default:
      break;
  }

  return input.stage === terminalStageFor(input.kind) ? null : 'stalled';
}

// ------------------------------------------------------------- validation

export interface EpicFacts {
  readonly hasTasks?: boolean;
}

export interface DeclarationsValidation {
  readonly problems: string[];
}

/**
 * Every problem in the declarations, with the Epic it belongs to.
 *
 * Exhaustive rather than first-failure, for the same reason `FR-ESK-013`
 * requires it of the DOR: one pass should tell an author everything they need
 * to fix, or they correct one and rerun to find the next.
 */
export function validateDeclarations(
  raw: unknown,
  onDisk: readonly string[],
  facts: Record<string, EpicFacts> = {},
): DeclarationsValidation {
  const problems: string[] = [];
  const file = (raw ?? {}) as DeclarationsFile;
  const known = new Set(onDisk);
  const postureKinds = loadStageConfig().postureKinds;

  for (const [directory, declaration] of Object.entries(file.epics ?? {})) {
    // DF-1: keys are directory names. One identity, one spelling — accepting
    // `EPIC-009` too would mean two ways to declare one Epic and a silent winner.
    if (/^EPIC-\d{3}$/i.test(directory)) {
      problems.push(
        `${directory}: keys are directory names, not EPIC labels (DF-1) — use the directory on disk`,
      );
      continue;
    }

    if (!known.has(directory)) {
      problems.push(`${directory}: declared but no such Epic directory exists`);
      continue;
    }

    if (declaration.kind !== undefined && !['delivery', 'parent-design'].includes(declaration.kind)) {
      problems.push(`${directory}: kind "${declaration.kind}" is not delivery or parent-design`);
    }

    if (declaration.kind === 'parent-design') {
      if (!declaration.children || declaration.children.length === 0) {
        problems.push(
          `${directory}: parent-design names no children (DF-3) — a container declaring no contents`,
        );
      }
      for (const child of declaration.children ?? []) {
        if (!known.has(child)) {
          problems.push(`${directory}: child "${child}" is not an Epic directory on disk`);
        }
      }
      if (!declaration.reason?.trim()) {
        problems.push(`${directory}: parent-design carries no reason`);
      }
      // The contradiction is reported, never resolved: either the declaration
      // is wrong or the tasks belong to a child, and the register does not guess.
      if (facts[directory]?.hasTasks) {
        problems.push(
          `${directory}: declared parent-design but holds tasks.md — either the declaration is wrong or the tasks belong to a child`,
        );
      }
    }

    const posture = declaration.posture;
    if (!posture) continue;

    // DF-4: kind is not posture. A parent design has not stopped; it finished
    // at a different line.
    if (posture.kind === 'parent-design') {
      problems.push(`${directory}: parent-design is an Epic kind, not a posture kind (DF-4)`);
      continue;
    }

    if (!Object.hasOwn(postureKinds, posture.kind)) {
      problems.push(
        `${directory}: posture kind "${posture.kind}" is not one of ${Object.keys(postureKinds).join(', ')}`,
      );
      continue;
    }

    // DF-3 — the rule that keeps the file honest. "Held — pending" names
    // nothing, can be released by nobody, and is a stall wearing a label.
    const required = postureKinds[posture.kind]?.requires ?? '';
    const value = (posture as unknown as Record<string, string | undefined>)[required];
    if (!value?.trim()) {
      problems.push(`${directory}: posture ${posture.kind} names no "${required}" (DF-3, FR-ESK-005)`);
    } else if (
      (required === 'blockedBy' || required === 'replacedBy') &&
      !known.has(value)
    ) {
      problems.push(`${directory}: posture ${posture.kind} names "${value}", which is not on disk`);
    }

    if (!posture.reason?.trim()) {
      problems.push(`${directory}: posture ${posture.kind} carries no reason`);
    }
  }

  return { problems };
}
