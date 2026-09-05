/**
 * `T1560` (EPIC-044) — the file-tree evidence adapter, moved from
 * `tests/governance/epic-stage/derive.ts` (T472 / T474 / T476). PURE given a
 * root: every function takes the directory it reads, so the governance register
 * passes this repository's `specs/` and a test passes a temporary tree.
 *
 * Everything here is on the DERIVED side of `data-model §0`'s line: it reads
 * directories and returns facts. It never reads an intent, and no caller can
 * inject a stage.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadStageConfig, type StageConfig } from './config.js';

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
 * Every Epic directory under a `specs/`-shaped root, in identifier order.
 *
 * `FR-ESK-008` — no registration step, and the exclusion is **by pattern**.
 */
export function enumerateEpics(specsDir: string, config: StageConfig = loadStageConfig()): EpicDirectory[] {
  const pattern = new RegExp(config.epicDirectoryPattern);

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
 * absence of markers is the state of every freshly written spec. A session that
 * asked nothing still counts — the artifact records that the step RAN
 * (`FR-ESK-017`).
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
