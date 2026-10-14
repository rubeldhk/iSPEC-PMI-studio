/**
 * `T2415` (EPIC-048, Constitution XI **Tier 2**, quickstart Q6, Q15, Q19, Q28,
 * Q29, `SC-LRN-007`) — the Governed Learning journey against the running
 * application, writing its own transcript.
 *
 * An agent's candidate (five evidence items) waits in the **Decision Inbox**,
 * reached through primary navigation; the reviewer opens it and approves it, and
 * that decision is **timed** from opening the entry to the decision recorded
 * (`SC-LRN-007`: under two minutes). A superseding candidate is then decided at
 * **360px**: current and proposed side by side, the scope narrowed to one
 * project, approved as version 2. Finally **Context → Knowledge**, again through
 * primary navigation: filtered to `superseded`, the entry's history read in
 * order.
 *
 * Writes `docs/uat/EPIC-048-transcript.md` naming the stack; nothing in it is
 * hand-edited; the credential appears only as a placeholder.
 * `backend/tests/architecture/learning-transcript.spec.ts` checks it.
 *
 * **Until this file has been RUN and PASSED against a stack, the journey is
 * "authored, not yet run"** — never report Tier 2 as satisfied on the strength
 * of this file existing (`EPIC-044` `T1607`'s rule).
 *
 * Prerequisites: the reference-local stack (README §Setup) and `E2E_EMAIL` /
 * `E2E_PASSWORD` for a seeded user who may decide in their workspace.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext } from '@playwright/test';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-048-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';
const CONTRACT_VERSION = process.env['E2E_CONTRACT_VERSION'] ?? '1';
const DIGEST = 'a'.repeat(64);

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

async function created(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string): Promise<Record<string, unknown>> {
  expect(res.status(), `${what}: ${await res.text()}`).toBeLessThan(300);
  return (await res.json()) as Record<string, unknown>;
}

test('EPIC-048 — a candidate decided in the Decision Inbox, a supersession at 360px, and the history in Context → Knowledge', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects|home/i }).first()).toBeVisible();
  const me = (await (await page.request.get(`${API}/v1/auth/me`)).json()) as { workspace: { id: string } };
  const ws = me.workspace.id;
  say('Signed in.');

  // 2. The workspace's configuration, through each owner's own route (quickstart prerequisites).
  const stamp = Date.now().toString(36);
  const project = await created(await page.request.post(`${API}/v1/projects`, { data: { name: `Learning ${stamp}`, rootPath: `learning-${stamp}` } }), 'project');
  const projectId = String(project['id']);
  const token = String((project['connectorCredential'] as { value: string }).value);
  const second = await created(await page.request.post(`${API}/v1/projects`, { data: { name: `Learning two ${stamp}`, rootPath: `learning-two-${stamp}` } }), 'second project');
  const policy = await page.request.post(`${API}/v1/steering`, {
    data: {
      subject: 'learning_policy',
      scopeType: 'workspace',
      scopeRef: ws,
      content: JSON.stringify({
        categories: [
          { key: 'test-setup', description: 'How tests are run', lowRisk: true, defaultClassification: 'internal' },
          { key: 'architecture', description: 'Structural decisions', lowRisk: false, defaultClassification: 'internal' },
        ],
        reuse: { workspaceScopeAllowed: true, namedSetsAllowed: true, permittedClassifications: { default: ['internal'] } },
        gracePeriodHours: 24,
        reviewWindowDays: 30,
        maxCandidatesPerExecution: 20,
      }),
    },
  });
  expect([201, 409]).toContain(policy.status());
  await created(
    await page.request.post(`${API}/v1/decision-policies`, {
      data: {
        bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
        selfApprovalAllowed: [],
        automatedActions: [{ actionPattern: 'learning.*', ruleId: 'learning.candidate-submitted' }],
      },
    }),
    'tenant policy',
  );
  say('Configured: a learning policy (EPIC-019 steering) and a tenant policy letting the learning intake request decisions (EPIC-031).');

  // 3. An agent's execution, five evidence items, and its candidate — through the connector route.
  const agent = { Authorization: `Bearer ${token}`, 'x-contract-version': CONTRACT_VERSION };
  const registered = await created(
    await page.request.post(`${API}/v1/executions`, {
      headers: { ...agent, 'Idempotency-Key': `reg-${stamp}` },
      data: { command: 'specify', argsSanitized: { feature: stamp }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: `c-${stamp}`, idempotencyKey: `reg-${stamp}`, contractVersion: CONTRACT_VERSION },
    }),
    'execution',
  );
  const executionId = String(registered['executionId']);
  const evidence: { evidenceId: string; digest: { sha256: string } }[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const item = await created(
      await page.request.post(`${API}/v1/evidence`, {
        data: {
          attestation: { _type: 'https://in-toto.io/Statement/v1', subject: [{ name: `run-${i}.log`, digest: { sha256: DIGEST } }], predicateType: 'https://pmi.studio/attestation/test-result/v1', predicate: { result: 'FAILED' } },
          attestedArtifact: { id: projectId, version: 1 },
          attachedTo: { type: 'artifact', id: `${projectId}:run-${i}.log` },
          producedAt: new Date().toISOString(),
          source: { uri: 'pmi:qa-suite' },
          projectId,
        },
      }),
      `evidence ${i}`,
    );
    evidence.push({ evidenceId: String(item['id']), digest: { sha256: DIGEST } });
  }
  const statement = `Integration tests need the local database started first (${stamp}).`;
  const subject = `database before integration tests ${stamp}`;
  const submitted = await created(
    await page.request.post(`${API}/v1/projects/${projectId}/learning/candidates`, {
      headers: agent,
      data: { schemaVersion: 1, executionId, kind: 'new', statement, category: 'architecture', subject, evidence, confidence: { level: 'medium', basis: 'Five failing runs without it.' }, claimedScope: { kind: 'project', projectIds: [projectId] }, idempotencyKey: `cand-${stamp}`, correlationId: `c-${stamp}` },
    }),
    'candidate',
  );
  expect(submitted['state']).toBe('pending-review');
  say('An agent submitted a candidate citing five evidence items through the connector route: **pending-review** (Q6).');

  // 4. The Decision Inbox, through primary navigation; one decision, timed (SC-LRN-007).
  await page.goto(UI);
  await page.getByRole('link', { name: 'Decision Inbox' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Decision Inbox' })).toBeVisible();
  say('Reached the Decision Inbox through primary navigation.');
  const started = Date.now();
  const first = page.locator('article.lrn-view', { hasText: statement });
  await expect(first).toBeVisible();
  await expect(first.getByRole('region', { name: 'Evidence' })).toBeVisible();
  await first.getByRole('button', { name: 'Approve' }).click();
  await expect(first.getByRole('status')).toContainText('Approved as version 1');
  const took = Date.now() - started;
  expect(took).toBeLessThan(120_000);
  say(`Opened the entry (five evidence items shown) and approved it: decided in ${took} ms (SC-LRN-007, under 120000 ms).`);

  // 5. A supersession, at 360px: side by side, narrowed, approved as v2 (Q15, Q19, Q28).
  const shown = (await (await page.request.get(`${API}/v1/learning/knowledge?projectId=${projectId}`)).json()) as { items: { entryId: string; versionId: string }[] };
  const v1 = shown.items[0]!;
  const replacement = `Start the database, migrate, then test (${stamp}).`;
  const superseding = await created(
    await page.request.post(`${API}/v1/projects/${projectId}/learning/candidates`, {
      headers: agent,
      data: { schemaVersion: 1, executionId, kind: 'supersede', targetVersionId: v1.versionId, statement: replacement, category: 'architecture', subject, evidence, confidence: { level: 'high', basis: 'The migration step was missing.' }, claimedScope: { kind: 'projects', projectIds: [projectId, String(second['id'])] }, idempotencyKey: `sup-${stamp}`, correlationId: `c-${stamp}` },
    }),
    'superseding candidate',
  );
  expect(superseding['state']).toBe('pending-review');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const next = page.locator('article.lrn-view', { hasText: replacement });
  await expect(next.getByRole('figure', { name: /Approved knowledge — v1/ })).toBeVisible();
  await expect(next.getByText(statement)).toBeVisible();
  say('At 360px, the superseding candidate shows the current statement and the proposed one side by side (FR-LRN-072, FR-LRN-075).');
  await next.getByLabel('Approved scope').selectOption({ label: `Only project ${projectId}` });
  await next.getByRole('button', { name: 'Approve' }).click();
  await expect(next.getByRole('status')).toContainText('Approved as version 2');
  say('Narrowed the scope to one project and approved it: version 2; version 1 is now superseded (Q15, Q19).');

  // 6. Context → Knowledge, through primary navigation: superseded, then the history (Q29).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(UI);
  await page.getByRole('link', { name: 'Context' }).click();
  await page.getByRole('link', { name: 'Browse approved knowledge' }).click();
  say('Reached Context → Knowledge through primary navigation.');
  await page.getByLabel('Status').selectOption('superseded');
  await expect(page.getByText(`superseded by`).first()).toBeVisible();
  say('Filtered to superseded: version 1 names its successor.');
  await page.getByRole('button', { name: `History of ${v1.entryId}` }).click();
  const history = page.getByRole('region', { name: `History of entry ${v1.entryId}` });
  await expect(history).toBeVisible();
  await expect(history).toContainText(statement);
  await expect(history).toContainText(replacement);
  say('Opened the history: version 1 then version 2, each with its candidate and decision, in order (FR-LRN-035, FR-LRN-073).');

  // 7. The transcript.
  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-048 — Governed Learning transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-048-learning.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld.',
      '',
      ...lines,
      '',
    ].join('\n'),
    'utf8',
  );
});
