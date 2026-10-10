/**
 * `T791` (EPIC-031, `SC-DPE-004`, `FR-DPE-020`–`FR-DPE-026`, `BR-0193`) — the
 * Decision Inbox journey, Constitution XI Tier 2: a run-generated transcript
 * against the running application.
 *
 * Signed in, the reviewer reaches the Inbox in **one action** from Home, finds
 * a high-band release awaiting approval with what blocks it named, is refused
 * when they try to approve their own request, issues a policy permitting
 * self-approval for releases, approves **by keyboard alone**, and watches the
 * item leave — then reads the decision's explanation from the API, because an
 * entry that disappeared for the wrong reason would pass a screenshot and fail
 * the requirement.
 *
 * Writes `docs/uat/EPIC-031-inbox-transcript.md` naming the stack; nothing in it
 * is hand-edited; the credential appears only as a placeholder.
 * `backend/tests/architecture/decision-inbox-transcript.spec.ts` checks it.
 *
 * **Until this file has been RUN and PASSED against a stack, the journey is
 * "authored, not yet run"** — never report Tier 2 as satisfied on the strength
 * of this file existing (`EPIC-044` `T1607`'s rule).
 *
 * Prerequisites: the reference-local stack (README §Setup) and `E2E_EMAIL` /
 * `E2E_PASSWORD` for a seeded user.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRANSCRIPT = join(REPO, 'docs', 'uat', 'EPIC-031-inbox-transcript.md');
const STACK = process.env['E2E_STACK'] ?? 'reference local';

const lines: string[] = [];
const say = (line: string): void => {
  lines.push(`- ${new Date().toISOString()} ${line}`);
};

test('EPIC-031 — the Decision Inbox: one action away, names what blocks it, approved by keyboard, and the item leaves', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  say(`Stack: **${STACK}** · UI ${UI} · API ${API}`);

  // 1. Sign in.
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(process.env['E2E_EMAIL'] ?? 'dev@pmi.local');
  await page.getByLabel(/password/i).fill(process.env['E2E_PASSWORD'] ?? 'choose-something');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /projects|home/i }).first()).toBeVisible();
  say('Signed in.');

  // 2. A high-band request, made through the real Decide route.
  const target = `r-${Date.now()}`;
  const decided = await page.request.post(`${API}/v1/decisions`, {
    data: { actionType: 'release.promote', target: { type: 'release', id: target }, projectId: 'e2e-031', objectVersion: '1' },
  });
  expect(decided.status()).toBe(201);
  const decision = (await decided.json()) as { decisionId: string; outcome: string; effectiveClass: string };
  expect(decision).toMatchObject({ outcome: 'pending', effectiveClass: 'high' });
  say(`Requested release.promote on release ${target}: **${decision.outcome}**, ${decision.effectiveClass} band (FR-DPE-010).`);

  // 3. One action from Home: the navigation link.
  await page.goto(UI);
  await page.getByRole('link', { name: 'Decision Inbox' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Decision Inbox' })).toBeVisible();
  say('Reached the Decision Inbox in one action from Home (SC-DPE-004).');

  // 4. Own request: not offered for approval without a policy saying so.
  await expect(page.getByRole('button', { name: `Approve release.promote on release ${target}` })).toHaveCount(0);
  say('The requester is not offered their own request to approve (FR-DPE-015).');

  // 5. A policy permitting self-approval for releases — issued through the real route.
  const issued = await page.request.post(`${API}/v1/decision-policies`, {
    data: {
      bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
      selfApprovalAllowed: ['release.*'],
      automatedActions: [],
    },
  });
  expect(issued.status()).toBe(201);
  const policy = (await issued.json()) as { version: number };
  say(`Issued tenant policy v${policy.version} permitting self-approval for release.* (FR-DPE-011).`);

  // 6. Approve by keyboard alone.
  await page.reload();
  const approve = page.getByRole('button', { name: `Approve release.promote on release ${target}` });
  await expect(approve).toBeVisible();
  await expect(page.getByText(/awaits approval by an authorized human/).first()).toBeVisible();
  say('The entry names what blocks it: it awaits an authorized human (FR-DPE-025).');
  await approve.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText(/Approved release\.promote/);
  await expect(approve).toHaveCount(0);
  say('Approved by keyboard (Enter on the focused control); the result was announced and the item left the Inbox (BR-0193, FR-DPE-024).');

  // 7. The decision, from the API — why it left.
  const explained = await page.request.get(`${API}/v1/decisions/${decision.decisionId}/explanation`);
  expect(explained.status()).toBe(200);
  const body = (await explained.json()) as { resolvedBy: string | null; explanation: { constraintCited?: string } };
  expect(body.resolvedBy).not.toBeNull();
  say(`The pending decision is resolved by ${body.resolvedBy}; its explanation still cites "${body.explanation.constraintCited}" (FR-DPE-044).`);

  // 8. The transcript.
  mkdirSync(join(REPO, 'docs', 'uat'), { recursive: true });
  writeFileSync(
    TRANSCRIPT,
    [
      '# EPIC-031 — Decision Inbox transcript (Constitution XI Tier 2)',
      '',
      `**Generated by** \`e2e/tests/epic-031-inbox.spec.ts\` on ${new Date().toISOString()} · **Stack**: ${STACK}`,
      '',
      'Run-generated; not hand-edited. The credential value is withheld.',
      '',
      ...lines,
      '',
    ].join('\n'),
    'utf8',
  );
});
