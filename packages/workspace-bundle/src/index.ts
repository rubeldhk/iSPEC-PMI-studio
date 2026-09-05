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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Semver. Bumped whenever either half changes; recorded on every provisioning record (`FR-LPW-008`). */
export const BUNDLE_VERSION = '0.2.0';

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
 * The constitution half (EPIC-042 `T1478`, `R-042-4`, `FR-EXT-020`): the
 * invariant *Governed Execution* text and the generated-file header. They live
 * here, not in `backend/src`, because the text necessarily names the toolkit's
 * command prefix, which the backend may not contain
 * (`engine-independence.spec.ts`). The backend imports these functions and
 * never the words.
 */
export function constitutionDir(): string {
  return join(root, 'constitution');
}

export type OfflineMode = 'strict' | 'provisional';

function readConstitutionFile(name: string): string {
  return readFileSync(join(constitutionDir(), name), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * The Governed Execution section body: the machine-readable offline-mode line
 * the hooks read (`R-042-6`), a blank line, then the invariant text
 * byte-for-byte. Rendered identically into every project (`SC-EXT-009`).
 */
export function governedExecutionSection(offlineMode: OfflineMode): string {
  return `Offline mode: ${offlineMode}\n\n${readConstitutionFile('governed-execution.md')}`;
}

export interface ConstitutionHeaderInput {
  readonly projectId: string;
  readonly version: number;
  readonly digest: string;
}

export interface DecompositionPolicyInput {
  readonly oneSpecPerEpic: boolean;
  readonly taskCeiling: number;
  readonly splitRequiresConfirmation: boolean;
  readonly version: number;
}

/**
 * The Decomposition Policy section body (`FR-EXT-027`): rendered from the
 * stored policy. Lives here because the split rule names the toolkit's command.
 * Line 1 when one-spec-per-Epic; line 2 or 3 by whether a split needs a person;
 * the version line always.
 */
export function decompositionPolicySection(policy: DecompositionPolicyInput): string {
  const lines = readConstitutionFile('decomposition-policy.md').split('\n');
  const bullets: string[][] = [];
  for (const line of lines) {
    if (line.startsWith('- ')) bullets.push([line]);
    else if (line.length > 0 && bullets.length > 0) (bullets[bullets.length - 1] as string[]).push(line);
  }
  const [oneSpec, confirmed, unconfirmed, version] = bullets as [string[], string[], string[], string[]];
  const chosen: string[][] = [];
  if (policy.oneSpecPerEpic) chosen.push(oneSpec);
  chosen.push(policy.splitRequiresConfirmation ? confirmed : unconfirmed);
  chosen.push(version);
  return (
    chosen
      .map((b) => b.join('\n'))
      .join('\n')
      .replace(/\{taskCeiling\}/g, String(policy.taskCeiling))
      .replace('{version}', String(policy.version)) + '\n'
  );
}

/** The generated-file header (`contracts/governance-api.md` §4). Deterministic. */
export function constitutionHeader(input: ConstitutionHeaderInput): string {
  return readConstitutionFile('header.md')
    .replace('{projectId}', input.projectId)
    .replace('{version}', String(input.version))
    .replace('{digest}', input.digest);
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
 * EPIC-042 `T1497` (`R-042-1`, `contracts/extension-and-hooks.md` §2) — the
 * project-side registry fragment and its merge into `.specify/extensions.yml`.
 *
 * String-level on purpose: the merge only ever INSERTS lines, so every other
 * extension's entries stay byte-identical and no YAML library is needed at
 * runtime (the bundle has no runtime dependency). Idempotent: a second merge
 * changes nothing.
 */
export function extensionsFragment(): string {
  return readFileSync(join(extensionDir(), 'extensions-fragment.yml'), 'utf8').replace(/\r\n/g, '\n');
}

interface FragmentHook {
  readonly event: string;
  readonly entry: string;
  readonly command: string;
}

function parseFragment(fragment: string): { installed: string[]; hooks: FragmentHook[] } {
  const installed = [...(/^installed:\s*\[([^\]]*)\]/m.exec(fragment)?.[1] ?? '').split(',')].map((s) => s.trim()).filter(Boolean);
  const hooks: FragmentHook[] = [];
  let event = '';
  for (const line of fragment.split('\n')) {
    const ev = /^  ([a-z_]+):\s*$/.exec(line);
    if (ev) {
      event = ev[1] as string;
      continue;
    }
    const entry = /^    - \{.*\}\s*$/.test(line);
    if (entry && event) {
      const command = /command:\s*([^\s,}]+)/.exec(line)?.[1] ?? '';
      hooks.push({ event, entry: line, command });
    }
  }
  return { installed, hooks };
}

export function mergeExtensionsRegistry(existing: string | null, fragment: string = extensionsFragment()): string {
  const { installed, hooks } = parseFragment(fragment);
  let lines = (existing ?? '').replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 1 && lines[0] === '') lines = [];

  // 1 — installed: add each id once.
  const installedIdx = lines.findIndex((l) => /^installed:/.test(l));
  if (installedIdx === -1) {
    lines.unshift(`installed: [${installed.join(', ')}]`);
  } else {
    const flow = /^installed:\s*\[([^\]]*)\]\s*$/.exec(lines[installedIdx] as string);
    if (flow) {
      const have = flow[1]!.split(',').map((s) => s.trim()).filter(Boolean);
      for (const id of installed) if (!have.includes(id)) have.push(id);
      lines[installedIdx] = `installed: [${have.join(', ')}]`;
    } else {
      // Block list: append `  - id` after the last item of the block.
      let end = installedIdx + 1;
      while (end < lines.length && /^\s+-\s/.test(lines[end] as string)) end++;
      const have = lines.slice(installedIdx + 1, end).map((l) => l.replace(/^\s+-\s*/, '').trim());
      const missing = installed.filter((id) => !have.includes(id));
      lines.splice(end, 0, ...missing.map((id) => `  - ${id}`));
    }
  }

  // 2 — hooks: ensure the block exists, then one entry per event unless present.
  let hooksIdx = lines.findIndex((l) => /^hooks:/.test(l));
  if (hooksIdx === -1) {
    lines.push('hooks:');
    hooksIdx = lines.length - 1;
  } else if (/^hooks:\s*\{\}\s*$/.test(lines[hooksIdx] as string)) {
    lines[hooksIdx] = 'hooks:';
  }
  const blockEnd = (start: number): number => {
    let i = start + 1;
    while (i < lines.length && (/^\s/.test(lines[i] as string) || (lines[i] as string).trim() === '' || /^\s*#/.test(lines[i] as string))) i++;
    // Trim trailing blank lines back into the block end.
    while (i > start + 1 && (lines[i - 1] as string).trim() === '') i--;
    return i;
  };
  for (const hook of hooks) {
    let end = blockEnd(hooksIdx);
    const eventIdx = lines.findIndex((l, i) => i > hooksIdx && i < end && new RegExp(`^  ${hook.event}:\\s*$`).test(l));
    if (eventIdx === -1) {
      lines.splice(end, 0, `  ${hook.event}:`, hook.entry);
      continue;
    }
    let eventEnd = eventIdx + 1;
    while (eventEnd < end && /^    /.test(lines[eventEnd] as string)) eventEnd++;
    const present = lines.slice(eventIdx + 1, eventEnd).some((l) => /extension:\s*pmi\b/.test(l) && new RegExp(`command:\\s*${hook.command.replace(/\./g, '\\.')}(\\s|,|\\})`).test(l));
    if (!present) {
      lines.splice(eventEnd, 0, hook.entry);
      end = blockEnd(hooksIdx);
    }
  }
  return lines.join('\n').replace(/\n*$/, '\n');
}

/**
 * EPIC-042 `T1530` (`R-042-6`) — the offline mode the hooks read from the
 * constitution file: `provisional` only on the exact line; anything else,
 * including an absent or malformed line, is `strict` (`BR-0202`).
 */
export function readOfflineMode(constitutionText: string | null | undefined): OfflineMode {
  if (!constitutionText) return 'strict';
  const m = /^Offline mode: (strict|provisional)\s*$/m.exec(constitutionText.replace(/\r\n/g, '\n'));
  return m?.[1] === 'provisional' ? 'provisional' : 'strict';
}

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] };

/**
 * EPIC-042 `T1512` (data-model.md §8) — the JSON body of a
 * `decomposition-decision` comment. Hand-written rather than a schema library:
 * the bundle carries no runtime dependency.
 */
export function validateDecompositionDecision(value: unknown): ValidationResult {
  const errors: string[] = [];
  const v = (value ?? {}) as Record<string, unknown>;
  if (typeof v['policyVersion'] !== 'number') errors.push('policyVersion: a number');
  const epic = v['epic'] as Record<string, unknown> | undefined;
  if (!epic || typeof epic['number'] !== 'number' || typeof epic['slug'] !== 'string' || typeof epic['name'] !== 'string') errors.push('epic: { number, slug, name }');
  if (typeof v['estimate'] !== 'number') errors.push('estimate: a number');
  if (typeof v['ceiling'] !== 'number') errors.push('ceiling: a number');
  const decision = v['decision'];
  if (decision !== 'confirmed' && decision !== 'edited' && decision !== 'rejected') errors.push('decision: confirmed | edited | rejected');
  const children = v['children'];
  if (!Array.isArray(children)) errors.push('children: a list');
  else {
    if (decision === 'rejected' && children.length > 0) errors.push('children: empty when rejected');
    if (decision !== 'rejected' && children.length < 2) errors.push('children: at least two when a split is confirmed or edited');
    const suffixes = new Set<string>();
    children.forEach((c, i) => {
      const child = (c ?? {}) as Record<string, unknown>;
      if (typeof child['suffix'] !== 'string' || !/^[a-z]$/.test(child['suffix'])) errors.push(`children[${i}].suffix: one lowercase letter`);
      else if (suffixes.has(child['suffix'])) errors.push(`children[${i}].suffix: duplicate`);
      else suffixes.add(child['suffix']);
      if (typeof child['slug'] !== 'string') errors.push(`children[${i}].slug: a string`);
      if (typeof child['estimate'] !== 'number') errors.push(`children[${i}].estimate: a number`);
      if (!Array.isArray(child['requirements'])) errors.push(`children[${i}].requirements: a list`);
    });
  }
  if (typeof v['decidedBy'] !== 'string' || (v['decidedBy'] as string).length === 0) errors.push('decidedBy: a name');
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * EPIC-042 `T1530` (`contracts/extension-and-hooks.md` §8) — one provisional
 * record: a sync-batch item, `governed` always false in the file.
 */
export function validateProvisionalRecord(value: unknown): ValidationResult {
  const errors: string[] = [];
  const v = (value ?? {}) as Record<string, unknown>;
  const reg = v['registration'] as Record<string, unknown> | undefined;
  if (!reg) errors.push('registration: required');
  else {
    if (typeof reg['executionId'] !== 'string' || !/^prov_/.test(reg['executionId'] as string)) errors.push('registration.executionId: prov_<uuid>');
    for (const k of ['command', 'correlationId', 'idempotencyKey']) if (typeof reg[k] !== 'string') errors.push(`registration.${k}: a string`);
    if (reg['idempotencyKey'] !== reg['executionId']) errors.push('registration.idempotencyKey: equals the execution id');
    if (reg['surface'] !== 'mcp-client') errors.push('registration.surface: mcp-client');
    if (!reg['input'] || typeof reg['input'] !== 'object') errors.push('registration.input: the input binding');
  }
  const events = v['events'];
  if (!Array.isArray(events) || events.length === 0) errors.push('events: a non-empty list');
  else {
    const first = (events[0] ?? {}) as Record<string, unknown>;
    if (first['type'] !== 'execution-sync-queued') errors.push('events[0].type: execution-sync-queued');
    events.forEach((e, i) => {
      const ev = (e ?? {}) as Record<string, unknown>;
      if (typeof ev['type'] !== 'string') errors.push(`events[${i}].type: a string`);
      if (typeof ev['occurredAt'] !== 'string') errors.push(`events[${i}].occurredAt: an ISO time`);
    });
  }
  if (v['governed'] !== false) errors.push('governed: false');
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export * from './hook-sequences.js';

/**
 * The integration a project gets when the request names none (`FR-LPW-006`):
 * the one this bundle ships a skills path for. It lives here, not in the API,
 * because the API names no agent (`agent-independence.spec.ts`).
 */
export const DEFAULT_AGENT_INTEGRATION = 'claude';
