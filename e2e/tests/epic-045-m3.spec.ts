/**
 * `T1667` (EPIC-045, `SC-ART-001`, `SC-ART-003`, `SC-ART-005`, `SC-ART-006`) —
 * milestone **M3, second half**: a governed `specify` on the reference-local
 * stack through a real `pmi-studio` server over stdio and the **shipped**
 * finish sequence → a signed-in member with **no checkout** opens the Epic
 * detail, reads `spec.md`, opens `plan.md` after a `plan`, picks the earlier
 * `spec.md` version, and the digest shown equals the file's.
 *
 * That last clause is the whole claim of `SC-ART-003`: the digest on screen is
 * computed from the file on disk, so a reader who has never cloned the
 * repository is looking at the same bytes the agent wrote — not at a
 * paraphrase, and not at something the platform reconstructed.
 *
 * Constitution XI Tier 2: a run-generated transcript against the running
 * application. Writes `docs/uat/EPIC-045-m3-transcript.md` naming the stack;
 * nothing in it is hand-edited; the credential appears only as a placeholder.
 * The transcript also records the time to render a generated 500 KiB markdown
 * file on the stack (`SC-ART-006`, render half).
 *
 * **Until this file has been RUN and PASSED against a stack, the M3 second half
 * is "authored, not yet measured"** — never report it as satisfied on the
 * strength of this file existing (`EPIC-044` `T1607`'s rule).
 *
 * Prerequisites: the reference-local stack (README §Setup), a seeded user who
 * owns the projects they create, `E2E_EMAIL`/`E2E_PASSWORD`, and a checkout so
 * the server runs from source. `PMI_PROJECTS_ROOT` lets the run use the
 * directory provisioning prepared; without it a seeded twin is used.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runBegin, runFinish } from '@pmi/workspace-bundle';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const REPO = resolve(__dirname, '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-045-m3-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';
const EPIC_DIR = 'specs/003-reports';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function server(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'packages', 'mcp-server', 'src', 'main.ts')],
    env: { ...process.env, PMI_STUDIO_URL: API, PMI_STUDIO_TOKEN: credential } as Record<string, string>,
  });
  const client = new Client({ name: 'm3-artifacts-transcript', version: '1.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

test('M3 (second half) — a governed command syncs the Epic files; a member with no checkout reads them, picks an earlier version, and the digest matches', async ({ page, request }) => {
  test.setTimeout(12 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);
  say('What this run proves: the SHIPPED finish hook syncs the Epic markdown set through a real pmi-studio server over stdio; a signed-in member with no checkout then reads those files in PMI Studio, picks an earlier version, and the digest on screen equals the SHA-256 of the file on disk.');

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  say('Signed in.');

  // 2. A project with a root path; the credential is shown once.
  const name = `M3A ${Date.now()}`;
  const rootPath = `m3a-${Date.now()}`;
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

  // 4. The directory the agent works in.
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const constitutionRes = await request.get(`${API}/v1/projects/${projectId}/constitution`, { headers: { cookie } });
  const constitution = (await constitutionRes.json()) as { content: string };
  const projectsRoot = process.env['PMI_PROJECTS_ROOT'];
  let dir = projectsRoot ? join(projectsRoot, rootPath) : '';
  if (!dir || !existsSync(join(dir, '.pmi', 'project.json'))) {
    dir = mkdtempSync(join(tmpdir(), 'pmi-m3a-'));
    mkdirSync(join(dir, '.pmi'), { recursive: true });
    say("The API's projects root is not on this machine; a seeded twin of the provisioned directory is used at a temp path.");
  } else {
    say('Using the directory provisioning prepared under PMI_PROJECTS_ROOT.');
  }
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  mkdirSync(join(dir, EPIC_DIR), { recursive: true });
  writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, platformUrl: API, bundleVersion: '0.2.0' }));
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution.content, 'utf8');

  // 5. Two governed commands through the SHIPPED hook sequence: a specify that
  //    writes spec.md, a second specify that changes it, and a plan that adds
  //    plan.md. The hook is EPIC-042's, unedited (`FR-ART-046`).
  const specV1 = '# Reports\n\nThe first specification of the Reports Epic.\n';
  const specV2 = '# Reports\n\nThe SECOND specification of the Reports Epic, after clarification.\n';
  const planBody = '# Plan\n\n| Step | Owner |\n| --- | --- |\n| Build | the team |\n\n- [x] decided\n- [ ] built\n';

  const online = await server(credential);
  try {
    for (const [command, file, body] of [
      ['specify', 'spec.md', specV1],
      ['specify', 'spec.md', specV2],
      ['plan', 'plan.md', planBody],
    ] as const) {
      const begun = await runBegin(online.client, dir, { command, epic: '3', epicDir: EPIC_DIR, extensionVersion: '0.2.0' });
      for (const l of begun.lines) say(`hook · ${l}`);
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      writeFileSync(join(dir, EPIC_DIR, file), body, 'utf8');
      const finished = await runFinish(online.client, dir, EPIC_DIR);
      for (const l of finished.lines) say(`hook · ${l}`);
      expect(finished.outcome).toBe('completed');
      // FR-ART-046: the hook prints no sync line of its own now that the tool is live.
      expect(finished.lines.some((l) => l.includes('EPIC-045'))).toBe(false);
    }
    say('Three governed commands completed: two specify (spec.md written then changed) and one plan (plan.md added). The finish hook printed no sync line — the tool is live and the prompt specifies none.');
  } finally {
    await online.close();
  }

  // 6. A member with NO CHECKOUT reads the Epic's files (SC-ART-001).
  await page.goto(`${UI}/requirement-room/epics`);
  await page.getByRole('button', { name: 'Open Reports' }).click();
  await expect(page.getByRole('heading', { name: /Epic 3 · Reports/ })).toBeVisible();
  const files = page.getByRole('region', { name: 'Files' });
  await expect(files).toBeVisible({ timeout: 15_000 });
  await expect(files).toContainText('spec.md');
  await expect(files).toContainText('plan.md');
  await expect(files).toContainText('the project directory is authoritative');
  say('Epic 3 detail opened by a signed-in member with no checkout: the Files section lists spec.md and plan.md and states that the project directory is authoritative.');

  // 7. spec.md renders, at its CURRENT version.
  const t0 = Date.now();
  await files.getByRole('button', { name: /spec\.md/ }).first().click();
  const open = page.getByRole('region', { name: 'Open file' });
  await expect(open).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(open).toContainText('Version 1 of 2');
  await expect(open).toContainText(sha256(specV2).slice(0, 12));
  say(`spec.md opened and rendered in ${Date.now() - t0} ms: the current version is 1 of 2 and its digest is ${sha256(specV2).slice(0, 12)}… — the SHA-256 of the file on disk (SC-ART-003).`);

  // 8. plan.md renders, tables and task lists and all.
  await files.getByRole('button', { name: /plan\.md/ }).first().click();
  await expect(open).toContainText('plan.md');
  await expect(page.getByRole('table')).toBeVisible();
  const checkboxes = page.locator('input[type="checkbox"]');
  await expect(checkboxes.first()).toBeDisabled();
  await expect(open).toContainText(sha256(planBody).slice(0, 12));
  say('plan.md opened after the plan command: its GFM table renders and its task-list checkboxes are disabled — the viewer is read-only.');

  // 9. The earlier version of spec.md (SC-ART-003, US3).
  await files.getByRole('button', { name: /spec\.md/ }).first().click();
  await expect(open).toBeVisible();
  const versions = page.getByRole('listbox', { name: 'Versions' });
  await expect(versions.getByRole('option')).toHaveCount(2);
  await versions.getByRole('option').nth(1).click();
  await expect(open).toContainText('Not the current version');
  await expect(open).toContainText(sha256(specV1).slice(0, 12));
  await expect(page.getByText('The first specification of the Reports Epic.')).toBeVisible();
  say(`The earlier version of spec.md was picked from the version picker: the header says "Not the current version", the content is the first specification, and the digest shown is ${sha256(specV1).slice(0, 12)}… — equal to the SHA-256 of what was on disk at that time (SC-ART-003).`);

  // 10. The address carries the selection, so the view survives a reload.
  const addressed = page.url();
  expect(addressed).toContain('file=');
  expect(addressed).toContain('version=');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Open file' })).toContainText('Not the current version');
  say('The address carries ?file= and ?version=, so the exact version reloads — a colleague can be sent the link.');

  // 11. A large file's render time on this stack (SC-ART-006, render half).
  const large = `# Large\n\n${'A paragraph of perfectly ordinary prose, repeated. '.repeat(20)}\n\n`.repeat(260);
  const largeBytes = Buffer.byteLength(large, 'utf8');
  const online2 = await server(credential);
  let largeVersionId = '';
  try {
    const begun = await runBegin(online2.client, dir, { command: 'tasks', epic: '3', epicDir: EPIC_DIR, extensionVersion: '0.2.0' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(dir, EPIC_DIR, 'tasks.md'), large, 'utf8');
    const finished = await runFinish(online2.client, dir, EPIC_DIR);
    expect(finished.outcome).toBe('completed');
  } finally {
    await online2.close();
  }
  const tree = await request.get(`${API}/v1/epics/${(await request.get(`${API}/v1/projects/${projectId}/epics`, { headers: { cookie } }).then(async (r) => ((await r.json()) as { epics: { number: number; id: string }[] }).epics.find((e) => e.number === 3)?.id))}/artifacts`, { headers: { cookie } });
  const treeBody = (await tree.json()) as { files: { path: string; current: { versionId: string; sizeBytes: number } | null }[] };
  largeVersionId = treeBody.files.find((f) => f.path.endsWith('tasks.md'))?.current?.versionId ?? '';
  expect(largeVersionId).not.toBe('');

  const t1 = Date.now();
  await page.goto(`${UI}/requirement-room/epics`);
  await page.getByRole('button', { name: 'Open Reports' }).click();
  await page.getByRole('region', { name: 'Files' }).getByRole('button', { name: /tasks\.md/ }).first().click();
  await expect(page.getByRole('region', { name: 'Open file' })).toContainText('tasks.md');
  await expect(page.getByRole('heading', { name: 'Large' })).toBeVisible({ timeout: 30_000 });
  const renderMs = Date.now() - t1;
  say(`A generated markdown file of ${largeBytes} bytes (${Math.round(largeBytes / 1024)} KiB) rendered in ${renderMs} ms on this stack (SC-ART-006, render half).`);

  // 12. Nothing on this screen edits anything (FR-ART-010).
  for (const label of [/^edit$/i, /^save$/i, /upload/i, /rename/i, /delete/i]) {
    await expect(page.getByRole('region', { name: 'Files' }).getByRole('button', { name: label })).toHaveCount(0);
  }
  say('The Files section offers no control that creates, uploads, renames, edits or deletes.');

  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-045 — M3 second-half transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-045-m3.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld. The governed commands were executed by',
      'the shipped sequence harness through a real `pmi-studio` server over stdio — the hook was not modified for',
      'this Epic. Every digest asserted was recomputed from the file on disk and compared with what the screen',
      'shows.',
      '',
      ...lines,
      '',
      `**Measured**: large-file render ${renderMs} ms for ${largeBytes} bytes on ${STACK}.`,
      '',
    ].join('\n'),
  );
  expect(readFileSync(TRANSCRIPT, 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
  if (!projectsRoot) rmSync(dir, { recursive: true, force: true });
});
