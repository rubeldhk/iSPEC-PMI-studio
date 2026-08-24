/**
 * T863 — the web shell can reach the traceability view (F4, **US7**).
 *
 * Written to FAIL before T864 exists (Constitution V).
 *
 * Found by `/speckit-converge EPIC-011`. `TraceabilityPage` was built and
 * `T133a` tested it in isolation; `main.tsx`'s `View` union was
 * `loading | sign-in | projects | project`, with no route to it. Every US7
 * scenario opens with "the user views…", so the Epic's entire user story was
 * unreachable from the product — built, tested, and invisible, the same shape
 * `T462`, `T651` and `DEF-001-005` all had.
 *
 * ---
 *
 * **Rewritten by EPIC-036 `T437f`, and kept.** The `View` union is gone and the
 * shell is a router, so the mechanics below changed: a `MemoryRouter` supplies
 * the address, and the project is opened through it. **Every assertion is the
 * one it was.**
 *
 * The control it clicks survived `T437g`, which removed `T200e`'s three
 * buttons. Traceability is not one of PMI-DOC-006 §4.1's eighteen areas —
 * `contracts/shell-contract.md` records it as *"within Projects"* — so it has
 * no navigation entry to inherit, and deleting the link would put US7 back
 * exactly where convergence found it.
 *
 * The `me` stub is the **real `WhoAmI` shape**, typed so the compiler checks
 * it. It was `{ userId, workspaceId, email }` — a shape the API never returns,
 * laundered through `as unknown as`. `DEF-029-006` is that exact fault: a stub
 * of the wrong shape makes the component throw mid-render while the test goes
 * on passing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../../src/main';
import type { ApiClient, WhoAmI } from '../../src/services/api';

const PROJECT = { id: 'p1', name: 'Payments', description: null, status: 'active', engineName: null };

function stubApi(): ApiClient {
  return {
    me: vi.fn(
      async (): Promise<WhoAmI> => ({
        user: { id: 'u1', email: 'a@b.test', displayName: 'A' },
        workspace: { id: 'ws_a' },
      }),
    ),
    listProjects: vi.fn(async () => [PROJECT]),
    getProject: vi.fn(async () => PROJECT),
    listRequirements: vi.fn(async () => []),
    listEngines: vi.fn(async () => []),
    getRequirementTrace: vi.fn(async () => ({ requirementId: 'r1', specifications: [] })),
    getTaskTrace: vi.fn(async () => ({ taskId: 't1', specifications: [] })),
    getProjectCoverage: vi.fn(async () => ({
      uncoveredRequirementIds: ['r_uncovered'],
      specificationsWithoutTasks: [],
      requirementCount: 1,
      specificationCount: 0,
    })),
  } as unknown as ApiClient;
}

afterEach(cleanup);

/** Sign in, reach Projects, and open one — through the real route tree. */
async function openProject(api: ApiClient): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <App api={api} />
    </MemoryRouter>,
  );
  // Inside `<main>` on purpose: the project's name now appears twice — once in
  // the list, and once as the selected option in the shell's project selector
  // (`FR-SHL-020`). Clicking the option would do nothing at all, and the test
  // would fail several assertions later with no clue why.
  const main = await screen.findByRole('main');
  await waitFor(() => expect(within(main).getByText('Payments')).toBeTruthy());
  fireEvent.click(within(main).getByText('Payments'));
}

describe('the shell routes to traceability (US7)', () => {
  it('offers a way in from the project view', async () => {
    const api = stubApi();
    await openProject(api);
    // Before T864 there was no control at all — the page existed and nothing
    // could reach it.
    await waitFor(() => expect(screen.getByRole('button', { name: /traceability/i })).toBeTruthy());
  });

  it('renders the traceability view when it is chosen', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /traceability/i }));

    // The page loads project coverage on mount (US7 scenario 3).
    await waitFor(() => expect(api.getProjectCoverage).toHaveBeenCalledWith('p1'));
  });

  it('shows an uncovered requirement in the coverage view (SC-010, US7/AC3)', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /traceability/i }));

    await waitFor(() => expect(screen.getByText(/r_uncovered/)).toBeTruthy());
  });

  it('carries the project through, so coverage is scoped to what the user opened', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /traceability/i }));

    await waitFor(() => expect(api.getProjectCoverage).toHaveBeenCalledWith('p1'));
    expect(api.getProjectCoverage).not.toHaveBeenCalledWith(undefined);
  });

  it('can go back to the project it came from', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /traceability/i }));
    await waitFor(() => expect(api.getProjectCoverage).toHaveBeenCalled());

    // The way back is now the product's own navigation rather than a button
    // this view had to carry — which is `BR-0190` doing the job `T200e`'s
    // per-page "Back to project" controls were standing in for.
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await waitFor(() => expect(screen.queryByText(/r_uncovered/)).toBeNull());
  });
});
