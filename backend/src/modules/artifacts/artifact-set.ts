/**
 * `T1631` (EPIC-045, `R-045-9`) — which paths a sync may carry, and what kind
 * each one is.
 *
 * The set is **imported from `@pmi/workspace-bundle`**. The finish hook
 * computes the digests of exactly `ARTIFACT_FILES` plus the `.md` files one
 * level down under `contracts/` and `checklists/`; a platform holding its own
 * copy of that list would drift from the hook, refusing files the hook was told
 * to send or storing files it was never told to. One list, two readers
 * (`packages/workspace-bundle/src/hook-sequences.ts`).
 *
 * Two refusals live here, and both are decided on the path ALONE, before any
 * content is read:
 *
 * - `path_escapes_epic` — the path is absolute, carries a `..` segment, or uses
 *   a backslash. These are the shapes that would make a stored path mean
 *   something other than "a file inside this Epic's directory".
 * - `path_not_in_artifact_set` — the path is well-formed and inside `specs/`,
 *   but names a file the hook would never have sent (`closure.md`,
 *   `defects/`, a `.yaml`, a third directory level).
 */
import { ARTIFACT_FILES } from '@pmi/workspace-bundle';
import type { ArtifactKind, RefusalCode } from './artifact.store.js';

/** `spec.md` → `spec`, `data-model.md` → `data-model`. The bundle's names, minus the extension. */
const KIND_BY_NAME: ReadonlyMap<string, ArtifactKind> = new Map(ARTIFACT_FILES.map((name) => [name, name.replace(/\.md$/, '') as ArtifactKind]));

/** The two sub-directories the hook walks, and the kind a `.md` in each becomes. */
const SUBDIRECTORY_KINDS: Readonly<Record<string, ArtifactKind>> = Object.freeze({ contracts: 'contract', checklists: 'checklist' });

export type PathClassification =
  | { readonly ok: true; readonly kind: ArtifactKind; readonly epicDir: string }
  | { readonly ok: false; readonly code: Extract<RefusalCode, 'path_escapes_epic' | 'path_not_in_artifact_set'>; readonly detail: string };

function escapes(code: 'path_escapes_epic', detail: string): PathClassification {
  return { ok: false, code, detail };
}

function notInSet(detail: string): PathClassification {
  return { ok: false, code: 'path_not_in_artifact_set', detail };
}

/**
 * Classify one synced path. Never throws: a sync of two hundred files must be
 * able to refuse one and keep the rest (`FR-ART-004`).
 */
export function classifyPath(path: string): PathClassification {
  if (path.length === 0) return notInSet('an empty path names no file');

  // Shape first. A backslash is not a separator here — the hook joins with `/`
  // even on Windows — so one is either an escape attempt or a file name that
  // cannot round-trip, and both are refused rather than normalised.
  if (path.includes('\\')) return escapes('path_escapes_epic', 'a path may not contain a backslash');
  if (path.startsWith('/')) return escapes('path_escapes_epic', 'a path must be relative to the project directory');
  if (/^[A-Za-z]:/.test(path)) return escapes('path_escapes_epic', 'a path must be relative to the project directory');

  const segments = path.split('/');
  if (segments.some((s) => s === '..')) return escapes('path_escapes_epic', 'a path may not climb out of its Epic directory');
  if (segments.some((s) => s.length === 0)) return notInSet('a path may not contain an empty segment');
  if (segments.some((s) => s === '.')) return notInSet('a path may not contain a "." segment');

  if (segments[0] !== 'specs') return notInSet('an artifact lives under specs/<epic directory>/');

  // `specs/<dir>/<name>` or `specs/<dir>/<contracts|checklists>/<name>.md`.
  // Exactly one directory level under `specs/`, and at most one below it —
  // which is what the hook walks and therefore all that can have come from it.
  const epicDir = segments.length >= 3 ? `${segments[0]}/${segments[1]}` : null;
  if (epicDir === null) return notInSet('an artifact lives under specs/<epic directory>/');

  if (segments.length === 3) {
    const kind = KIND_BY_NAME.get(segments[2] as string);
    if (kind === undefined) return notInSet(`"${segments[2]}" is not one of the artifact set`);
    return { ok: true, kind, epicDir };
  }

  if (segments.length === 4) {
    const kind = SUBDIRECTORY_KINDS[segments[2] as string];
    if (kind === undefined) return notInSet(`"${segments[2]}/" is not a synced sub-directory`);
    if (!(segments[3] as string).endsWith('.md')) return notInSet(`only .md files are synced from ${segments[2]}/`);
    return { ok: true, kind, epicDir };
  }

  return notInSet('an artifact is at most one directory below its Epic directory');
}

/** The Epic directory a synced path names, or null when the path is refused. */
export function epicDirectoryOf(path: string): string | null {
  const result = classifyPath(path);
  return result.ok ? result.epicDir : null;
}
