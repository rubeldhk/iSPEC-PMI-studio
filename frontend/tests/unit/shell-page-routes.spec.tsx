/**
 * T200e — the shell reaches all five pages `DEF-010-001` found orphaned.
 *
 * Written to FAIL before the routes exist (Constitution V).
 *
 * `T863`/`T864` is the precedent and the same shape one Epic earlier:
 * `TraceabilityPage` was built, unit-tested in isolation, and reachable from
 * nowhere. This is that defect five times over — `Specification`,
 * `SpecificationList`, `Tasks`, `ReviewSession` and `StorageConnections` were
 * imported by nothing, anywhere in `src/`.
 *
 * **`T200a` and this file check different things, and both are needed.**
 * `T200a` reads the import graph statically: it catches a page no module
 * imports. This drives the real `App` and clicks: it catches a page that is
 * imported and rendered inside a view state **no control ever sets** — which
 * `T200a` says in its own header that it cannot see. A page wired into a
 * `case` nobody can reach would pass `T200a` and fail here.
 *
 * **The review session is the interesting one.** It needs a `runId`, and until
 * `T200d` there was nothing in the product that produced one. Its route runs
 * project → runs → review session, and the middle step is a page that had to
 * be built rather than merely wired.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/main';
import type { ApiClient } from '../../src/services/api';

const PROJECT = { id: 'p1', name: 'Payments', description: null, status: 'active', engineName: null };

function stubApi(): ApiClient {
  return {
    me: vi.fn(async () => ({ user: { id: 'u1', email: 'a@b.test', displayName: 'A' }, workspace: { id: 'ws_a' } })),
    listProjects: vi.fn(async () => [PROJECT]),
    getProject: vi.fn(async () => PROJECT),
    listRequirements: vi.fn(async () => []),
    listEngines: vi.fn(async () => []),
    listSpecifications: vi.fn(async () => ({ rows: [{ id: 's1', title: 'Checkout', lifecycleState: 'draft', engineName: 'e', engineVersion: '1', isOutOfDate: false }], total: 1 })),
    getSpecification: vi.fn(async () => ({ id: 's1', title: 'Checkout', lifecycleState: 'draft', sections: [] })),
    listSpecificationVersions: vi.fn(async () => []),
    listTasks: vi.fn(async () => []),
    listRuns: vi.fn(async () => [
      { id: 'run_7', projectId: 'p1', mode: 'unattended', stopRange: 'specification', state: 'awaiting_review', stoppedAtSelectedRange: true, outcomeReason: null, startedAt: '2026-08-23T09:00:00.000Z', endedAt: null },
    ]),
    getRunReview: vi.fn(async () => ({ id: 'rs1', runId: 'run_7', state: 'open', questions: [] })),
    getReviewSession: vi.fn(async () => ({ id: 'rs1', runId: 'run_7', state: 'open', questions: [] })),
    listStorageConnections: vi.fn(async () => []),
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function openProject(api: ApiClient): Promise<void> {
  render(<App api={api} />);
  await waitFor(() => expect(screen.getByText('Payments')).toBeTruthy());
  fireEvent.click(screen.getByText('Payments'));
}

/** Every one of these was a control that did not exist before `T200e`. */
const ENTRY_POINTS = [
  ['Specifications', /specifications/i],
  ['Runs', /runs/i],
  ['Storage connections', /storage/i],
] as const;

describe('T200e · the project view offers a way in to each orphaned area', () => {
  it.each(ENTRY_POINTS)('offers a control for %s', async (_label, pattern) => {
    const api = stubApi();
    await openProject(api);

    await waitFor(() => expect(screen.getByRole('button', { name: pattern })).toBeTruthy());
  });
});

describe('T200e · specifications, and what hangs off them', () => {
  it('renders the specification list when chosen', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /specifications/i }));

    await waitFor(() => expect(api.listSpecifications).toHaveBeenCalledWith('p1'));
  });

  it('opens a specification from the list', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /specifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: /checkout/i }));

    await waitFor(() => expect(api.getSpecification).toHaveBeenCalledWith('s1'));
  });

  it('reaches the tasks of the specification it opened', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /specifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: /checkout/i }));
    fireEvent.click(await screen.findByRole('button', { name: /tasks/i }));

    // The id is carried through two hops. Getting this wrong would list another
    // specification's tasks, which is the failure a shared `projectId` hides.
    await waitFor(() => expect(api.listTasks).toHaveBeenCalledWith('s1'));
  });
});

describe('T200e · storage connections', () => {
  it('renders with the workspace from the signed-in identity, not a guess', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /storage/i }));

    // `workspaceId` comes from `me()`. Before this route the shell discarded
    // the identity it had already fetched.
    await waitFor(() => expect(api.listStorageConnections).toHaveBeenCalledWith('ws_a'));
  });
});

describe('T200e · the review session, via the run list', () => {
  it('reaches the run list from the project', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /runs/i }));

    await waitFor(() => expect(api.listRuns).toHaveBeenCalledWith('p1'));
  });

  it('opens the review session for the run that was chosen', async () => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: /runs/i }));
    fireEvent.click(await screen.findByRole('button', { name: /run_7/ }));

    // The whole point of T200d: a real run id reaches the page that needs one.
    await waitFor(() => expect(api.getRunReview).toHaveBeenCalledWith('run_7'));
  });
});

describe('T200e · every route can be left again', () => {
  it.each(ENTRY_POINTS)('returns to the project from %s', async (_label, pattern) => {
    const api = stubApi();
    await openProject(api);
    fireEvent.click(await screen.findByRole('button', { name: pattern }));

    // A view with no way back is reachable exactly once per session, which is
    // its own kind of unreachable.
    fireEvent.click(await screen.findByRole('button', { name: /back to project/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: pattern })).toBeTruthy());
  });
});
