/**
 * T439g / T439i / T439j (EPIC-036) — Home tells four states apart, and the
 * mutation that proves it.
 *
 * **This is the scenario most likely to be "fixed" wrongly.** Two of Home's
 * three sources are unbuilt. A Home that rendered one section and nothing else
 * would read as *"nothing is blocked"* — and a reviewer, seeing a clean screen,
 * would call that working.
 *
 * Empty because there is nothing, empty because it is still loading, and empty
 * because the source does not exist must look different from each other
 * (`FR-SHL-060`). `FR-SHL-062` makes rendering a failure as an empty state a
 * defect rather than a fallback, and `T439i` observes that rule failing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { homeModel, unavailable, available, failed } from '../../../src/shell/home-model';
import { PROJECT, REVIEW, RUN, renderAt, stubApi } from './harness';
import type { ApiClient } from '../../../src/services/api';

afterEach(cleanup);

async function openHomeWithProject(api: ApiClient = stubApi()): Promise<void> {
  renderAt('/', api);
  const select = await screen.findByLabelText('Project');
  // Wait for the option to exist before selecting it. A `change` naming a
  // value the select does not have is silently ignored, and the test would
  // then fail several assertions later for a reason that has nothing to do
  // with what it is testing.
  await waitFor(() =>
    expect(within(select as HTMLElement).getByRole('option', { name: PROJECT.name })).toBeTruthy(),
  );
  fireEvent.change(select, { target: { value: PROJECT.id } });
}

function section(name: RegExp): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('T439g · the four states are distinguishable', () => {
  it('says so when no project is selected, rather than rendering empty', async () => {
    renderAt('/');
    const main = await screen.findByRole('main');
    await waitFor(() => expect(within(main).getByText('No project selected')).toBeTruthy());
  });

  it('shows a loading state while the sources are being read', async () => {
    let release: (() => void) | undefined;
    const api = stubApi();
    (api.listRuns as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () =>
        new Promise((resolve) => {
          release = (): void => resolve([RUN]);
        }),
    );
    await openHomeWithProject(api);
    expect(await screen.findByText(/loading what is waiting/i)).toBeDefined();
    release?.();
  });

  it('states the partial case once, at the top', async () => {
    // Two of three sources do not exist. Saying so once is the difference
    // between a Home that admits what it cannot see and one that lets three
    // differently-shaped sections imply it.
    await openHomeWithProject();
    expect(await screen.findByText(/Showing 1 of 3 sources/)).toBeDefined();
  });

  it('renders all three sections even though only one has a source', async () => {
    await openHomeWithProject();
    await screen.findByText(/Showing 1 of 3 sources/);
    expect(section(/waiting for your approval/i)).toBeDefined();
    expect(section(/blocked by policy/i)).toBeDefined();
    expect(section(/missing evidence/i)).toBeDefined();
  });

  it('names the Epic behind each absent section, not merely "no data"', async () => {
    await openHomeWithProject();
    await screen.findByText(/Showing 1 of 3 sources/);
    expect(within(section(/blocked by policy/i)).getByText(/EPIC-031/)).toBeDefined();
    expect(within(section(/missing evidence/i)).getByText(/EPIC-032/)).toBeDefined();
  });

  it('distinguishes an absent source from a working, empty one', async () => {
    const api = stubApi({ runs: [] });
    await openHomeWithProject(api);
    await screen.findByText(/Showing 1 of 3 sources/);

    // Working and empty: says it is working and has nothing.
    expect(
      within(section(/waiting for your approval/i)).getByText(/has nothing to show/i),
    ).toBeDefined();
    // Absent: says it does not exist, and never "nothing to show".
    expect(within(section(/blocked by policy/i)).queryByText(/has nothing to show/i)).toBeNull();
    expect(within(section(/blocked by policy/i)).getByText(/Not available/)).toBeDefined();
  });

  it('renders a failed section as an error, with a way forward', async () => {
    const api = stubApi();
    (api.listRuns as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('the runs service did not answer'),
    );
    await openHomeWithProject(api);
    const approvals = await waitFor(() => section(/waiting for your approval/i));
    expect(within(approvals).getByRole('alert')).toBeDefined();
    expect(within(approvals).getByText(/did not answer/)).toBeDefined();
  });
});

describe('T439j · each item names what, where and how to act', () => {
  it('names the subject, the project and a route to the thing', async () => {
    await openHomeWithProject();
    const approvals = await waitFor(() => section(/waiting for your approval/i));
    const link = within(approvals).getByRole('link', { name: new RegExp(RUN.id) });
    expect(link.getAttribute('href')).toBe(`/runs/${RUN.id}`);
    expect(within(approvals).getByText(new RegExp(`project ${PROJECT.id}`))).toBeDefined();
  });

  it('counts only the unanswered questions', async () => {
    await openHomeWithProject();
    const approvals = await waitFor(() => section(/waiting for your approval/i));
    expect(
      within(approvals).getByText(new RegExp(`${REVIEW.questions.length} question`)),
    ).toBeDefined();
  });
});

describe('T439i · MUTATION — a failure rendered as empty must fail the suite', () => {
  it('a model that hides its failed source is detectably different', () => {
    // The mutation, performed on the model: replace a FAILED source with an
    // available-and-empty one — precisely the "fix" a well-meaning change
    // would make — and assert the difference is visible in the data the view
    // renders from. Without this, `FR-SHL-062` is a sentence in a document.
    const honest = homeModel([
      failed('pending-approval', 'the runs service did not answer'),
      unavailable('policy-block', 'EPIC-031'),
      unavailable('missing-evidence', 'EPIC-032'),
    ]);
    const mutated = homeModel([
      available('pending-approval', []),
      unavailable('policy-block', 'EPIC-031'),
      unavailable('missing-evidence', 'EPIC-032'),
    ]);

    expect(honest.items).toEqual(mutated.items);
    expect(honest.sources[0]!.state).toBe('failed');
    expect(mutated.sources[0]!.state).toBe('available');
    expect(honest.sources).not.toEqual(mutated.sources);
  });

  it('and the view renders the two differently', async () => {
    // The other half: the difference above must reach the screen. A model that
    // knew and a view that ignored it would pass the assertion above forever.
    const api = stubApi();
    (api.listRuns as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    await openHomeWithProject(api);
    const failedSection = await waitFor(() => section(/waiting for your approval/i));
    expect(within(failedSection).queryByRole('alert')).not.toBeNull();

    cleanup();

    await openHomeWithProject(stubApi({ runs: [] }));
    const emptySection = await waitFor(() => section(/waiting for your approval/i));
    expect(within(emptySection).queryByRole('alert')).toBeNull();
    expect(within(emptySection).getByText(/has nothing to show/i)).toBeDefined();
  });
});
