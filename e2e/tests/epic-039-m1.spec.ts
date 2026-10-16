/**
 * `T2232` (EPIC-039, `US8`, `SC-HUB-007`, `FR-HUB-071`–`FR-HUB-076`,
 * `R-039-16`) — the Integrations journey, Constitution XI Tier 2: a
 * run-generated transcript against the running application.
 *
 * Setup goes through the **API**, never the database, so the walk exercises
 * the composed stack: a project, `fixture-ci` registered and configured for
 * `ReadBuildStatus` with a binding scripting it unhealthy, and one request
 * that is refused. Then, as a reviewer: open **Integrations** from the shell
 * navigation, find `pmi-studio` listed first, find the unhealthy adapter with
 * its reason, open it and read the refused resolution's per-candidate
 * explanation, confirm there is no configuration control and the *"through the
 * API"* note is present, and read the list again at 360 px. The final step
 * records `SC-HUB-007`'s reviewer question and the answer read from the screen
 * alone (`T2240`, folded in here by analysis D1).
 *
 * Writes `docs/uat/EPIC-039-m1-transcript.md` naming the stack; nothing in it
 * is hand-edited; credentials appear only as placeholders, and the walk asserts
 * that no connector credential (`pmi_ct_`) or canary (`pmi-canary-`) reached
 * the transcript. `tests/governance/epic039-transcript.spec.ts` checks it.
 *
 * **Until this file has been RUN and PASSED against a stack, the journey is
 * "authored, not yet run"** (`T2233`) — never report Tier 2 as satisfied on the
 * strength of this file existing (`EPIC-044` `T1607`'s rule).
 *
 * Prerequisites: the reference-local stack (README §Setup) with
 * `PMI_ENVIRONMENT` set and the health scheduler on (the default), and
 * `E2E_EMAIL` / `E2E_PASSWORD` for a seeded user.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-039-m1-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';
const QUESTION = 'What is this project connected to, is it healthy, and why was that request refused?';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

test('EPIC-039 M1 — the Integrations screen answers what the project is connected to, whether it is healthy, and why a request was refused', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects|home/i }).first()).toBeVisible();
  say('Signed in (credential withheld).');

  // 2. Setup through the API: a project, fixture-ci listed and configured unhealthy.
  const project = await page.request.post(`${API}/v1/projects`, { data: { name: `EPIC-039 M1 ${Date.now()}`, rootPath: `epic-039-m1-${Date.now()}` } });
  expect(project.status()).toBe(201);
  const projectId = ((await project.json()) as { id: string }).id;
  const registered = await page.request.post(`${API}/v1/integrations/registry`, { data: { key: 'fixture-ci' } });
  expect([201, 409]).toContain(registered.status());
  const list = (await (await page.request.get(`${API}/v1/integrations/registry?projectId=${projectId}`)).json()) as { entries: { id: string; key: string }[] };
  const ci = list.entries.find((e) => e.key === 'fixture-ci')!;
  const configured = await page.request.put(`${API}/v1/projects/${projectId}/integrations/configuration/ReadBuildStatus`, {
    data: { adapters: [{ registryEntryId: ci.id, preference: 1, binding: { script: { health: 'unhealthy', healthReason: 'provider-unreachable' } } }] },
  });
  expect(configured.status(), await configured.text()).toBe(200);
  say(`Set up through the API: project ${projectId}; fixture-ci listed and configured for ReadBuildStatus, scripted unhealthy (provider-unreachable).`);

  // 3. A request the Hub refuses, made through the real route.
  const asked = await page.request.post(`${API}/v1/projects/${projectId}/capability-requests`, {
    data: { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: 'a'.repeat(40) } },
  });
  expect(asked.status()).toBe(200);
  const refused = (await asked.json()) as { outcome: string; refusal?: { code: string } };
  expect(refused.outcome).toBe('refused');
  say(`Requested ReadBuildStatus as room:change: **refused** (${refused.refusal?.code}).`);

  // 4. Wait for the health scheduler to check the pair (the 30 s tick).
  await expect
    .poll(
      async () => {
        const r = (await (await page.request.get(`${API}/v1/integrations/registry?projectId=${projectId}`)).json()) as { entries: { key: string; health: { applicable: boolean; value?: { state: string } } }[] };
        return r.entries.find((e) => e.key === 'fixture-ci')?.health.value?.state ?? 'none';
      },
      { timeout: 120_000, intervals: [5_000] },
    )
    .toBe('unhealthy');
  say('The health scheduler checked fixture-ci for the project: unhealthy.');

  // 5. Integrations, from the shell navigation — one action.
  await page.goto(UI);
  await page.getByRole('link', { name: 'Integrations' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Integrations' })).toBeVisible();
  say('Opened **Integrations** from the shell navigation.');

  // 6. pmi-studio first.
  const entries = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) });
  await expect(entries.first().getByRole('heading', { level: 3 })).toHaveText(/PMI Studio|pmi-studio/i);
  say('**pmi-studio** is listed first (FR-HUB-021).');

  // 7. The unhealthy adapter, with its reason in words.
  const fixture = page.getByRole('listitem', { name: 'Fixture CI integration' });
  await expect(fixture.getByLabel(/^Health: unhealthy — provider-unreachable/)).toBeVisible();
  say('Fixture CI reads **unhealthy — provider-unreachable**, in words, not colour alone (UX-0031).');

  // 8. The refused resolution, explained candidate by candidate.
  await fixture.getByRole('button', { name: 'Details for Fixture CI' }).click();
  const why = fixture.getByRole('list', { name: 'Why each candidate was not chosen' }).first();
  await expect(why).toContainText('fixture-ci');
  say(`Opened Fixture CI: the refused resolution explains each candidate — "${(await why.innerText()).replace(/\s+/g, ' ').trim()}" (UX-0032).`);

  // 9. No configuration control; configuration is through the API.
  await expect(page.getByText(/Configuration is through the API/)).toBeVisible();
  const forbidden = await page.locator('main').locator('form, textarea, input:not([type="search"]), button:not([aria-expanded])').count();
  expect(forbidden).toBe(0);
  say('No configuration control on the screen; it says configuration is through the API (FR-HUB-074).');

  // 10. 360 px.
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole('heading', { level: 1, name: 'Integrations' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  say('At **360 px** the list reads without horizontal scrolling (UX-0040).');

  // 11. SC-HUB-007 — the reviewer's question, answered from the screen alone.
  const names = await entries.getByRole('heading', { level: 3 }).allInnerTexts();
  const health = await fixture.getByLabel(/^Health:/).getAttribute('aria-label');
  say(`**SC-HUB-007** — "${QUESTION}" Answered from the screen alone: connected to ${names.join(', ')}; Fixture CI is ${health?.replace(/^Health: /, '')}; the request was refused because ${(await why.innerText()).replace(/\s+/g, ' ').trim()}.`);

  // 12. The transcript — and nothing secret in it.
  const body = [
    '# EPIC-039 — Integrations transcript (Constitution XI Tier 2)',
    '',
    `**Generated by** \`e2e/tests/epic-039-m1.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
    '',
    'Run-generated; not hand-edited. Credentials are placeholders only.',
    '',
    ...lines,
    '',
  ].join('\n');
  expect(body).not.toMatch(/pmi_ct_/);
  expect(body).not.toMatch(/pmi-canary-/);
  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(TRANSCRIPT, body, 'utf8');
});
