/**
 * `@pmi/workspace-bundle` — EPIC-041 `T1317` (`R-041-9`).
 *
 * The files PMI Studio puts into a user's project directory, versioned as one
 * thing: the `setup-PMIStudio` skill (copied by the API's **prepare** step,
 * before Spec Kit is initialised) and the PMI Spec Kit extension (copied by the
 * worker's **initialise** step, after it). Two halves, one version — because the
 * skill must exist before initialisation for a pending project to have a
 * completion path, and the extension cannot exist before it because it lives
 * under `.specify/`.
 *
 * **This package names no engine in its identifier**, so `backend/` may import
 * it and copy the skills half (`engine-independence.spec.ts` scans `backend/src`
 * for the string). The extension's *content* necessarily names Spec Kit, and is
 * copied only by the worker.
 *
 * ## Why the skills-path mapping is here (analysis `C4`, `FR-LPW-006`)
 *
 * Where a setup skill goes depends on the agent integration — Claude Code reads
 * `.claude/skills/`; another agent reads its own directory. Putting that table
 * in provisioning code would make `provisioning.service.ts` name an agent, which
 * `FR-LPW-006` forbids. Putting it here makes it configuration: adding an
 * integration is a row and a test, never an edit to the service. And there is
 * **no default row**: copying a Claude Code skill into another agent's directory
 * would "work" while installing something nothing will read.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Semver. Bumped whenever either half changes; recorded on every provisioning record (`FR-LPW-008`). */
export const BUNDLE_VERSION = '0.1.0';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** The skills half: `<skillsDir()>/setup-PMIStudio/SKILL.md`. */
export function skillsDir(): string {
  return join(root, 'skills');
}

/** The extension half: `<extensionDir()>/extension.yml` and its commands. */
export function extensionDir(): string {
  return join(root, 'extension');
}

/**
 * Integration → the directory, relative to the project root, that agent reads
 * skills from. Keyed by the value `specify init --integration` accepts.
 *
 * v0.1 maps `claude` only: it is the one integration this programme has run end
 * to end. No `*`, no `default`.
 */
export const SKILLS_PATH_BY_INTEGRATION: Readonly<Record<string, string>> = Object.freeze({
  claude: '.claude/skills',
});

export type SkillsPathResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: string };

/** A typed refusal, never a guess (`FR-LPW-006`). */
export function skillsPathFor(integration: string): SkillsPathResult {
  const path = Object.prototype.hasOwnProperty.call(SKILLS_PATH_BY_INTEGRATION, integration)
    ? SKILLS_PATH_BY_INTEGRATION[integration]
    : undefined;
  if (path === undefined) {
    return {
      ok: false,
      reason: `No skills directory is mapped for integration "${integration}". The bundle maps: ${Object.keys(SKILLS_PATH_BY_INTEGRATION).join(', ')}. Add a row to SKILLS_PATH_BY_INTEGRATION rather than defaulting to another agent's directory (FR-LPW-006).`,
    };
  }
  return { ok: true, path };
}

/**
 * The integration a project gets when the request names none (`FR-LPW-006`):
 * the one this bundle ships a skills path for. It lives here, not in the API,
 * because the API names no agent (`agent-independence.spec.ts`).
 */
export const DEFAULT_AGENT_INTEGRATION = 'claude';
