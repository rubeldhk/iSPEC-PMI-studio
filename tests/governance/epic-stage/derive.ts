/**
 * T472 / T474 / T476 — deriving an Epic's position from the file tree.
 *
 * **The one structural idea (data-model §0):**
 *
 *     DERIVED (from the file tree)          DECLARED (by a person)
 *     ────────────────────────────          ──────────────────────
 *     Stage        ─┐                    ┌─  Epic Kind
 *     DOR results  ─┤                    ├─  Posture
 *                   └──────► REGISTER ◄──┘   Waiver
 *
 * Nothing crosses that line. Everything in this file is on the derived side: it
 * reads directories and returns facts. It never reads an intent, and no caller
 * can inject a stage.
 *
 * Not a `.spec.ts`, so vitest never collects it — the `helpers.ts` convention.
 *
 * PURE, given a root. Every function takes the specs directory as an argument
 * and defaults to the real one, which is what lets the rules be tested against
 * trees this repository does not contain (`fixtures.ts`) while the default path
 * still runs against `specs/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../helpers';

export interface StageDefinition {
  readonly order: number;
  readonly name: string;
  readonly evidence: string;
  readonly next: string;
}

export interface DorConditionDefinition {
  readonly id: string;
  readonly condition: string;
  readonly reads: string;
  /**
   * Epic kinds this condition reaches. Absent means **every** kind — absence is
   * not an exemption, which is what keeps the carve-out narrow (`FR-ESK-015`).
   */
  readonly appliesTo?: readonly string[];
}

export interface StageConfig {
  readonly epicDirectoryPattern: string;
  readonly stages: StageDefinition[];
  readonly postureKinds: Record<string, { readonly meaning: string; readonly requires: string }>;
  readonly epicKinds: Record<
    string,
    { readonly terminalStage: string; readonly evaluatesDor: boolean; readonly requires?: string }
  >;
  readonly dorConditions: DorConditionDefinition[];
  readonly waiverRoles: string[];
}

export const SPECS_DIR = join(REPO_ROOT, 'specs');
const CONFIG_PATH = join(REPO_ROOT, 'governance/epic-stage.config.json');

let cachedConfig: StageConfig | undefined;

/** The stage model, read once. Configuration, never a literal in a check (`FR-ESK-015`). */
export function loadStageConfig(): StageConfig {
  cachedConfig ??= JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as StageConfig;
  return cachedConfig;
}

export interface EpicDirectory {
  /** `026-epic-stage-kanban` */
  readonly directory: string;
  /** `EPIC-026` */
  readonly id: string;
  /** From the spec's first heading; the directory name when there is none. */
  readonly title: string;
  readonly path: string;
  /** False when the directory carries no `spec.md`. */
  readonly valid: boolean;
  readonly findings: string[];
}

/**
 * Strip the document-type prefix from a spec's first heading.
 *
 * `# Epic Specification: Workspace Tenancy & Audit` → `Workspace Tenancy & Audit`.
 * The prefix varies across this repository ("Feature Specification", "Epic
 * Specification"), and repeating it in every register row would be 25 copies of
 * a word that distinguishes nothing.
 */
function titleFrom(specPath: string, fallback: string): string {
  if (!existsSync(specPath)) return fallback;
  const heading = /^#\s+(.+)$/m.exec(readFileSync(specPath, 'utf8'));
  if (!heading?.[1]) return fallback;
  const text = heading[1].trim();
  const stripped = /^(?:Epic|Feature)\s+Specification:\s*(.+)$/i.exec(text);
  return (stripped?.[1] ?? text).trim() || fallback;
}

/**
 * Every Epic directory under `specs/`, in identifier order.
 *
 * `FR-ESK-008` — no registration step, and the exclusion is **by pattern**.
 * `specs/_shared/` is absent because it does not match `NNN-`, not because it
 * appears on a list somebody maintains. A maintained list is a second source of
 * truth that silently omits the next directory added, which is the failure this
 * register exists to remove.
 */
export function enumerateEpics(specsDir: string = SPECS_DIR): EpicDirectory[] {
  const pattern = new RegExp(loadStageConfig().epicDirectoryPattern);

  return readdirSync(specsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((directory) => {
      const path = join(specsDir, directory);
      const specPath = join(path, 'spec.md');
      const hasSpec = existsSync(specPath);
      const findings: string[] = [];

      if (!hasSpec) {
        // Not "stage 0". An Epic without a specification is a mistake, and
        // filing a mistake as an early stage makes it look like progress.
        findings.push(`no spec.md — invalid Epic directory, not an early-stage Epic`);
      }

      return {
        directory,
        id: `EPIC-${directory.slice(0, 3)}`,
        title: titleFrom(specPath, directory),
        path,
        valid: hasSpec,
        findings,
      };
    });
}

// ---------------------------------------------------------------- evidence

/** Files in a folder under an Epic, or `[]` when the folder is absent. */
function filesIn(epicPath: string, folder: string): string[] {
  const dir = join(epicPath, folder);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function read(epicPath: string, file: string): string | undefined {
  const path = join(epicPath, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

/**
 * Is a dated clarification session recorded?
 *
 * `FR-ESK-018`. Deliberately NOT "are there no `[NEEDS CLARIFICATION]` markers":
 * absence of markers is the state of every freshly written spec, so deriving
 * `Clarified` from it would mark an Epic as clarified before the step ever ran.
 * A session that asked nothing still counts — the artifact records that the step
 * RAN, not that it found something (`FR-ESK-017`).
 */
export function hasClarificationSession(content: string | undefined): boolean {
  if (!content) return false;
  if (!/^##\s+Clarifications\s*$/m.test(content)) return false;
  return /^###\s+Session\s+\d{4}-\d{2}-\d{2}/m.test(content);
}

/** Zero unchecked items across at least one checklist file. */
export function checklistsResolved(epicPath: string): boolean {
  const files = filesIn(epicPath, 'checklists').filter((file) => file.endsWith('.md'));
  if (files.length === 0) return false;
  return files.every((file) => {
    const content = readFileSync(join(epicPath, 'checklists', file), 'utf8');
    return !/^\s*-\s*\[ \]/m.test(content);
  });
}

/** The seven evidence predicates, by stage name (`FR-ESK-001`, `FR-ESK-002`). */
export function evidenceFor(epicPath: string): Record<string, boolean> {
  return {
    Specified: existsSync(join(epicPath, 'spec.md')),
    Clarified: hasClarificationSession(read(epicPath, 'spec.md')),
    Checklisted: checklistsResolved(epicPath),
    Planned: existsSync(join(epicPath, 'plan.md')),
    Tasked: existsSync(join(epicPath, 'tasks.md')),
    Analyzed: existsSync(join(epicPath, 'analysis.md')),
    // Stage 7 is not an artifact — it is the DOR verdict, computed elsewhere.
    Ready: false,
  };
}

// ------------------------------------------------------------------- stage

export interface StageResult {
  /** The highest contiguous stage reached, or `null` for an invalid Epic. */
  readonly stage: string | null;
  /** The command the register tells a reader to run next. */
  readonly next: string;
  /** Evidence present above a gap — recorded, never counted (`FR-ESK-006`). */
  readonly outOfOrder: string[];
}

/**
 * The highest **contiguous** stage whose evidence is present, from 1.
 *
 * Evidence above a gap does not raise the stage:
 *
 *     spec ✓  clarif ✓  checklist ✓  plan ✗  tasks ✓  →  Checklisted
 *                                                        finding: tasks.md without plan.md
 *
 * Counting it would report an Epic as `Tasked` when nobody had planned it — the
 * register would show progress past a step that never happened, which is the
 * one thing a stage register must never do.
 */
export function deriveStage(epicPath: string, config: StageConfig = loadStageConfig()): StageResult {
  const evidence = evidenceFor(epicPath);
  const ordered = [...config.stages].sort((a, b) => a.order - b.order);

  let highest: StageDefinition | undefined;
  let broken = false;
  const outOfOrder: string[] = [];

  for (const stage of ordered) {
    // Stage 7 is the DOR verdict, not an artifact; readiness is layered on top
    // of this result rather than derived here.
    if (stage.name === 'Ready') continue;

    const present = evidence[stage.name] === true;
    if (present && !broken) {
      highest = stage;
    } else if (!present) {
      broken = true;
    } else {
      outOfOrder.push(`${stage.name} evidence present without the stage before it`);
    }
  }

  if (!highest) {
    return { stage: null, next: ordered[0]?.next ?? '—', outOfOrder };
  }

  // A stage's own `next` field IS the command to run from that stage — the
  // config table reads "Specified → /speckit-clarify". Looking up the following
  // stage's `next` instead is an off-by-one that tells a reader to skip a step,
  // which is precisely the error this register exists to catch. Caught by T475.
  return { stage: highest.name, next: highest.next, outOfOrder };
}
