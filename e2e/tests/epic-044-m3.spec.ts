/**
 * `T1602` (EPIC-044, `SC-EPB-001`, `SC-EPB-003`, `SC-EPB-004`, `SC-EPB-006`,
 * `SC-EPB-008`) — milestone **M3**: three Epics created and requirements
 * assigned in the Requirement Room → the board shows every Epic at *Not
 * started* with `/speckit-specify` next → a first run through a real
 * `pmi-studio` server over stdio (the sequence harness performs exactly the
 * calls the hook prompts instruct) with one confirmed split → the board shows
 * every whole Epic at *Specified* with `/speckit-clarify` next, the two children
 * present at *Specified*, and the parent *split into* them.
 *
 * Constitution XI Tier 2: a run-generated transcript against the running
 * application (the reference-local stack). Writes
 * `docs/uat/EPIC-044-m3-transcript.md` naming the stack; nothing in it is
 * hand-edited; the credential appears only as a placeholder. Until this file
 * has been RUN and PASSED against a stack, M3 is "authored, not yet measured"
 * (`T1607`) — never report it as satisfied on the strength of this file
 * existing.
 *
 * Prerequisites: the reference-local stack (README §Setup), a seeded user who
 * owns the projects they create, `E2E_EMAIL`/`E2E_PASSWORD`, and a checkout so
 * the server runs from source. `PMI_PROJECTS_ROOT` lets the run use the
 * directory provisioning prepared; without it a seeded twin is used.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runFirstRun } from '@pmi/workspace-bundle';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
// `EPIC-046` `T1767` — ESM. `e2e/package.json` declares `"type": "module"` so
// Playwright compiles these specs as ES modules, which is what lets them import
// `@pmi/workspace-bundle` (itself ESM, resolved to raw TypeScript). Under the
// previous CommonJS emit that import failed with *exports is not defined*, and
// every harness importing the shipped hooks was uncollectable. `__dirname` is a
// CommonJS global, so it is derived here the ESM way.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-044-m3-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

async function server(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'packages', 'mcp-server', 'src', 'main.ts')],
    env: { ...process.env, PMI_STUDIO_URL: API, PMI_STUDIO_TOKEN: credential } as Record<string, string>,
  });
  const client = new Client({ name: 'm3-transcript', version: '1.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

test('M3 — Epics in the Requirement Room; stages derived from the first run; a confirmed split becomes children on the board', async ({ page, request }) => {
  test.setTimeout(12 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);
  say('What this run proves: Epics are created and requirements assigned through the screens; the first run is executed through a real pmi-studio server over stdio; every stage on the board is derived from those executions and nothing here sets one.');

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  say('Signed in.');

  // 2. A project with a root path; the credential is shown once.
  const name = `M3 ${Date.now()}`;
  const rootPath = `m3-${Date.now()}`;
  await page.getByLabel(/project name/i).fill(name);
  await page.getByLabel(/root path/i).fill(rootPath);
  await page.getByRole('button', { name: /^create$/i }).click();
  const credentialBox = page.getByRole('region', { name: /credential/i });
  await expect(credentialBox).toBeVisible();
  const credential = (await credentialBox.locator('code').first().textContent())?.trim() ?? '';
  expect(credential).toMatch(/^pmi_ct_/);
  say(`Project "${name}" created with root path "${rootPath}"; a credential was shown once (value withheld: <credential>).`);
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('region', { name: /local workspace/i })).toBeVisible();
  const projectId = page.url().split('/').filter(Boolean).pop() ?? '';
  say(`Project screen open; id ${projectId}; it is the selected project of the shell.`);

  // 3. Four requirements (the intake is EPIC-007's; the Epic work is this Epic's).
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  for (const [reference, description] of [
    ['REQ-001', 'The product shall intake requirements'],
    ['REQ-002', 'The product shall triage intake'],
    ['REQ-003', 'The product shall review specifications'],
    ['REQ-004', 'The product shall report on progress'],
  ]) {
    const res = await request.post(`${API}/v1/projects/${projectId}/requirements`, { headers: { cookie }, data: { reference, description, type: 'functional', priority: 'p1' } });
    expect(res.status()).toBe(201);
  }
  say('Requirements REQ-001 to REQ-004 added to the project.');

  // 4. Three Epics in the Requirement Room; the number is allocated by the platform.
  await page.goto(`${UI}/requirement-room/epics`);
  await page.locator('#shell-project').selectOption(projectId).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /epics/i })).toBeVisible();
  const create = page.getByRole('form', { name: 'Create an Epic' });
  for (const title of ['Intake', 'Review', 'Reports']) {
    await create.getByLabel('Title').fill(title);
    await create.getByRole('button', { name: 'Create Epic' }).click();
    await expect(page.getByRole('button', { name: `Open ${title}` })).toBeVisible();
  }
  await expect(page.getByText('REQ-004')).toBeVisible();
  say('Epics 1 Intake, 2 Review, 3 Reports created; the list shows the unassigned requirements separately.');

  // 5. Assignment from the Epic's own screen (owner only).
  const assign = async (epicTitle: string, references: string[]): Promise<void> => {
    await page.goto(`${UI}/requirement-room/epics`);
    await page.getByRole('button', { name: `Open ${epicTitle}` }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Epic \\d+ · ${epicTitle}`) })).toBeVisible();
    for (const reference of references) {
      const form = page.getByRole('form', { name: 'Assign a requirement to this Epic' });
      await form.getByLabel('Assign a requirement').selectOption({ label: reference });
      await form.getByRole('button', { name: 'Assign' }).click();
      await expect(page.getByRole('region', { name: 'Requirements' }).getByText(reference)).toBeVisible();
    }
  };
  await assign('Intake', ['REQ-001', 'REQ-002']);
  await assign('Review', ['REQ-003']);
  say('REQ-001 and REQ-002 assigned to Intake, REQ-003 to Review; REQ-004 left unassigned.');

  // 6. The board before any execution: every Epic Not started, /speckit-specify next (SC-EPB-004).
  await page.goto(`${UI}/specifications/board`);
  await expect(page.getByRole('heading', { name: 'Spec Journey Board' })).toBeVisible();
  const notStarted = page.getByRole('region', { name: 'Stage: Not started' });
  for (const title of ['Intake', 'Review', 'Reports']) {
    const card = notStarted.getByRole('article', { name: new RegExp(`Epic \\d+ · ${title}`) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Next: /speckit-specify');
  }
  say('Board before the first run: three cards at Not started, each with /speckit-specify next.');

  // 7. The directory the agent works in.
  const constitutionRes = await request.get(`${API}/v1/projects/${projectId}/constitution`, { headers: { cookie } });
  const constitution = (await constitutionRes.json()) as { content: string };
  const projectsRoot = process.env['PMI_PROJECTS_ROOT'];
  let dir = projectsRoot ? join(projectsRoot, rootPath) : '';
  if (!dir || !existsSync(join(dir, '.pmi', 'project.json'))) {
    dir = mkdtempSync(join(tmpdir(), 'pmi-m3-'));
    mkdirSync(join(dir, '.pmi'), { recursive: true });
    mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
    writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, platformUrl: API, bundleVersion: '0.2.0' }));
    writeFileSync(join(dir, '.pmi', 'first-run'), `${new Date().toISOString()} m3\n`);
    say('The API\'s projects root is not on this machine; a seeded twin of the provisioned directory is used at a temp path.');
  } else {
    say('Using the directory provisioning prepared under PMI_PROJECTS_ROOT.');
  }
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution.content, 'utf8');

  // 8. The first run over stdio: Intake estimated above the ceiling and its split confirmed; the others whole.
  const online = await server(credential);
  let executions = 0;
  try {
    const t0 = Date.now();
    const first = await runFirstRun(online.client, dir, {
      estimate: (epic) => (epic.slug === 'intake' ? 80 : 10),
      decide: (proposal) => ({ decision: proposal.epic.slug === 'intake' ? 'confirmed' : 'rejected' }),
      runStock: async (target) => {
        mkdirSync(join(dir, target.epicDir), { recursive: true });
        writeFileSync(join(dir, target.epicDir, 'spec.md'), `# ${target.slug}\n`);
      },
      decidedBy: process.env['E2E_EMAIL'] ?? 'the transcript',
      extensionVersion: '0.2.0',
    });
    for (const l of first.lines) say(`hook · ${l}`);
    expect(first.firstRun).toBe(true);
    executions = first.executions.length;
    expect(executions).toBe(4);
    say(`First run: ${executions} specify executions registered and completed in ${Date.now() - t0} ms — Intake as 1a and 1b (split confirmed), Review and Reports whole.`);
  } finally {
    await online.close();
  }

  // 9. The board after: the children exist at Specified, the whole Epics at Specified with /speckit-clarify next, the parent split (SC-EPB-001, SC-EPB-006).
  const t1 = Date.now();
  await page.goto(`${UI}/specifications/board`);
  await expect(page.getByRole('heading', { name: 'Spec Journey Board' })).toBeVisible();
  const specified = page.getByRole('region', { name: 'Stage: Specified' });
  for (const title of ['Review', 'Reports', 'Intake (a)', 'Intake (b)']) {
    const card = specified.getByRole('article', { name: new RegExp(`Epic \\d+ · ${title.replace(/[()]/g, '\\$&')}`) });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('specify · completed');
    await expect(card).toContainText('Next: /speckit-clarify');
  }
  const parent = page.getByRole('article', { name: /Epic 1 · Intake$/ });
  await expect(parent).toContainText(/split into \d+, \d+/);
  say(`Board after the first run, read ${Date.now() - t1} ms after the last completion: Review, Reports, Intake (a) and Intake (b) at Specified with /speckit-clarify next; Epic 1 Intake reads split into its children.`);
  await expect(page.getByText(/Stages are derived from executions/)).toBeVisible();
  await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0);
  say('The board states that stages are derived from executions and offers no refresh control.');

  // 10. The Epic list agrees: the parent split, two children with suffixes, nothing created twice.
  await page.goto(`${UI}/requirement-room/epics`);
  await expect(page.getByRole('button', { name: 'Open Intake (a)' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Intake (b)' })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Intake (a)' })).toHaveCount(1);
  say('The Epic list shows one Intake (a) and one Intake (b) after two reads — the decision was processed once.');

  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-044 — M3 transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-044-m3.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld. The Epics and assignments were made',
      'through the screens; the first run was executed by the sequence harness through a real `pmi-studio`',
      'server over stdio; every stage asserted was derived from those executions.',
      '',
      ...lines,
      '',
    ].join('\n'),
  );
  expect(readFileSync(TRANSCRIPT, 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
  if (!projectsRoot) rmSync(dir, { recursive: true, force: true });
});
