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
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/main';
import type { ApiClient } from '../../src/services/api';

const PROJECT = { id: 'p1', name: 'Payments', description: null, status: 'active', engineName: null };

function stubApi(): ApiClient {
  return {
    me: vi.fn(async () => ({ userId: 'u1', workspaceId: 'ws_a', email: 'a@b.test' })),
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

async function openProject(api: ApiClient): Promise<void> {
  render(<App api={api} />);
  await waitFor(() => expect(screen.getByText('Payments')).toBeTruthy());
  fireEvent.click(screen.getByText('Payments'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Back to project' }));
    await waitFor(() => expect(screen.queryByText(/r_uncovered/)).toBeNull());
  });
});
