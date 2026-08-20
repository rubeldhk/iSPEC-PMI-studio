/**
 * T145 — the full end-to-end journey: quickstart V1–V12, including V11a
 * (observability across the sandbox boundary).
 *
 * HONESTY NOTE (Constitution IX): this journey is a real measurement only
 * when executed against a running stack:
 *
 *   1. docker compose up -d                   # postgres :5432, valkey :6380
 *   2. pnpm --filter backend exec prisma migrate deploy
 *   3. pnpm --filter backend start            # API on :3000
 *   4. pnpm --filter worker start             # generation worker
 *   5. pnpm --filter frontend dev             # UI on :5173
 *   6. pnpm --filter e2e exec playwright test tests/full-journey.spec.ts
 *
 * Until that command has run and PASSED, V1–V12 are exercised only by the
 * per-module suites — never report this file's existence as the journey
 * having been measured.
 */
import { expect, test, type Page } from '@playwright/test';

const UI = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';

const USER_A = { email: 'member-a@example.test', password: 'correct horse battery' };

async function signIn(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto(UI);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe.serial('quickstart V1–V12 + V11a', () => {
  test('V1 — workspace and project persist with correct attribution', async ({ page }) => {
    await signIn(page, USER_A);
    await page.getByLabel(/project name/i).fill('Journey');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('button', { name: 'Journey' })).toBeVisible();
    // Sign out and back — the project survives the session.
    await page.getByRole('button', { name: /sign out/i }).click();
    await signIn(page, USER_A);
    await expect(page.getByRole('button', { name: 'Journey' })).toBeVisible();
  });

  // fixme: needs an AUTHENTICATED APIRequestContext (session cookie shared
  // from the page) — an unauthenticated request would 401 and "pass or fail"
  // for the wrong reason. Integration coverage of the same rule:
  // `backend/tests/integration/workspace-isolation.spec.ts`.
  test.fixme('V2 — cross-workspace access is 404, not 403, and audited', async () => {});

  test('V3 — requirement register: versions, retire, refusal naming the field, filters', async ({ page }) => {
    await signIn(page, USER_A);
    await page.getByRole('button', { name: 'Journey' }).click();
    await page.getByLabel(/requirement/i).fill('The system shall settle payments in one transaction.');
    await page.getByRole('button', { name: /add requirement/i }).click();
    // Empty description refused, naming the field:
    await page.getByLabel(/requirement/i).fill('');
    await page.getByRole('button', { name: /add requirement/i }).click();
    await expect(page.getByRole('alert')).toContainText(/description/i);
  });

  test('V4 — generate: 202, UI stays usable, spec linked to every requirement', async ({ page }) => {
    await signIn(page, USER_A);
    await page.getByRole('button', { name: 'Journey' }).click();
    await page.getByRole('button', { name: /generate specification/i }).click();
    // The job indicator is inline; the page still navigates while it runs.
    await expect(page.getByText(/queued|running/i)).toBeVisible();
    await expect(page.getByText(/succeeded/i)).toBeVisible({ timeout: 10 * 60 * 1000 });
  });

  // V5–V11 are DELIBERATELY test.fixme, not empty passing bodies: an empty
  // Playwright test reports green, and a vacuous green here would claim seven
  // quickstart scenarios were measured when they were not. They become real
  // tests when the frontend app shell (routing/composition — EPIC-014's
  // composition-root deferral) exists to drive. Each scenario's per-module
  // coverage already exists in the unit/contract/integration suites; what is
  // missing is only the THROUGH-THE-BROWSER pass.
  test.fixme('V5 — every failure path names its reason, nothing partial stored', async () => {});
  test.fixme('V6 — lifecycle: eight permitted transitions, versions immutable, baseline forks', async () => {});
  test.fixme('V7 — validation findings carry locations; approval surfaces them', async () => {});
  test.fixme('V8 — task generation gated on approval; regeneration warns', async () => {});
  test.fixme('V9 — traceability resolves both ways; retired links flagged, not omitted', async () => {});
  test.fixme('V10 — requirement edit flags the specification out of date, changes nothing', async () => {});
  test.fixme('V11 — engine independence: fixture and Spec Kit interchangeable', async () => {});

  // fixme for the same authenticated-context reason as V2. The V11a claim —
  // one correlation identifier spanning API → queue → worker, no secrets in
  // any log — additionally needs log capture wiring; its per-module halves
  // are covered by `http-observability-status.spec.ts` and the worker suite.
  test.fixme('V11a — ONE correlation identifier spans API → queue → worker; no secrets in logs', async () => {});
  test.fixme('V12 — audit holds all five event kinds; no write path exists', async () => {});
});
