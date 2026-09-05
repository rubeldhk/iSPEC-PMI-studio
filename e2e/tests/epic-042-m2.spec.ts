/**
 * `T1533` (EPIC-042, `R-042-12`, `SC-EXT-002`, `SC-EXT-003`, `SC-EXT-006`,
 * `SC-EXT-007`, `SC-EXT-008`) — milestone **M2**: constraints and a policy are
 * entered in PMI Studio → a project is created with a root path → the hook
 * sequences run through a real `pmi-studio` server over stdio (the harness
 * performs exactly the calls the prompts instruct) → a first run, a governed
 * `plan`, a strict-mode refusal and a provisional record → the executions are
 * on the timeline, the constitution file on disk matches the preview's digest,
 * the workstation reports its state.
 *
 * Constitution XI Tier 2: a run-generated transcript against the running
 * application (the reference-local stack). Writes
 * `docs/uat/EPIC-042-m2-transcript.md` naming the stack; nothing in it is
 * hand-edited; the credential appears only as a placeholder. The transcript
 * states what it proves: the hook PROMPTS are verified by conformance
 * (`extension-conformance.spec.ts`), the hook SEQUENCES by this run. A person
 * running the real agent against the same stack adds a second section
 * (`T1537`), including two consecutive `/setup-PMIStudio` runs (`SC-EXT-010`).
 *
 * Until `EPIC-044` makes Epic a product entity the platform derives no Epics
 * (`FR-PIC-043`), so the first run over the composed application registers
 * nothing and says so; the loop with three Epics and a split is exercised in
 * `packages/workspace-bundle/tests/first-run.spec.ts` against a stub. Stated
 * here, not hidden.
 *
 * Prerequisites: the reference-local stack (README §Setup), a seeded user,
 * `E2E_EMAIL`/`E2E_PASSWORD`, `PMI_PROJECTS_ROOT` writable by the API, and a
 * checkout so the server runs from source (`PMI_MCP_SERVER_COMMAND`).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { constitutionDigest, renderDigest, runBegin, runFinish, runFirstRun } from '@pmi/workspace-bundle';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const REPO = resolve(__dirname, '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-042-m2-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

async function server(credential: string, url = API): Promise<{ client: Client; close(): Promise<void> }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'packages', 'mcp-server', 'src', 'main.ts')],
    env: { ...process.env, PMI_STUDIO_URL: url, PMI_STUDIO_TOKEN: credential } as Record<string, string>,
  });
  const client = new Client({ name: 'm2-transcript', version: '1.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

test('M2 — constraints and requirements from PMI Studio; one governed run per Epic; the constitution generated', async ({ page, request }) => {
  test.setTimeout(12 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);
  say('What this run proves: the hook prompts are verified by conformance (extension-conformance.spec.ts); the hook SEQUENCES are executed here through a real pmi-studio server over stdio, with the calls the prompts instruct.');

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  say('Signed in.');

  // 2. Create a project with a root path; the credential is shown once.
  const name = `M2 ${Date.now()}`;
  const rootPath = `m2-${Date.now()}`;
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
  say(`Project screen open; id ${projectId}.`);

  // 3. Constraints, the policy and a requirement in PMI Studio (Governance → Constraints).
  await page.goto(`${UI}/governance`);
  await expect(page.getByRole('heading', { name: 'Constraints' })).toBeVisible();
  for (const [kind, title, body] of [
    ['principle', 'Specification first', 'Nothing is built that was not specified.'],
    ['principle', 'Then build', 'Only then.'],
    ['constraint', 'Postgres 16', 'The only database.'],
    ['non_goal', 'No mobile', 'Not in v1.'],
  ] as const) {
    await page.getByLabel('Kind').selectOption(kind);
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Body').fill(body);
    await page.getByRole('button', { name: 'Add entry' }).click();
    await expect(page.getByRole('region', { name: kind === 'principle' ? 'Principles' : kind === 'constraint' ? 'Constraints' : 'Non-goals' }).getByText(title)).toBeVisible();
  }
  const policyForm = page.getByRole('form', { name: 'Decomposition policy' });
  await policyForm.getByLabel('Task ceiling').fill('40');
  await policyForm.getByRole('button', { name: 'Save policy' }).click();
  await expect(policyForm.getByText(/Version 2\./)).toBeVisible();
  const preview = page.getByRole('region', { name: 'Constitution preview' });
  const previewDigest = (await preview.locator('code').first().textContent())?.trim() ?? '';
  expect(previewDigest).toMatch(/^[0-9a-f]{64}$/);
  say(`Two principles, a constraint, a non-goal and a policy (ceiling 40) entered; the preview shows constitution version with digest ${previewDigest.slice(0, 12)}….`);
  const cookies = await page.context().cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const req = await request.post(`${API}/v1/projects/${projectId}/requirements`, { headers: { cookie }, data: { reference: 'REQ-001', description: 'The product shall intake requirements', type: 'functional', priority: 'p1' } });
  expect(req.status()).toBe(201);
  say('Requirement REQ-001 added to the project.');

  // 4. The directory the agent works in: what provisioning wrote, or a seeded twin when the API's root is not this machine's.
  const constitutionRes = await request.get(`${API}/v1/projects/${projectId}/constitution`, { headers: { cookie } });
  const constitution = (await constitutionRes.json()) as { content: string; digest: string; version: number };
  expect(constitution.digest).toBe(previewDigest);
  const projectsRoot = process.env['PMI_PROJECTS_ROOT'];
  let dir = projectsRoot ? join(projectsRoot, rootPath) : '';
  if (!dir || !existsSync(join(dir, '.pmi', 'project.json'))) {
    dir = mkdtempSync(join(tmpdir(), 'pmi-m2-'));
    mkdirSync(join(dir, '.pmi'), { recursive: true });
    mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
    writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, platformUrl: API, bundleVersion: '0.2.0' }));
    writeFileSync(join(dir, '.pmi', 'first-run'), `${new Date().toISOString()} m2\n`);
    say(`The API's projects root is not on this machine; a seeded twin of the provisioned directory is used at a temp path.`);
  } else {
    say(`Using the directory provisioning prepared under PMI_PROJECTS_ROOT.`);
  }
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution.content, 'utf8');
  expect(constitutionDigest(dir)).toBe(constitution.digest);
  expect(renderDigest(readFileSync(join(dir, '.specify', 'memory', 'constitution.md'), 'utf8'))).toBe(previewDigest);
  say(`The constitution file on disk matches the preview's digest (${previewDigest.slice(0, 12)}…).`);

  // 5. The first run, through the hooks over stdio.
  const online = await server(credential);
  try {
    const first = await runFirstRun(online.client, dir, { estimate: () => 20, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'the transcript', extensionVersion: '0.2.0' });
    for (const l of first.lines) say(`hook · ${l}`);
    expect(first.firstRun).toBe(true);
    expect(existsSync(join(dir, '.pmi', 'first-run'))).toBe(false);
    say(`First run: ${first.executions.length} specifications registered (the platform derives no Epics until EPIC-044; the three-Epic loop with a split is proven against a stub in first-run.spec.ts).`);

    // 6. A governed plan: registered before, completed after, with digests.
    mkdirSync(join(dir, 'specs', '001-intake'), { recursive: true });
    writeFileSync(join(dir, 'specs', '001-intake', 'spec.md'), '# Intake\n');
    const begun = await runBegin(online.client, dir, { command: 'plan', epic: '1', epicDir: 'specs/001-intake', extensionVersion: '0.2.0' });
    for (const l of begun.lines) say(`hook · ${l}`);
    expect(begun.executionId).toBeTruthy();
    expect(begun.lines).toContain('PMI · constitution current');
    writeFileSync(join(dir, 'specs', '001-intake', 'plan.md'), '# Plan\n');
    const t0 = Date.now();
    const finished = await runFinish(online.client, dir, 'specs/001-intake');
    for (const l of finished.lines) say(`hook · ${l}`);
    expect(finished.outcome).toBe('completed');
    await page.goto(`${UI}/projects/${projectId}`);
    const timeline = page.getByRole('region', { name: /execution timeline/i });
    await expect(timeline.getByText((begun.executionId as string).slice(0, 8), { exact: false }).or(timeline.getByText(/mcp-client/))).toBeVisible({ timeout: 5000 });
    say(`The plan execution is on the timeline ${Date.now() - t0} ms after the completion call.`);
    const workstation = page.getByRole('list', { name: 'Workstation connections' });
    await expect(workstation).toContainText('constitution current');
    say('The workstation panel shows the constitution as current.');
  } finally {
    await online.close();
  }

  // 7. Strict: unreachable → refused, nothing written.
  const offlineStrict = await server(credential, 'http://127.0.0.1:9');
  try {
    const refused = await runBegin(offlineStrict.client, dir, { command: 'clarify', epic: '1', epicDir: 'specs/001-intake' });
    for (const l of refused.lines) say(`hook · ${l}`);
    expect(refused.refused?.code).toBe('platform_unreachable');
    expect(existsSync(join(dir, '.pmi', 'provisional'))).toBe(false);
  } finally {
    await offlineStrict.close();
  }

  // 8. Provisional: the owner allows it; the file refreshes; a record is queued; reconnect offers it.
  const policy = await request.put(`${API}/v1/projects/${projectId}/policy`, { headers: { cookie }, data: { oneSpecPerEpic: true, taskCeiling: 40, splitRequiresConfirmation: true, offlineMode: 'provisional' } });
  expect(policy.status()).toBe(200);
  const refresh = await server(credential);
  try {
    const b = await runBegin(refresh.client, dir, { command: 'checklist', epic: '1', epicDir: 'specs/001-intake' });
    for (const l of b.lines) say(`hook · ${l}`);
    expect(b.lines).toContain('PMI · constitution stale→refreshed');
    await runFinish(refresh.client, dir, 'specs/001-intake');
  } finally {
    await refresh.close();
  }
  const offline = await server(credential, 'http://127.0.0.1:9');
  try {
    const queued = await runBegin(offline.client, dir, { command: 'clarify', epic: '1', epicDir: 'specs/001-intake' });
    for (const l of queued.lines) say(`hook · ${l}`);
    expect(queued.provisional).toBe(true);
    const done = await runFinish(offline.client, dir, 'specs/001-intake');
    for (const l of done.lines) say(`hook · ${l}`);
    expect(done.lines.at(-1)).toMatch(/\(not governed\)$/);
    expect(readdirSync(join(dir, '.pmi', 'provisional'))).toHaveLength(1);
  } finally {
    await offline.close();
  }
  const back = await server(credential);
  try {
    const b = await runBegin(back.client, dir, { command: 'plan', epic: '1', epicDir: 'specs/001-intake' });
    for (const l of b.lines) say(`hook · ${l}`);
    expect(b.lines).toContain('PMI · sync not available until EPIC-037');
    await runFinish(back.client, dir, 'specs/001-intake');
  } finally {
    await back.close();
  }

  // 9. Drift: a hand edit is reported and shown.
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), readFileSync(join(dir, '.specify', 'memory', 'constitution.md'), 'utf8') + '\n## My own section\n', 'utf8');
  const drift = await server(credential);
  try {
    const b = await runBegin(drift.client, dir, { command: 'analyze', epic: '1', epicDir: 'specs/001-intake' });
    for (const l of b.lines) say(`hook · ${l}`);
    expect(b.lines).toContain('PMI · constitution drift — waiting for confirmation');
    await runFinish(drift.client, dir, 'specs/001-intake');
  } finally {
    await drift.close();
  }
  await page.goto(`${UI}/projects/${projectId}`);
  await expect(page.getByRole('status', { name: 'Constitution file differs' })).toBeVisible();
  say('A hand edit to the file: the begin hook reported drift and waited; the project screen shows "file differs".');

  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-042 — M2 transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-042-m2.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld. The hook prompts are verified by',
      'conformance; the hook sequences were executed by the harness through a real `pmi-studio` server.',
      '',
      ...lines,
      '',
      '## Manual section (T1537)',
      '',
      '_A person running the real agent against the same stack records here: two consecutive `/setup-PMIStudio` runs with both tables and a clean `git status` after the second (SC-EXT-010)._',
      '',
    ].join('\n'),
  );
  expect(readFileSync(TRANSCRIPT, 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
  if (!projectsRoot) rmSync(dir, { recursive: true, force: true });
});
