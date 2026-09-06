/**
 * `T1509`, `T1511` (EPIC-042, US2, `FR-EXT-042`–`FR-EXT-048`, `R-042-7`) — the
 * first-run loop of `speckit.pmi.begin` §7, executed by the harness against a
 * stub client that serves a canned decomposition plan and records every call:
 * the plan is printed with one estimate per Epic before any file is written;
 * an Epic above the ceiling is split only on a person's confirmation; each
 * delivery Epic is its own registered and completed execution; the decision is
 * a `decomposition-decision` comment on the first child; the marker is removed;
 * a rejected split is specified whole; not-first-run and nothing-to-decompose
 * stop early. Until `EPIC-044` makes Epic a product entity the platform serves
 * no Epics (`FR-PIC-043`), so the loop is exercised here with a stub and
 * against the composed application in `decomposition-read.spec.ts`.
 *
 * Also `T1511`: the decision body validator (data-model.md §8).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBegin, runFinish, runFirstRun, validateDecompositionDecision, type ToolClient, type ToolResult } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = pathJoin(HERE, '..', 'src');
const EXTENSION_DIR = pathJoin(HERE, '..', 'extension');

const EPICS = [
  { number: 1, slug: 'intake', name: 'Intake', requirements: [{ reference: 'REQ-001' }, { reference: 'REQ-002' }] },
  { number: 2, slug: 'review', name: 'Review', requirements: [{ reference: 'REQ-003' }, { reference: 'REQ-004' }, { reference: 'REQ-005' }, { reference: 'REQ-006' }] },
  { number: 3, slug: 'reports', name: 'Reports', requirements: [{ reference: 'REQ-007' }] },
];

function stubClient(plan: Record<string, unknown>) {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  let n = 0;
  const client: ToolClient = {
    async callTool(input): Promise<ToolResult> {
      calls.push(input);
      switch (input.name) {
        case 'pmi.project.decompose':
          return { structuredContent: plan };
        case 'pmi.health':
          return { structuredContent: { projectId: 'p_a', constitutionState: 'current' } };
        case 'pmi.execution.register':
          n += 1;
          return { structuredContent: { executionId: `exec_${n}`, sequence: 1 } };
        case 'pmi.execution.comment':
          return { structuredContent: { commentId: `c_${(input.arguments['executionId'] as string) ?? ''}` } };
        case 'pmi.execution.history':
          return { structuredContent: { snapshot: { lifecycleState: 'completed' }, events: [] } };
        case 'pmi.artifacts.sync':
        case 'pmi.tasks.sync':
          return { isError: true, structuredContent: { code: 'not_available_until', epic: 'EPIC-045' } };
        case 'pmi.execution.complete':
          return { structuredContent: { sequence: 2 } };
        default:
          return { structuredContent: {} };
      }
    },
  };
  return { client, calls };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pmi-first-run-'));
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ projectId: 'p_a', platformUrl: 'http://localhost:3000', bundleVersion: '0.2.0' }));
  writeFileSync(join(dir, '.pmi', 'first-run'), '2026-09-04T12:00:00Z prov_1\n');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const plan = (over: Record<string, unknown> = {}) => ({
  firstRun: true,
  nothingToDecompose: false,
  policy: { oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict', version: 3 },
  epics: EPICS,
  unassigned: [],
  epicSource: 'unavailable-until-EPIC-044',
  ...over,
});

describe('T1509 · the first run', () => {
  it('estimates before writing, splits the Epic above the ceiling on confirmation, runs one execution per delivery Epic, records the decision, removes the marker', async () => {
    const { client, calls } = stubClient(plan());
    const written: string[] = [];
    const result = await runFirstRun(client, dir, {
      estimate: (epic) => (epic.number === 2 ? 68 : 20),
      decide: () => ({ decision: 'confirmed' }),
      runStock: async (target) => {
        mkdirSync(join(dir, target.epicDir), { recursive: true });
        writeFileSync(join(dir, target.epicDir, 'spec.md'), `# ${target.slug}\n`);
        written.push(target.epicDir);
      },
      decidedBy: 'a person',
    });
    expect(result.firstRun).toBe(true);
    expect(result.executions).toEqual(['exec_1', 'exec_2', 'exec_3', 'exec_4']);
    expect(result.splits).toBe(1);
    expect(written).toEqual(['specs/001-intake', 'specs/002a-review-a', 'specs/002b-review-b', 'specs/003-reports']);
    // The plan lines come before any registration.
    const firstRegister = calls.findIndex((c) => c.name === 'pmi.execution.register');
    expect(firstRegister).toBeGreaterThan(0);
    expect(result.lines.slice(0, 4)).toEqual([
      'PMI · plan: Epic 1 Intake — 2 requirements, estimate 20',
      'PMI · plan: Epic 2 Review — 4 requirements, estimate 68',
      'PMI · split proposed: Epic 2 → 2a (34), 2b (34) — confirm / edit / reject?',
      'PMI · plan: Epic 3 Reports — 1 requirements, estimate 20',
    ]);
    // Each delivery Epic: register → (stock) → finish, targetType epic with the number or number+suffix.
    const registers = calls.filter((c) => c.name === 'pmi.execution.register').map((c) => (c.arguments['input'] as { targetType: string; targetId: string }));
    expect(registers).toEqual([
      { targetType: 'epic', targetId: '1' },
      { targetType: 'epic', targetId: '2a' },
      { targetType: 'epic', targetId: '2b' },
      { targetType: 'epic', targetId: '3' },
    ].map((r) => expect.objectContaining(r)));
    expect(calls.filter((c) => c.name === 'pmi.execution.complete')).toHaveLength(4);
    // The decision on the first child, as a comment whose body validates.
    const comments = calls.filter((c) => c.name === 'pmi.execution.comment');
    expect(comments).toHaveLength(1);
    expect(comments[0]?.arguments).toMatchObject({ executionId: 'exec_2', commentType: 'decomposition-decision' });
    const body = JSON.parse(comments[0]?.arguments['body'] as string) as Record<string, unknown>;
    expect(validateDecompositionDecision(body)).toEqual({ ok: true });
    expect(body).toMatchObject({ policyVersion: 3, epic: { number: 2, slug: 'review', name: 'Review' }, estimate: 68, ceiling: 50, decision: 'confirmed', decidedBy: 'a person' });
    expect((body['children'] as { requirements: string[] }[]).map((c) => c.requirements)).toEqual([['REQ-003', 'REQ-004'], ['REQ-005', 'REQ-006']]);
    expect(result.decisionComments).toEqual(['c_exec_2']);
    expect(existsSync(join(dir, '.pmi', 'first-run'))).toBe(false);
    // T1545 (Phase 9): the policy version the plan was computed against travels into every completion and the closing line.
    expect(result.lines.at(-1)).toBe('PMI · first run: 4 specifications, 1 splits (decomposition policy v3)');
    for (const c of calls.filter((c) => c.name === 'pmi.execution.complete')) expect(c.arguments['completionComment']).toMatch(/ \(decomposition policy v3\)$/);
  });

  it('a rejected split specifies the Epic whole and records the rejection with no children', async () => {
    const { client, calls } = stubClient(plan());
    const result = await runFirstRun(client, dir, {
      estimate: (epic) => (epic.number === 2 ? 68 : 20),
      decide: () => ({ decision: 'rejected' }),
      runStock: async () => undefined,
      decidedBy: 'a person',
    });
    expect(result.executions).toHaveLength(3);
    expect(result.splits).toBe(0);
    const comment = calls.find((c) => c.name === 'pmi.execution.comment');
    const body = JSON.parse(comment?.arguments['body'] as string) as Record<string, unknown>;
    expect(body).toMatchObject({ decision: 'rejected', children: [] });
    expect(validateDecompositionDecision(body)).toEqual({ ok: true });
  });

  it('an edited split uses the person\'s children', async () => {
    const { client, calls } = stubClient(plan());
    await runFirstRun(client, dir, {
      estimate: (epic) => (epic.number === 2 ? 68 : 20),
      decide: () => ({ decision: 'edited', children: [{ suffix: 'a', slug: 'review-capture', estimate: 30, requirements: ['REQ-003'] }, { suffix: 'b', slug: 'review-decide', estimate: 38, requirements: ['REQ-004', 'REQ-005', 'REQ-006'] }] }),
      runStock: async () => undefined,
      decidedBy: 'a person',
    });
    const registers = calls.filter((c) => c.name === 'pmi.execution.register').map((c) => (c.arguments['input'] as { targetId: string }).targetId);
    expect(registers).toEqual(['1', '2a', '2b', '3']);
    const body = JSON.parse(calls.find((c) => c.name === 'pmi.execution.comment')?.arguments['body'] as string) as { decision: string; children: { slug: string }[] };
    expect(body.decision).toBe('edited');
    expect(body.children.map((c) => c.slug)).toEqual(['review-capture', 'review-decide']);
  });

  it('an Epic at exactly the ceiling is never split', async () => {
    const { client } = stubClient(plan());
    const result = await runFirstRun(client, dir, { estimate: () => 50, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'x' });
    expect(result.splits).toBe(0);
    expect(result.executions).toHaveLength(3);
  });

  it('not a first run: the stale marker is removed and nothing runs (FR-EXT-046)', async () => {
    const { client, calls } = stubClient(plan({ firstRun: false }));
    const result = await runFirstRun(client, dir, { estimate: () => 1, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'x' });
    expect(result.firstRun).toBe(false);
    expect(result.executions).toEqual([]);
    expect(existsSync(join(dir, '.pmi', 'first-run'))).toBe(false);
    expect(calls.map((c) => c.name)).toEqual(['pmi.project.decompose']);
  });

  it('nothing to decompose: names where requirements are entered and writes nothing (FR-EXT-048)', async () => {
    const { client, calls } = stubClient(plan({ nothingToDecompose: true, epics: [], unassigned: [] }));
    const result = await runFirstRun(client, dir, { estimate: () => 1, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'x' });
    expect(result.lines).toEqual(['PMI · nothing to decompose — add requirements in PMI Studio → Requirement Room']);
    expect(calls).toHaveLength(1);
    expect(existsSync(join(dir, '.pmi', 'first-run'))).toBe(true);
    expect(readFileSync(join(dir, '.pmi', 'first-run'), 'utf8')).toContain('2026-09-04');
  });
});

describe('T1511 · validateDecompositionDecision (data-model.md §8)', () => {
  const good = { policyVersion: 3, epic: { number: 7, slug: 'intake', name: 'Intake' }, estimate: 68, ceiling: 50, decision: 'confirmed', children: [{ suffix: 'a', slug: 'a', estimate: 31, requirements: ['REQ-1'] }, { suffix: 'b', slug: 'b', estimate: 37, requirements: [] }], decidedBy: 'me' };

  it('accepts the documented shape', () => {
    expect(validateDecompositionDecision(good)).toEqual({ ok: true });
  });

  it.each([
    ['a rejected decision with children', { ...good, decision: 'rejected' }, 'children: empty when rejected'],
    ['a confirmed decision with one child', { ...good, children: [good.children[0]] }, 'at least two'],
    ['duplicate suffixes', { ...good, children: [good.children[0], { ...good.children[1], suffix: 'a' }] }, 'duplicate'],
    ['an unknown decision', { ...good, decision: 'maybe' }, 'decision:'],
    ['no decider', { ...good, decidedBy: '' }, 'decidedBy'],
  ])('refuses %s', (_label, value, message) => {
    const result = validateDecompositionDecision(value);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: readonly string[] }).errors.join('\n')).toContain(message);
  });
});

describe('T1544 · the first-run loop refuses to start while another first-run execution is open (Phase 9, edge case)', () => {
  it('registers nothing, keeps the marker, and names the open execution', async () => {
    const { client, calls } = stubClient(plan({ openFirstRun: 'exec_9' }));
    const result = await runFirstRun(client, dir, { estimate: () => 1, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'x' });
    expect(result.executions).toEqual([]);
    expect(result.firstRun).toBe(true);
    expect(result.lines).toEqual(['PMI · refused first_run_in_progress: exec_9 is still open — complete it or wait, then run the first specify again']);
    expect(calls.filter((c) => c.name === 'pmi.execution.register')).toHaveLength(0);
    expect(existsSync(join(dir, '.pmi', 'first-run'))).toBe(true);
  });
});

/**
 * `T1668` (EPIC-045, `FR-ART-046`) — the finish hook against a platform that
 * ANSWERS the artifact sync.
 *
 * Since `EPIC-042` the shipped `runFinish` has called `pmi.artifacts.sync` and
 * printed one information line when the platform refused
 * `not_available_until`. `EPIC-045` makes the platform answer. The hook is
 * **not edited** — the whole point of reserving the tool was that this day
 * would need no change to the extension — so what has to be true is:
 *
 * - `runFinish` completes against the live answer shape;
 * - the digests still travel on the completion's output binding;
 * - and it prints **no** new line, because the finish prompt specifies none:
 *   only refusals and the completion are printed
 *   (`specs/042-pmi-spec-kit-extension/contracts/extension-and-hooks.md` §5).
 *
 * The last is the one worth asserting. A sync line would be a change to what
 * the hook prints, which is a change to the prompt's contract, made from the
 * platform side where nobody would look for it. If this expectation ever
 * fails, it is the PLATFORM's answer shape that changes, not the hook.
 */
describe('T1668 · runFinish against the live artifact sync (FR-ART-046)', () => {
  const LIVE = { syncId: 'sync_1', epicId: 'epic_3', created: 2, reused: 1, refused: [] as { path: string; code: string }[] };

  function liveClient(answer: Record<string, unknown> = LIVE) {
    const calls: { name: string; arguments: Record<string, unknown> }[] = [];
    const client: ToolClient = {
      async callTool(input): Promise<ToolResult> {
        calls.push(input);
        switch (input.name) {
          case 'pmi.health':
            return { structuredContent: { projectId: 'p_a', constitutionState: 'current' } };
          case 'pmi.execution.register':
            return { structuredContent: { executionId: 'exec_live', sequence: 1 } };
          case 'pmi.artifacts.sync':
            // The LIVE shape, not a refusal.
            return { structuredContent: answer };
          case 'pmi.tasks.sync':
            return { isError: true, structuredContent: { code: 'not_available_until', epic: 'EPIC-046' } };
          case 'pmi.execution.complete':
            return { structuredContent: { sequence: 2 } };
          default:
            return { structuredContent: {} };
        }
      },
    };
    return { client, calls };
  }

  async function begunAndFinished(client: ToolClient): Promise<{ lines: string[]; outcome: string | null }> {
    const epicDir = 'specs/003-reports';
    mkdirSync(join(dir, epicDir), { recursive: true });
    writeFileSync(join(dir, epicDir, 'spec.md'), '# Reports\n', 'utf8');
    const begun = await runBegin(client, dir, { command: 'specify', epic: '3', epicDir });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(dir, epicDir, 'plan.md'), '# Plan\n', 'utf8');
    const finished = await runFinish(client, dir, epicDir);
    return { lines: finished.lines, outcome: finished.outcome };
  }

  it('completes against the live answer shape', async () => {
    const { client, calls } = liveClient();
    const { outcome } = await begunAndFinished(client);
    expect(outcome).toBe('completed');
    const sync = calls.find((c) => c.name === 'pmi.artifacts.sync');
    expect(sync, 'the hook did not call the artifact sync').toBeDefined();
    // The arguments EPIC-042 shipped, unchanged: an execution and the files.
    expect(Object.keys(sync?.arguments ?? {}).sort()).toEqual(['executionId', 'files']);
    expect((sync?.arguments['files'] as { path: string }[]).map((f) => f.path).sort()).toEqual(['specs/003-reports/plan.md', 'specs/003-reports/spec.md']);
  });

  it('still puts the digests on the completion output binding', async () => {
    const { client, calls } = liveClient();
    await begunAndFinished(client);
    const complete = calls.find((c) => c.name === 'pmi.execution.complete');
    const output = complete?.arguments['output'] as { generatedArtifactDigests?: string[] } | undefined;
    expect(output?.generatedArtifactDigests, 'the completion carries no digests').toHaveLength(2);
    // And they are the same digests the sync sent, which is what makes the
    // reported-versus-synced finding meaningful (`FR-ART-009`).
    const sent = (calls.find((c) => c.name === 'pmi.artifacts.sync')?.arguments['files'] as { digest: string }[]).map((f) => f.digest).sort();
    expect([...(output?.generatedArtifactDigests ?? [])].sort()).toEqual(sent);
  });

  it('prints NO new line — the finish prompt specifies none (FR-ART-046)', async () => {
    const { client } = liveClient();
    const { lines } = await begunAndFinished(client);
    expect(lines.some((l) => l.includes('EPIC-045')), lines.join('\n')).toBe(false);
    expect(lines.filter((l) => /artifact/i.test(l)), lines.join('\n')).toEqual([]);
    // The completion line is the last thing printed, as it was before.
    expect(lines.at(-1)).toBe('PMI · completed exec_live (completed)');
  });

  it('prints nothing extra even when the platform refused some files', async () => {
    // A per-file refusal is recorded on the timeline by the platform, not
    // printed by the hook — the hook was never told to read `refused`.
    const { client } = liveClient({ ...LIVE, created: 1, refused: [{ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set' }] });
    const { lines, outcome } = await begunAndFinished(client);
    expect(outcome).toBe('completed');
    expect(lines.filter((l) => /refused|artifact/i.test(l))).toEqual([]);
  });

  it('still prints the ONE information line against the old not_available_until refusal', async () => {
    // Backwards compatible: an extension pointed at a platform that has not
    // deployed EPIC-045 behaves exactly as it did.
    const client: ToolClient = {
      async callTool(input): Promise<ToolResult> {
        switch (input.name) {
          case 'pmi.health':
            return { structuredContent: { projectId: 'p_a', constitutionState: 'current' } };
          case 'pmi.execution.register':
            return { structuredContent: { executionId: 'exec_old', sequence: 1 } };
          case 'pmi.artifacts.sync':
            return { isError: true, structuredContent: { code: 'not_available_until', epic: 'EPIC-045' } };
          case 'pmi.execution.complete':
            return { structuredContent: { sequence: 2 } };
          default:
            return { structuredContent: {} };
        }
      },
    };
    const { lines } = await begunAndFinished(client);
    expect(lines).toContain('PMI · sync not available until EPIC-045');
  });

  it('the shipped hook sequence and prompt are NOT edited by this Epic (FR-ART-046)', () => {
    // The claim in prose, made checkable. `hook-sequences.ts` still calls the
    // tool with exactly `{ executionId, files }` and still prints only on the
    // `not_available_until` refusal; `finish.md` still specifies no sync line.
    const harness = readFileSync(join(SRC_DIR, 'hook-sequences.ts'), 'utf8');
    expect(harness).toContain("name: 'pmi.artifacts.sync', arguments: { executionId: last.executionId, files }");
    expect(harness).toContain("if (artifacts.isError && code(artifacts) === 'not_available_until')");
    const finishPrompt = readFileSync(join(EXTENSION_DIR, 'commands', 'finish.md'), 'utf8');
    expect(finishPrompt).not.toMatch(/artifacts?\s+synced/i);
  });
});
