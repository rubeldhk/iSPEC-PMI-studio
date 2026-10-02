/**
 * `T1454` (EPIC-043, `R-043-12`, `SC-PIC-005`, `SC-PIC-007`) — milestone **M1**:
 * create project → the credential once → the agent starts `pmi-studio` from the
 * project's `.mcp.json` over stdio → a governed command registers, reports and
 * completes → the execution appears on the project's timeline.
 *
 * Constitution XI Tier 2: a run-generated transcript against the running
 * application (the reference-local stack). Writes
 * `docs/uat/EPIC-043-m1-transcript.md` naming the stack; nothing in it is
 * hand-edited. The credential appears in the transcript only as a placeholder.
 *
 * Prerequisites: the reference-local stack (README §Setup), a seeded user,
 * `E2E_EMAIL`/`E2E_PASSWORD`, `PMI_PROJECTS_ROOT` writable by the API, and a
 * checkout so the server runs from source (`PMI_MCP_SERVER_COMMAND`).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
// `EPIC-046` `T1767` — ESM. `e2e/package.json` declares `"type": "module"` so
// Playwright compiles these specs as ES modules, which is what lets them import
// `@pmi/workspace-bundle` (itself ESM, resolved to raw TypeScript). Under the
// previous CommonJS emit that import failed with *exports is not defined*, and
// every harness importing the shipped hooks was uncollectable. `__dirname` is a
// CommonJS global, so it is derived here the ESM way.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-043-m1-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

test('M1 — a governed command from a developer machine appears on the project timeline', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  say('Signed in.');

  // 2. Create a project with a root path; the credential is shown once.
  const name = `M1 ${Date.now()}`;
  const rootPath = `m1-${Date.now()}`;
  await page.getByLabel(/project name/i).fill(name);
  await page.getByLabel(/root path/i).fill(rootPath);
  await page.getByRole('button', { name: /^create$/i }).click();
  const credentialBox = page.getByRole('region', { name: /credential/i });
  await expect(credentialBox).toBeVisible();
  const credential = (await credentialBox.locator('code').first().textContent())?.trim() ?? '';
  expect(credential).toMatch(/^pmi_ct_/);
  say(`Project "${name}" created with root path "${rootPath}"; a credential was shown once (value withheld: <credential>).`);

  // 3. Open the project; read its id from the URL and its provisioning state.
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('region', { name: /local workspace/i })).toBeVisible();
  const projectId = page.url().split('/').filter(Boolean).pop() ?? '';
  say(`Project screen open; id ${projectId}.`);

  // 4. The agent's half: start pmi-studio over stdio, as .mcp.json would, with the credential in the environment.
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(REPO, 'packages', 'mcp-server', 'src', 'main.ts')],
    env: { ...process.env, PMI_STUDIO_URL: API, PMI_STUDIO_TOKEN: credential } as Record<string, string>,
  });
  const client = new Client({ name: 'm1-transcript', version: '1.0.0' });
  await client.connect(transport);
  say('pmi-studio started over stdio from source; client connected.');
  try {
    const health = await client.callTool({ name: 'pmi.health', arguments: { extensionVersion: '0.1.0', toolkitVersion: 'v0.16.4' } });
    expect(health.isError).toBeFalsy();
    say(`pmi.health → ${JSON.stringify(health.structuredContent)}`);

    const key = `m1-${Date.now()}`;
    const registered = await client.callTool({
      name: 'pmi.execution.register',
      arguments: { command: 'specify', argsSanitized: { feature: 'M1' }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: `corr-${key}`, idempotencyKey: `reg-${key}` },
    });
    expect(registered.isError).toBeFalsy();
    const executionId = (registered.structuredContent as { executionId: string }).executionId;
    say(`pmi.execution.register → execution ${executionId} (surface mcp-client).`);
    await client.callTool({ name: 'pmi.execution.appendEvent', arguments: { executionId, type: 'started', payload: {}, occurredAt: new Date().toISOString(), idempotencyKey: `start-${key}` } });
    say('pmi.execution.appendEvent → started.');
    const t0 = Date.now();
    const completed = await client.callTool({
      name: 'pmi.execution.complete',
      arguments: { executionId, outcome: 'completed', occurredAt: new Date().toISOString(), completionComment: 'M1 transcript', output: { commitAfter: 'transcript' }, idempotencyKey: `done-${key}` },
    });
    expect(completed.isError).toBeFalsy();
    say('pmi.execution.complete → completed.');

    // 5. The platform's half: the execution is on the timeline (SC-PIC-005: within 5 s).
    const timeline = page.getByRole('region', { name: /execution timeline/i });
    await page.reload();
    await expect(timeline.getByText(executionId.slice(0, 8), { exact: false }).or(timeline.getByText(/mcp-client/))).toBeVisible({ timeout: 5000 });
    const latency = Date.now() - t0;
    say(`Timeline shows the execution ${latency} ms after the completion call (bound 5000 ms).`);
    expect(latency).toBeLessThan(5000);

    // 6. SC-PIC-007: a second project's credential is refused on this execution.
    await page.goto(UI);
    await page.getByLabel(/project name/i).fill(`${name} other`);
    await page.getByLabel(/root path/i).fill(`${rootPath}-other`);
    await page.getByRole('button', { name: /^create$/i }).click();
    const otherBox = page.getByRole('region', { name: /credential/i });
    const other = (await otherBox.locator('code').first().textContent())?.trim() ?? '';
    const refused = await fetch(`${API}/v1/executions/${executionId}/history`, { headers: { authorization: `Bearer ${other}`, 'x-contract-version': '1.0' } });
    say(`Another project's credential reading this execution → HTTP ${refused.status}.`);
    expect(refused.status).toBe(404);
  } finally {
    await client.close();
  }

  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-043 — M1 transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-043-m1.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld.',
      '',
      ...lines,
      '',
    ].join('\n'),
  );
  expect(readFileSync(TRANSCRIPT, 'utf8')).not.toMatch(/pmi_ct_[A-Za-z0-9_-]{20,}/);
});
