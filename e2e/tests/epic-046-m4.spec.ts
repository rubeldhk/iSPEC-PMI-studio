/**
 * `T1757` (EPIC-046, `SC-KAN-003`, `SC-KAN-004`, `SC-KAN-007`) — milestone
 * **M4: the board moves itself**.
 *
 * A governed `tasks` then `implement` on the reference-local stack, through a
 * real `pmi-studio` server over stdio and the **shipped** hook sequences → a
 * signed-in member with **no checkout** watches the Epic's board reach five
 * *Done* and the percentage rise, having made **zero** manual moves.
 *
 * That last clause is the whole claim of `SC-KAN-003`. A board that a person
 * has to drag is a spreadsheet with rounded corners; the claim here is that
 * ticking a checkbox in a file and running the command that reports it is the
 * only thing anybody did. So the run asserts what moved each card — `event`,
 * not `parse` and not `proposal` — because a card in the right column for the
 * wrong reason would pass a screenshot and fail the requirement.
 *
 * It also proves `SC-KAN-004` the only way it can be proved: every file under
 * the Epic's directory is hashed before the board session and again after one
 * that includes a **proposal**, and the two sets must be identical. PMI Studio
 * writes nothing in the project directory — not even the file it is a view of.
 *
 * Constitution XI Tier 2: a run-generated transcript against the running
 * application. Writes `docs/uat/EPIC-046-m4-transcript.md` naming the stack;
 * nothing in it is hand-edited; the credential appears only as a placeholder.
 * The transcript records the board's list time for an Epic of 100 tasks and the
 * parse time for a 1 MiB `tasks.md` (`SC-KAN-007`).
 *
 * **Until this file has been RUN and PASSED against a stack, M4 is "authored,
 * not yet measured"** — never report it as satisfied on the strength of this
 * file existing (`EPIC-044` `T1607`'s rule).
 *
 * Prerequisites: the reference-local stack (README §Setup), a seeded user who
 * owns the projects they create, `E2E_EMAIL`/`E2E_PASSWORD`, and a checkout so
 * the server runs from source. `PMI_PROJECTS_ROOT` lets the run use the
 * directory provisioning prepared; without it a seeded twin is used.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runBegin, runFinish } from '@pmi/workspace-bundle';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
// `EPIC-046` `T1767` — ESM. `e2e/package.json` declares `"type": "module"` so
// Playwright compiles these specs as ES modules, which is what lets them import
// `@pmi/workspace-bundle` (itself ESM, resolved to raw TypeScript). Under the
// previous CommonJS emit that import failed with *exports is not defined*, and
// every harness importing the shipped hooks was uncollectable. `__dirname` is a
// CommonJS global, so it is derived here the ESM way.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-046-m4-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';
const EPIC_DIR = 'specs/003-reports';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Every file under a directory, by path, with its digest. `SC-KAN-004`'s evidence. */
function fingerprint(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (at: string, prefix: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else out[rel] = `${sha256(readFileSync(full, 'utf8'))}:${statSync(full).size}`;
    }
  };
  if (existsSync(dir)) walk(dir, '');
  return out;
}

async function server(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'packages', 'mcp-server', 'src', 'main.ts')],
    env: { ...process.env, PMI_STUDIO_URL: API, PMI_STUDIO_TOKEN: credential } as Record<string, string>,
  });
  const client = new Client({ name: 'm4-tasks-transcript', version: '1.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

/** Five tasks, the shape a real `tasks.md` carries. */
const FIVE_OPEN = [
  '# Tasks: Reports',
  '',
  '- [ ] T8001 [P] Write the failing test in `backend/tests/unit/reports/one.spec.ts`',
  '- [ ] T8002 Implement the reader in `backend/src/modules/reports/reader.ts`',
  '- [ ] T8003 [P] Write the failing test in `backend/tests/unit/reports/two.spec.ts`',
  '- [ ] T8004 Implement the projection in `backend/src/modules/reports/projection.ts`',
  '- [ ] T8005 Register the module in `backend/src/app.module.ts`',
  '',
].join('\n');

const FIVE_DONE = FIVE_OPEN.replace(/- \[ \]/g, '- [X]');

test('M4 — a governed implement moves the board by itself: five cards reach Done with zero manual moves, and no file is written', async ({ page, request }) => {
  test.setTimeout(15 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);
  say('What this run proves: the SHIPPED begin/finish hooks parse an Epic\'s tasks.md through a real pmi-studio server over stdio and report each newly ticked task; a signed-in member with no checkout then watches the board reach five Done and the percentage rise, having made zero manual moves; and every file under the Epic directory is byte-identical before and after a board session that includes a proposal.');

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  say('Signed in.');

  // 2. A project with a root path; the credential is shown once.
  const name = `M4 ${Date.now()}`;
  const rootPath = `m4-${Date.now()}`;
  await page.getByLabel(/project name/i).fill(name);
  await page.getByLabel(/root path/i).fill(rootPath);
  await page.getByRole('button', { name: /^create$/i }).click();
  const credentialBox = page.getByRole('region', { name: /credential/i });
  await expect(credentialBox).toBeVisible();
  const credential = (await credentialBox.locator('code').first().textContent())?.trim() ?? '';
  expect(credential).toMatch(/^pmi_ct_/);
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('region', { name: /local workspace/i })).toBeVisible();
  const projectId = page.url().split('/').filter(Boolean).pop() ?? '';
  say(`Project "${name}" created with root path "${rootPath}"; id ${projectId}; a credential was shown once (value withheld: <credential>).`);

  // 3. Three Epics, so the third is number 3 — the number the hook names.
  await page.goto(`${UI}/requirement-room/epics`);
  await page.locator('#shell-project').selectOption(projectId).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /epics/i })).toBeVisible();
  const create = page.getByRole('form', { name: 'Create an Epic' });
  for (const title of ['Intake', 'Review', 'Reports']) {
    await create.getByLabel('Title').fill(title);
    await create.getByRole('button', { name: 'Create Epic' }).click();
    await expect(page.getByRole('button', { name: `Open ${title}` })).toBeVisible();
  }
  say('Epics 1 Intake, 2 Review, 3 Reports created through the screens.');

  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const epicsRes = await request.get(`${API}/v1/projects/${projectId}/epics`, { headers: { cookie } });
  const epicId = ((await epicsRes.json()) as { epics: { number: number; id: string }[] }).epics.find((e) => e.number === 3)?.id ?? '';
  expect(epicId).not.toBe('');

  // 4. The directory the agent works in.
  const constitutionRes = await request.get(`${API}/v1/projects/${projectId}/constitution`, { headers: { cookie } });
  const constitution = (await constitutionRes.json()) as { content: string };
  const projectsRoot = process.env['PMI_PROJECTS_ROOT'];
  let dir = projectsRoot ? join(projectsRoot, rootPath) : '';
  if (!dir || !existsSync(join(dir, '.pmi', 'project.json'))) {
    dir = mkdtempSync(join(tmpdir(), 'pmi-m4-'));
    mkdirSync(join(dir, '.pmi'), { recursive: true });
    say("The API's projects root is not on this machine; a seeded twin of the provisioned directory is used at a temp path.");
  } else {
    say('Using the directory provisioning prepared under PMI_PROJECTS_ROOT.');
  }
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  mkdirSync(join(dir, EPIC_DIR), { recursive: true });
  writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, platformUrl: API, bundleVersion: '0.2.0' }));
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution.content, 'utf8');

  /** One governed command through the SHIPPED begin/finish pair (`FR-KAN-061`). */
  async function governed(command: 'tasks' | 'implement', content: string): Promise<{ ms: number; outcome: string | null }> {
    const online = await server(credential);
    try {
      const begun = await runBegin(online.client, dir, { command, epic: '3', epicDir: EPIC_DIR, extensionVersion: '0.2.0' });
      for (const l of begun.lines) say(`hook · ${l}`);
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      writeFileSync(join(dir, EPIC_DIR, 'tasks.md'), content, 'utf8');
      const started = Date.now();
      const finished = await runFinish(online.client, dir, EPIC_DIR);
      const ms = Date.now() - started;
      for (const l of finished.lines) say(`hook · ${l}`);
      // FR-KAN-061: the hook prints no sync line of its own now that the tool is live.
      expect(finished.lines.some((l) => l.includes('EPIC-046'))).toBe(false);
      return { ms, outcome: finished.outcome };
    } finally {
      await online.close();
    }
  }

  // 5. A governed `tasks` run puts five cards on the board, none of them done.
  writeFileSync(join(dir, EPIC_DIR, 'spec.md'), '# Reports\n\nThe Reports Epic.\n', 'utf8');
  await governed('tasks', FIVE_OPEN);
  say('A governed `tasks` command wrote five task lines and completed. The finish hook printed no sync line — the tool is live and the prompt specifies none.');

  await page.goto(`${UI}/plan/epics/${epicId}`);
  const board = page.getByRole('region', { name: /task board|board/i }).first();
  await expect(page.getByTestId('latest-parse')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('task-card')).toHaveCount(5, { timeout: 20_000 });
  const notStarted = page.getByRole('region', { name: /not started/i });
  await expect(notStarted.getByTestId('task-card')).toHaveCount(5);
  say('A signed-in member with no checkout opened Plan & Tasks → Reports: five cards, all in Not started, with the latest parse named above them.');

  // 6. The claim: an implement run that ticks all five moves all five, and the
  //    ONLY thing anybody did was tick checkboxes in a file (SC-KAN-003).
  const implemented = await governed('implement', FIVE_DONE);
  expect(implemented.outcome).toBe('completed');
  say(`A governed \`implement\` command ticked all five task lines and completed in ${implemented.ms} ms of finish-hook time. No move was made in PMI Studio.`);

  await page.reload();
  const done = page.getByRole('region', { name: /^done$/i });
  await expect(done.getByTestId('task-card')).toHaveCount(5, { timeout: 30_000 });
  say('The board now shows five cards in Done, after a reload and with zero manual moves (SC-KAN-003).');

  // What MOVED them, which is the part a screenshot cannot show.
  const boardRes = await request.get(`${API}/v1/epics/${epicId}/tasks`, { headers: { cookie } });
  const boardBody = (await boardRes.json()) as { tasks: { taskKey: string; status: string; movedBy: string }[]; remainingUnchecked: number };
  expect(boardBody.tasks).toHaveLength(5);
  for (const card of boardBody.tasks) {
    expect(card.status, card.taskKey).toBe('done');
    // `event` — the shipped progress hook reported each newly ticked task.
    // `parse` would mean the checkbox alone moved it; `proposal` a person did.
    expect(card.movedBy, card.taskKey).toBe('event');
  }
  expect(boardBody.remainingUnchecked).toBe(0);
  say('Every one of the five was moved by an `event` — the shipped progress hook reported each newly ticked task — and not by a parse and not by a person.');

  // 7. The percentage rose, and it is the same derivation everywhere.
  const progressRes = await request.get(`${API}/v1/epics/${epicId}/tasks/progress`, { headers: { cookie } });
  const progress = (await progressRes.json()) as { total: number; done: number; percentComplete: number };
  expect(progress).toMatchObject({ total: 5, done: 5, percentComplete: 100 });

  // The screen reads it from the same derivation: the Plan landing lists every
  // Epic's percentage beside the project's own (`FR-KAN-056`).
  await page.goto(`${UI}/plan`);
  const row = page.getByTestId('epic-row').filter({ hasText: 'Reports' });
  await expect(row).toContainText('100%', { timeout: 20_000 });
  await expect(page.getByTestId('project-progress')).toContainText('100%');
  say(`Progress reads ${progress.done}/${progress.total} = ${progress.percentComplete}% on the API, and the Plan landing shows the same figure for the Epic and for the project — one derivation, three surfaces (FR-KAN-056).`);
  await page.goto(`${UI}/plan/epics/${epicId}`);
  await expect(page.getByTestId('latest-parse')).toBeVisible({ timeout: 20_000 });

  // 8. SC-KAN-004: a whole board session, INCLUDING a move, writes no file.
  const before = fingerprint(join(dir, EPIC_DIR));
  expect(Object.keys(before).length).toBeGreaterThan(0);

  const withIds = await request.get(`${API}/v1/epics/${epicId}/tasks`, { headers: { cookie } });
  const t8001 = ((await withIds.json()) as { tasks: { taskKey: string; id: string }[] }).tasks.find((t) => t.taskKey === 'T8001');
  expect(t8001?.id, 'T8001 is not on the board').toBeTruthy();
  const moveRes = await request.post(`${API}/v1/tasks/${t8001?.id}/status-proposals`, {
    headers: { cookie, 'content-type': 'application/json' },
    data: { expectedCurrentStatus: 'done', requestedStatus: 'in_progress', reason: 'Reopening it after review' },
  });
  const verdict = (await moveRes.json()) as { verdict?: string };
  say(`A member proposed moving T8001 from Done back to In progress; the platform answered \`${verdict.verdict ?? 'refused'}\` and recorded the proposal. Whatever the verdict, the point is what happens to the FILE.`);

  // Read every board surface, so the session is a real one and not a single GET.
  await page.reload();
  await expect(page.getByTestId('latest-parse')).toBeVisible();
  await request.get(`${API}/v1/epics/${epicId}/tasks/disagreements`, { headers: { cookie } });
  await request.get(`${API}/v1/projects/${projectId}/tasks/progress`, { headers: { cookie } });

  const after = fingerprint(join(dir, EPIC_DIR));
  expect(after, 'PMI Studio wrote to the project directory').toEqual(before);
  say(`Every file under ${EPIC_DIR} is byte-identical before and after the board session, the proposal included: ${Object.keys(before).length} files, same digests and same sizes (SC-KAN-004).`);

  // 9. No control on this screen edits the file (FR-KAN-010).
  for (const label of [/^edit$/i, /^save$/i, /upload/i, /rename/i, /delete/i, /tick/i]) {
    await expect(board.getByRole('button', { name: label })).toHaveCount(0);
  }
  say('The board offers no control that edits, saves, renames or deletes — the only move it offers is a proposal.');

  // 10. SC-KAN-007, first half: the board's list time for an Epic of 100 tasks.
  const hundred = ['# Tasks: Reports', ''];
  for (let i = 1; i <= 100; i += 1) {
    hundred.push(`- [ ] T9${String(i).padStart(3, '0')} Task number ${i} in \`src/generated/file-${i}.ts\``);
  }
  hundred.push('');
  await governed('tasks', hundred.join('\n'));

  const listStart = Date.now();
  const bigRes = await request.get(`${API}/v1/epics/${epicId}/tasks`, { headers: { cookie } });
  const listMs = Date.now() - listStart;
  const bigBody = (await bigRes.json()) as { tasks: unknown[] };
  expect(bigBody.tasks.length).toBeGreaterThanOrEqual(100);
  say(`An Epic of ${bigBody.tasks.length} tasks listed in ${listMs} ms on this stack (SC-KAN-007, list half; the budget is two seconds).`);

  const paintStart = Date.now();
  await page.goto(`${UI}/plan/epics/${epicId}`);
  await expect(page.getByTestId('latest-parse')).toBeVisible({ timeout: 30_000 });
  const paintMs = Date.now() - paintStart;
  say(`The same board painted in the browser in ${paintMs} ms.`);

  // 11. SC-KAN-007, second half: the parse time for a 1 MiB `tasks.md`.
  //     Padded with prose, because prose does not use up the line budget —
  //     `PMI_TASKS_MAX_LINES` counts considered lines, not bytes.
  const padding = `\n${'A paragraph of perfectly ordinary prose, standing between two tasks. '.repeat(14)}\n`;
  const big: string[] = ['# Tasks: Reports', ''];
  for (let i = 1; i <= 100; i += 1) {
    big.push(`- [ ] T9${String(i).padStart(3, '0')} Task number ${i} in \`src/generated/file-${i}.ts\``);
    big.push(padding);
  }
  let bigText = big.join('\n');
  // Grow the prose until the file is just under one mebibyte.
  while (Buffer.byteLength(bigText, 'utf8') < 1_040_000) bigText += padding;
  const bigBytes = Buffer.byteLength(bigText, 'utf8');
  expect(bigBytes).toBeLessThan(1_048_576);

  const parsed = await governed('tasks', bigText);
  say(`A ${bigBytes}-byte (${Math.round(bigBytes / 1024)} KiB) tasks.md carrying 100 task lines was parsed and synced in ${parsed.ms} ms of finish-hook time on this stack (SC-KAN-007, parse half). It sits inside PMI_ARTIFACT_SYNC_BODY_BYTES, so the artifact sync in the same hook sequence carried it too.`);

  // 12. The transcript.
  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-046 — M4 transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-046-m4.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld. The governed commands were executed by',
      'the shipped sequence harness through a real `pmi-studio` server over stdio — the hook was not modified for',
      'this Epic. What moved each card was read from the API, not from the screen, because a card in the right',
      'column for the wrong reason would pass a screenshot and fail the requirement.',
      '',
      ...lines,
      '',
      `**Measured**: board list ${listMs} ms for ${bigBody.tasks.length} tasks; board paint ${paintMs} ms; parse and sync ${parsed.ms} ms for ${bigBytes} bytes — on ${STACK}.`,
      '',
    ].join('\n'),
  );
  expect(readFileSync(TRANSCRIPT, 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
  if (!projectsRoot) rmSync(dir, { recursive: true, force: true });
});
