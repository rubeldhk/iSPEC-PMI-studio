/**
 * EPIC-042 `T1501`, `T1503`, `T1510`, `T1531` (`R-042-12`) — the sequence
 * harness: the hook commands are prompts an agent executes, and a test runner
 * cannot host an agent. This module performs the SAME tool calls, in the same
 * order, with the same arguments the prompts instruct
 * (`contracts/extension-and-hooks.md` §4–§8), against a real `pmi-studio`
 * server through any MCP client. It is the regression net for the prompts'
 * sequences and what produces the `M2` transcript.
 *
 * Structurally typed: it needs `callTool` and nothing else, so the bundle
 * carries no runtime dependency. Every line it would print is returned, in the
 * §3 vocabulary, so a transcript can quote them.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readOfflineMode } from './index.js';

export interface ToolResult {
  readonly isError?: boolean | undefined;
  readonly structuredContent?: unknown;
  /** The protocol SDK's result carries more; the harness reads only the two above. */
  readonly [key: string]: unknown;
}

export interface ToolClient {
  callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<ToolResult>;
}

export const ARTIFACT_FILES = ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md', 'analysis.md', 'quickstart.md'] as const;
const TERMINAL = new Set(['completed', 'partially-completed', 'failed', 'cancelled', 'timed-out']);

export interface LastExecution {
  readonly executionId: string;
  readonly command: string;
  readonly epic: string | null;
  readonly registeredAt: string;
  readonly artifactDigests: Record<string, string>;
  readonly tickedTasks: string[];
  readonly provisional: boolean;
}

export interface BeginOptions {
  readonly command: string;
  /** The Epic directory relative to `dir` (e.g. `specs/007-intake`), and its number or number+suffix. */
  readonly epicDir?: string | undefined;
  readonly epic?: string | undefined;
  readonly extensionVersion?: string | undefined;
  readonly toolkitVersion?: string | undefined;
  readonly environment?: string | undefined;
  /** What the person answers to `drift — waiting for confirmation`. Default: no (keep the file). */
  readonly confirmDriftRefresh?: boolean | undefined;
  /** What the person answers to `left open … complete as failed?`. Default: yes. */
  readonly completeLeftOpen?: boolean | undefined;
  readonly now?: (() => Date) | undefined;
}

export interface BeginResult {
  readonly lines: string[];
  readonly executionId: string | null;
  readonly provisional: boolean;
  readonly refused: { code: string; message: string } | null;
  readonly constitutionState: string | null;
}

export interface FinishOptions {
  readonly outcome?: 'completed' | 'partially-completed' | 'failed' | 'cancelled' | 'timed-out' | undefined;
  readonly commitAfter?: string | undefined;
  readonly completionComment?: string | undefined;
  /** Appended to the completion comment — the first-run loop records the policy version it ran under (T1545). */
  readonly commentSuffix?: string | undefined;
  readonly now?: (() => Date) | undefined;
}

export interface FinishResult {
  readonly lines: string[];
  readonly executionId: string | null;
  readonly outcome: string | null;
  readonly changed: string[];
  readonly added: string[];
  readonly progressEvents: string[];
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function code(result: ToolResult): string {
  const sc = result.structuredContent as { code?: unknown } | undefined;
  return typeof sc?.code === 'string' ? sc.code : 'unknown';
}

function message(result: ToolResult): string {
  const sc = result.structuredContent as { message?: unknown } | undefined;
  return typeof sc?.message === 'string' ? sc.message : '';
}

function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch {
    return null;
  }
}

/** The digests of the Epic's artifact files that exist (`contracts/extension-and-hooks.md` §4 step 8). */
export function artifactDigests(dir: string, epicDir: string | undefined): Record<string, string> {
  if (!epicDir) return {};
  const base = join(dir, epicDir);
  if (!existsSync(base)) return {};
  const out: Record<string, string> = {};
  for (const name of ARTIFACT_FILES) {
    const p = join(base, name);
    if (existsSync(p)) out[`${epicDir}/${name}`] = sha256(readFileSync(p));
  }
  for (const sub of ['contracts', 'checklists']) {
    const d = join(base, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith('.md')).sort()) out[`${epicDir}/${sub}/${f}`] = sha256(readFileSync(join(d, f)));
  }
  return out;
}

/**
 * Task ids ticked in a `tasks.md`: the first token after a ticked checkbox.
 * The identifier's SHAPE is the platform's policy (its governance configuration),
 * not the harness's — so no pattern for it is written here.
 */
export function tickedTasks(tasksMarkdown: string): string[] {
  return [...tasksMarkdown.matchAll(/^- \[[xX]\] (\S+)/gm)].map((m) => m[1] as string);
}

/**
 * The digest of a constitution file, computed the way PMI Studio computes it
 * (`contracts/governance-api.md` §4): over the text with the header's own
 * digest field replaced by 64 zeros, so the file can carry its digest.
 */
export function renderDigest(text: string): string {
  return sha256(text.replace(/\r\n/g, '\n').replace(/digest [0-9a-f]{64}/, `digest ${'0'.repeat(64)}`));
}

export function constitutionDigest(dir: string): string | null {
  const p = join(dir, '.specify', 'memory', 'constitution.md');
  return existsSync(p) ? renderDigest(readFileSync(p, 'utf8')) : null;
}

function writeConstitution(dir: string, content: string): void {
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), content, 'utf8');
}

function lastExecutionPath(dir: string): string {
  return join(dir, '.pmi', 'last-execution');
}

export function readLastExecution(dir: string): LastExecution | null {
  return readJson<LastExecution>(lastExecutionPath(dir));
}

/** `speckit.pmi.begin` — `contracts/extension-and-hooks.md` §4 (steps 1–6, 8, 9). */
export async function runBegin(client: ToolClient, dir: string, opts: BeginOptions): Promise<BeginResult> {
  const now = opts.now ?? ((): Date => new Date());
  const lines: string[] = [];
  const refuse = (c: string, m: string): BeginResult => {
    lines.push(`PMI · refused ${c}: ${m}`);
    return { lines, executionId: null, provisional: false, refused: { code: c, message: m }, constitutionState: null };
  };

  // 1 — the project file.
  const project = readJson<{ projectId: string; platformUrl: string; bundleVersion: string }>(join(dir, '.pmi', 'project.json'));
  if (!project) return refuse('not_provisioned', 'this directory was not provisioned by PMI Studio; create the project in PMI Studio first');

  // 2 — the constitution digest.
  const digest = constitutionDigest(dir);
  const constitutionText = digest === null ? null : readFileSync(join(dir, '.specify', 'memory', 'constitution.md'), 'utf8');

  // 3 — health.
  const health = await client.callTool({
    name: 'pmi.health',
    arguments: {
      extensionVersion: opts.extensionVersion ?? project.bundleVersion,
      ...(opts.toolkitVersion !== undefined ? { toolkitVersion: opts.toolkitVersion } : {}),
      constitutionDigest: digest,
    },
  });
  let constitutionState: string | null = null;
  let provisional = false;
  if (health.isError) {
    const c = code(health);
    if (c === 'platform_unreachable') {
      if (readOfflineMode(constitutionText) === 'strict') {
        return refuse('platform_unreachable', `PMI Studio at ${project.platformUrl} is unreachable and this project's offline mode is strict — change it in PMI Studio → Governance → Constraints`);
      }
      provisional = true;
    } else {
      return refuse(c, message(health) || 'the credential does not open this project');
    }
  } else {
    constitutionState = ((health.structuredContent as { constitutionState?: string | null }).constitutionState ?? null) as string | null;
  }

  if (!provisional) {
    // 4 — the constitution.
    if (constitutionState === 'stale' || constitutionState === 'missing' || constitutionState === 'drift') {
      const got = await client.callTool({ name: 'pmi.constitution.get', arguments: { onDiskDigest: digest } });
      const content = (got.structuredContent as { content?: string } | undefined)?.content;
      if (constitutionState === 'drift') {
        lines.push('PMI · constitution drift — waiting for confirmation');
        if (opts.confirmDriftRefresh && content) {
          writeConstitution(dir, content);
          lines.push('PMI · constitution drift→refreshed (confirmed)');
        }
      } else if (content) {
        writeConstitution(dir, content);
        lines.push(constitutionState === 'stale' ? 'PMI · constitution stale→refreshed' : 'PMI · constitution restored');
      }
    } else if (constitutionState === 'current') {
      lines.push('PMI · constitution current');
    }

    // 5 — the provisional queue.
    const queue = join(dir, '.pmi', 'provisional');
    if (existsSync(queue)) {
      for (const file of readdirSync(queue).filter((f) => f.endsWith('.json')).sort()) {
        const record = readJson<Record<string, unknown>>(join(queue, file));
        if (!record) continue;
        const sync = await client.callTool({ name: 'pmi.execution.sync', arguments: { batch: [record] } });
        if (sync.isError) {
          if (code(sync) === 'not_available_until') {
            lines.push(`PMI · sync not available until ${String((sync.structuredContent as { epic?: string }).epic ?? 'EPIC-037')}`);
            break;
          }
          lines.push(`PMI · refused ${code(sync)}: ${message(sync)}`);
          break;
        }
        const body = sync.structuredContent as { accepted?: string[]; conflicts?: string[] };
        const id = (record['registration'] as { executionId: string }).executionId;
        if (body.accepted?.includes(id)) rmSync(join(queue, file));
        else if (body.conflicts?.includes(id)) lines.push(`PMI · sync conflict ${id}`);
      }
    }

    // 6 — left open.
    const last = readLastExecution(dir);
    if (last && !last.provisional) {
      const history = await client.callTool({ name: 'pmi.execution.history', arguments: { executionId: last.executionId } });
      const snapshot = (history.structuredContent as { snapshot?: { lifecycleState?: string; state?: string } | null } | undefined)?.snapshot;
      const state = snapshot?.lifecycleState ?? snapshot?.state ?? 'registered';
      if (!history.isError && !TERMINAL.has(state)) {
        lines.push(`PMI · left open ${last.executionId} from ${last.registeredAt} — complete as failed? (yes/no)`);
        if (opts.completeLeftOpen === false) {
          return { lines, executionId: null, provisional: false, refused: { code: 'left_open', message: 'the previous execution is still open' }, constitutionState };
        }
        const done = await client.callTool({
          name: 'pmi.execution.complete',
          arguments: { executionId: last.executionId, outcome: 'failed', occurredAt: now().toISOString(), completionComment: 'left open by an interrupted command', idempotencyKey: `left-open-${last.executionId}` },
        });
        if (!done.isError) lines.push(`PMI · completed ${last.executionId} (failed)`);
      }
      rmSync(lastExecutionPath(dir), { force: true });
    }
  }

  // 8 / 9 — register, or queue.
  const digests = artifactDigests(dir, opts.epicDir);
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitBefore = git(dir, ['rev-parse', 'HEAD']);
  const input: Record<string, unknown> = {
    targetType: opts.epic ? 'epic' : 'project',
    targetId: opts.epic ?? project.projectId,
    repositoryId: project.projectId,
    ...(branch ? { branch } : {}),
    worktree: dir,
    ...(commitBefore ? { commitBefore } : {}),
    inputArtifactDigests: Object.values(digests),
  };
  const tasksPath = opts.epicDir ? join(dir, opts.epicDir, 'tasks.md') : null;
  const ticked = tasksPath && existsSync(tasksPath) ? tickedTasks(readFileSync(tasksPath, 'utf8')) : [];
  const correlationId = randomUUID();
  const registeredAt = now().toISOString();

  if (provisional) {
    const executionId = `prov_${randomUUID()}`;
    const record = {
      registration: { executionId, command: opts.command, argsSanitized: { command: opts.command, ...(opts.epic ? { epic: opts.epic } : {}) }, correlationId, idempotencyKey: executionId, input, surface: 'mcp-client', ...(opts.environment ? { environment: opts.environment } : {}) },
      events: [{ type: 'execution-sync-queued', occurredAt: registeredAt, payload: { reason: 'platform_unreachable' } }],
      governed: false,
    };
    // T1543 (FR-EXT-050): a record that cannot be made durable is not a record — refuse as strict mode does.
    const recordPath = join(dir, '.pmi', 'provisional', `${executionId}.json`);
    try {
      mkdirSync(join(dir, '.pmi', 'provisional'), { recursive: true });
      writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
    } catch (err) {
      return refuse(
        'platform_unreachable',
        `PMI Studio at ${project.platformUrl} is unreachable and the provisional record could not be written at ${recordPath}: ${(err as Error).message}`,
      );
    }
    const last: LastExecution = { executionId, command: opts.command, epic: opts.epic ?? null, registeredAt, artifactDigests: digests, tickedTasks: ticked, provisional: true };
    writeFileSync(lastExecutionPath(dir), JSON.stringify(last, null, 2) + '\n', 'utf8');
    lines.push(`PMI · queued ${executionId} (not governed)`);
    return { lines, executionId, provisional: true, refused: null, constitutionState };
  }

  const registered = await client.callTool({
    name: 'pmi.execution.register',
    arguments: {
      command: opts.command,
      argsSanitized: { command: opts.command, ...(opts.epic ? { epic: opts.epic } : {}) },
      input,
      correlationId,
      idempotencyKey: `begin-${randomUUID()}`,
      ...(opts.environment ? { environment: opts.environment } : {}),
    },
  });
  if (registered.isError) return refuse(code(registered), message(registered) || 'registration refused');
  const executionId = (registered.structuredContent as { executionId: string }).executionId;
  const last: LastExecution = { executionId, command: opts.command, epic: opts.epic ?? null, registeredAt, artifactDigests: digests, tickedTasks: ticked, provisional: false };
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  writeFileSync(lastExecutionPath(dir), JSON.stringify(last, null, 2) + '\n', 'utf8');
  lines.push(`PMI · registered ${executionId} (${opts.command}, ${opts.epic ?? 'no epic'})`);
  return { lines, executionId, provisional: false, refused: null, constitutionState };
}

/** `speckit.pmi.progress` — §6: one `progress-reported` event per task ticked since registration. */
export async function runProgress(client: ToolClient, dir: string, epicDir: string | undefined, last: LastExecution, now: () => Date): Promise<string[]> {
  const tasksPath = epicDir ? join(dir, epicDir, 'tasks.md') : null;
  if (!tasksPath || !existsSync(tasksPath)) return [];
  const nowTicked = tickedTasks(readFileSync(tasksPath, 'utf8'));
  const fresh = nowTicked.filter((id) => !last.tickedTasks.includes(id));
  for (const taskId of fresh) {
    await client.callTool({
      name: 'pmi.execution.appendEvent',
      arguments: { executionId: last.executionId, type: 'progress-reported', payload: { taskId }, occurredAt: now().toISOString(), idempotencyKey: `${last.executionId}:${taskId}` },
    });
  }
  return fresh;
}

/** `speckit.pmi.finish` — §5. */
export async function runFinish(client: ToolClient, dir: string, epicDir: string | undefined, opts: FinishOptions = {}): Promise<FinishResult> {
  const now = opts.now ?? ((): Date => new Date());
  const lines: string[] = [];
  const last = readLastExecution(dir);
  if (!last) {
    lines.push('PMI · refused no_registration: nothing to complete — the begin hook did not run');
    return { lines, executionId: null, outcome: null, changed: [], added: [], progressEvents: [] };
  }
  const digests = artifactDigests(dir, epicDir);
  const changed = Object.keys(digests).filter((p) => last.artifactDigests[p] !== undefined && last.artifactDigests[p] !== digests[p]);
  const added = Object.keys(digests).filter((p) => last.artifactDigests[p] === undefined);
  const commitAfter = opts.commitAfter ?? git(dir, ['rev-parse', 'HEAD']) ?? undefined;

  let progressEvents: string[] = [];
  let outcome: string = opts.outcome ?? 'completed';
  if (last.command === 'implement' && !last.provisional) {
    progressEvents = await runProgress(client, dir, epicDir, last, now);
    const tasksPath = epicDir ? join(dir, epicDir, 'tasks.md') : null;
    if (opts.outcome === undefined && tasksPath && existsSync(tasksPath) && /^- \[ \] \S/m.test(readFileSync(tasksPath, 'utf8'))) outcome = 'partially-completed';
  }

  if (!last.provisional) {
    const files = Object.entries(digests).map(([path, digest]) => ({ path, digest, content: readFileSync(join(dir, path), 'utf8') }));
    const artifacts = await client.callTool({ name: 'pmi.artifacts.sync', arguments: { executionId: last.executionId, files } });
    if (artifacts.isError && code(artifacts) === 'not_available_until') lines.push(`PMI · sync not available until ${String((artifacts.structuredContent as { epic?: string }).epic)}`);
    if (last.command === 'tasks' || last.command === 'implement') {
      const tasksPath = epicDir ? join(dir, epicDir, 'tasks.md') : null;
      const tasks = await client.callTool({ name: 'pmi.tasks.sync', arguments: { executionId: last.executionId, tasksMarkdown: tasksPath && existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : '' } });
      if (tasks.isError && code(tasks) === 'not_available_until' && !lines.some((l) => l.includes(String((tasks.structuredContent as { epic?: string }).epic)))) {
        lines.push(`PMI · sync not available until ${String((tasks.structuredContent as { epic?: string }).epic)}`);
      }
    }
  }

  const baseComment = opts.completionComment ?? (changed.length + added.length === 0 ? 'Nothing changed.' : `Changed: ${changed.join(', ') || 'none'}. New: ${added.join(', ') || 'none'}.`);
  const completionComment = opts.commentSuffix ? `${baseComment} ${opts.commentSuffix}` : baseComment;
  // The registry binds output identity only to a completed execution (AC-EXR-17d): a
  // partially-completed, failed or cancelled run carries no output.
  const output = outcome === 'completed' ? { ...(commitAfter ? { commitAfter } : {}), generatedArtifactDigests: Object.values(digests) } : undefined;
  if (last.provisional) {
    const file = join(dir, '.pmi', 'provisional', `${last.executionId}.json`);
    const record = readJson<{ events: unknown[] }>(file);
    if (record) {
      record.events.push({ type: 'lifecycle.completed', occurredAt: now().toISOString(), payload: { outcome, ...(output ? { output } : {}), completionComment } });
      writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
    }
    lines.push(`PMI · completed ${last.executionId} (${outcome}) (not governed)`);
  } else {
    const done = await client.callTool({
      name: 'pmi.execution.complete',
      arguments: { executionId: last.executionId, outcome, occurredAt: now().toISOString(), completionComment, ...(output ? { output } : {}), idempotencyKey: `finish-${last.executionId}` },
    });
    if (done.isError) {
      lines.push(`PMI · refused ${code(done)}: ${message(done)}`);
      return { lines, executionId: last.executionId, outcome: null, changed, added, progressEvents };
    }
    lines.push(`PMI · completed ${last.executionId} (${outcome})`);
  }
  rmSync(lastExecutionPath(dir), { force: true });
  return { lines, executionId: last.executionId, outcome, changed, added, progressEvents };
}

export interface FirstRunEpic {
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly requirements: { reference: string }[];
}

export interface SplitProposal {
  readonly epic: FirstRunEpic;
  readonly estimate: number;
  readonly ceiling: number;
  readonly children: { suffix: string; slug: string; estimate: number; requirements: string[] }[];
}

export interface FirstRunOptions {
  /** One integer per Epic, from the bundle alone (§7 step 2). */
  readonly estimate: (epic: FirstRunEpic) => number;
  /** The person's answer to a proposed split (§7 step 3). */
  readonly decide: (proposal: SplitProposal) => { decision: 'confirmed' | 'edited' | 'rejected'; children?: SplitProposal['children'] };
  /** The stock specify flow for one Epic or child: writes into `dir/<epicDir>`. */
  readonly runStock: (target: { id: string; slug: string; epicDir: string; requirements: { reference: string }[] }) => Promise<void>;
  readonly decidedBy: string;
  readonly extensionVersion?: string | undefined;
  readonly now?: (() => Date) | undefined;
}

export interface FirstRunResult {
  readonly lines: string[];
  readonly executions: string[];
  readonly splits: number;
  readonly decisionComments: string[];
  readonly firstRun: boolean;
}

/** `speckit.pmi.begin` §7 — the first-run decomposition loop, with `runBegin`/`runFinish` per Epic. */
export async function runFirstRun(client: ToolClient, dir: string, opts: FirstRunOptions): Promise<FirstRunResult> {
  const lines: string[] = [];
  const marker = join(dir, '.pmi', 'first-run');
  const planResult = await client.callTool({ name: 'pmi.project.decompose', arguments: {} });
  if (planResult.isError) {
    lines.push(`PMI · refused ${code(planResult)}: ${message(planResult)}`);
    return { lines, executions: [], splits: 0, decisionComments: [], firstRun: false };
  }
  const plan = planResult.structuredContent as { firstRun: boolean; openFirstRun?: string | null; nothingToDecompose: boolean; policy: { taskCeiling: number; version: number; splitRequiresConfirmation: boolean }; epics: FirstRunEpic[]; unassigned: { reference: string }[] };
  if (!plan.firstRun) {
    rmSync(marker, { force: true });
    lines.push('PMI · first run: not a first run — marker removed');
    return { lines, executions: [], splits: 0, decisionComments: [], firstRun: false };
  }
  // Edge case (T1544): another session's first run is still open — never a second loop beside it.
  if (plan.openFirstRun) {
    lines.push(`PMI · refused first_run_in_progress: ${plan.openFirstRun} is still open — complete it or wait, then run the first specify again`);
    return { lines, executions: [], splits: 0, decisionComments: [], firstRun: true };
  }
  if (plan.nothingToDecompose) {
    lines.push('PMI · nothing to decompose — add requirements in PMI Studio → Requirement Room');
    return { lines, executions: [], splits: 0, decisionComments: [], firstRun: true };
  }
  // Edge case (T1545): the plan is computed against one policy version; every completion names it.
  const policyNote = `(decomposition policy v${plan.policy.version})`;

  // 2 — the plan, with one estimate per Epic before any file is written.
  const targets: { id: string; slug: string; epicDir: string; requirements: { reference: string }[]; decision?: SplitProposal & { decision: string; children: SplitProposal['children'] } }[] = [];
  let splits = 0;
  for (const epic of plan.epics) {
    const estimate = opts.estimate(epic);
    lines.push(`PMI · plan: Epic ${epic.number} ${epic.name} — ${epic.requirements.length} requirements, estimate ${estimate}`);
    if (estimate > plan.policy.taskCeiling) {
      const half = Math.ceil(epic.requirements.length / 2);
      const proposal: SplitProposal = {
        epic,
        estimate,
        ceiling: plan.policy.taskCeiling,
        children: [
          { suffix: 'a', slug: `${epic.slug}-a`, estimate: Math.ceil(estimate / 2), requirements: epic.requirements.slice(0, half).map((r) => r.reference) },
          { suffix: 'b', slug: `${epic.slug}-b`, estimate: Math.floor(estimate / 2), requirements: epic.requirements.slice(half).map((r) => r.reference) },
        ],
      };
      lines.push(`PMI · split proposed: Epic ${epic.number} → ${proposal.children.map((c) => `${epic.number}${c.suffix} (${c.estimate})`).join(', ')} — confirm / edit / reject?`);
      const answer = opts.decide(proposal);
      const children = answer.children ?? proposal.children;
      if (answer.decision === 'rejected') {
        targets.push({ id: String(epic.number), slug: epic.slug, epicDir: `specs/${String(epic.number).padStart(3, '0')}-${epic.slug}`, requirements: epic.requirements, decision: { ...proposal, decision: 'rejected', children: [] } });
      } else {
        splits += 1;
        children.forEach((child, i) => {
          targets.push({
            id: `${epic.number}${child.suffix}`,
            slug: child.slug,
            epicDir: `specs/${String(epic.number).padStart(3, '0')}${child.suffix}-${child.slug}`,
            requirements: child.requirements.map((reference) => ({ reference })),
            ...(i === 0 ? { decision: { ...proposal, decision: answer.decision, children } } : {}),
          });
        });
      }
    } else {
      targets.push({ id: String(epic.number), slug: epic.slug, epicDir: `specs/${String(epic.number).padStart(3, '0')}-${epic.slug}`, requirements: epic.requirements });
    }
  }

  // 4 / 5 — one governed execution per delivery Epic; the decision on the first child.
  const executions: string[] = [];
  const decisionComments: string[] = [];
  for (const target of targets) {
    const begun = await runBegin(client, dir, { command: 'specify', epic: target.id, epicDir: target.epicDir, extensionVersion: opts.extensionVersion, now: opts.now });
    lines.push(...begun.lines);
    if (!begun.executionId) continue;
    executions.push(begun.executionId);
    await opts.runStock({ id: target.id, slug: target.slug, epicDir: target.epicDir, requirements: target.requirements });
    if (target.decision) {
      const body = {
        policyVersion: plan.policy.version,
        epic: { number: target.decision.epic.number, slug: target.decision.epic.slug, name: target.decision.epic.name },
        estimate: target.decision.estimate,
        ceiling: target.decision.ceiling,
        decision: target.decision.decision,
        children: target.decision.children,
        decidedBy: opts.decidedBy,
      };
      const comment = await client.callTool({
        name: 'pmi.execution.comment',
        arguments: { executionId: begun.executionId, commentType: 'decomposition-decision', body: JSON.stringify(body), idempotencyKey: `decision-${begun.executionId}` },
      });
      const id = (comment.structuredContent as { commentId?: string } | undefined)?.commentId;
      if (id) decisionComments.push(id);
    }
    const finished = await runFinish(client, dir, target.epicDir, { now: opts.now, commentSuffix: policyNote });
    lines.push(...finished.lines);
  }

  // 6 — the marker.
  rmSync(marker, { force: true });
  lines.push(`PMI · first run: ${executions.length} specifications, ${splits} splits ${policyNote}`);
  return { lines, executions, splits, decisionComments, firstRun: true };
}
