/**
 * `T1268` (EPIC-038) — the Context inspection screen, written to fail first.
 *
 * `FR-CTX-070`–`FR-CTX-074`, `UX-0031`, `UX-0032`, `UX-0040`.
 *
 * - Lists the packages an execution was given, opens one, and shows its items
 *   **and its exclusions** (`FR-CTX-071`). A screen showing only items makes an
 *   empty package and a heavily filtered one look the same.
 * - Ranked material is visually distinct from recorded fact (`FR-CTX-072`): a
 *   relevance score is a judgement made at assembly, a source version is a fact.
 * - What excluded an item is visible in place (`FR-CTX-073`).
 * - Nothing is laid out as a wide table, so state, provenance and exclusions
 *   survive 360px (`FR-CTX-074`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ContextPage } from '../../../src/pages/Context';
import { ApiError, type ApiClient, type ContextInspection } from '../../../src/services/api';

afterEach(cleanup);

function inspection(over: Partial<ContextInspection> = {}): ContextInspection {
  return {
    package: {
      id: 'cp_1',
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      executionId: 'ex_1',
      objective: 'why does the booking notify twice',
      actorId: 'u_1',
      actorRole: 'engineer',
      budgetTokens: 12000,
      budgetCost: 40,
      state: 'assembled',
      refusalReason: null,
      embeddingModelId: 'model-a',
      assembledAt: '2026-10-08T09:00:00.000Z',
    },
    items: [
      {
        id: 'pi_1',
        sourceType: 'requirement',
        sourceId: 'rq_1',
        sourceVersion: 'v3',
        authoritativeStatus: 'current',
        inclusionReason: 'objective relevance 0.91 against: why does the booking notify twice',
        relevanceScore: 0.91,
        crossBoundary: false,
        drift: { kind: 'moved', currentVersion: 'v4', note: 'supplied at v3; the source is now at v4' },
      },
    ],
    exclusions: [
      {
        id: 'x_1',
        sourceType: 'requirement',
        sourceId: 'rq_2',
        reason: 'permission',
        detail: 'u_1 (engineer) may not read requirement rq_2',
        wasEssential: false,
      },
    ],
    execution: {
      executionId: 'ex_1',
      registered: true,
      consequential: 'undetermined',
      reason: 'EPIC-037 records no consequentiality',
    },
    ...over,
  };
}

function stubApi(found: ContextInspection[] | Error): ApiClient {
  return {
    contextPackagesForExecution: vi.fn(async () => {
      if (found instanceof Error) throw found;
      return found;
    }),
  } as unknown as ApiClient;
}

async function openExecution(api: ApiClient): Promise<void> {
  render(<ContextPage api={api} />);
  fireEvent.change(screen.getByLabelText(/execution/i), { target: { value: 'ex_1' } });
  fireEvent.click(screen.getByRole('button', { name: /show context/i }));
  await screen.findByRole('heading', { name: /packages for ex_1/i });
}

describe('T1268 · the Context screen', () => {
  it('asks for an execution first — there is no workspace-wide listing', () => {
    render(<ContextPage api={stubApi([])} />);
    expect(screen.getByLabelText(/execution/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /packages for/i })).toBeNull();
  });

  it('lists the packages an execution was given, by objective and state', async () => {
    await openExecution(stubApi([inspection()]));
    const list = screen.getByRole('list', { name: /packages/i });
    expect(within(list).getByRole('button', { name: /why does the booking notify twice/i })).toBeTruthy();
    expect(within(list).getByText(/assembled/i)).toBeTruthy();
  });

  it('says so when an execution was given no package', async () => {
    await openExecution(stubApi([]));
    expect(screen.getByText(/no context package was recorded/i)).toBeTruthy();
  });

  it('opens a package and shows its items AND its exclusions (FR-CTX-071)', async () => {
    await openExecution(stubApi([inspection()]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    const items = screen.getByRole('list', { name: /included/i });
    expect(within(items).getByText(/rq_1/)).toBeTruthy();
    const exclusions = screen.getByRole('list', { name: /excluded/i });
    expect(within(exclusions).getByText('requirement rq_2')).toBeTruthy();
  });

  it('shows what excluded an item in place, reason and detail (FR-CTX-073)', async () => {
    await openExecution(stubApi([inspection()]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    const exclusions = screen.getByRole('list', { name: /excluded/i });
    expect(within(exclusions).getByText(/permission/i)).toBeTruthy();
    expect(within(exclusions).getByText(/may not read requirement rq_2/)).toBeTruthy();
  });

  it('marks ranked material distinctly from recorded fact (FR-CTX-072)', async () => {
    await openExecution(stubApi([inspection()]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    const ranked = screen.getByText(/ranked/i, { selector: '[data-kind="ranked"] *, [data-kind="ranked"]' });
    const recorded = screen.getByText(/v3/, { selector: '[data-kind="recorded"] *, [data-kind="recorded"]' });
    expect(ranked.closest('[data-kind]')?.getAttribute('data-kind')).toBe('ranked');
    expect(recorded.closest('[data-kind]')?.getAttribute('data-kind')).toBe('recorded');
  });

  it('states drift beside the retained item, without replacing it', async () => {
    await openExecution(stubApi([inspection()]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText(/supplied at v3; the source is now at v4/)).toBeTruthy();
  });

  it('shows a refused package with its reason (FR-CTX-065)', async () => {
    const refused = inspection({
      package: {
        ...inspection().package,
        state: 'refused',
        refusalReason: 'an essential source was excluded: requirement rq_2 (permission)',
      },
      items: [],
    });
    await openExecution(stubApi([refused]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText(/an essential source was excluded/)).toBeTruthy();
  });

  it('shows the error state when the read fails, rather than an empty list', async () => {
    render(<ContextPage api={stubApi(new ApiError('unavailable', 'Context is unavailable', 503))} />);
    fireEvent.change(screen.getByLabelText(/execution/i), { target: { value: 'ex_1' } });
    fireEvent.click(screen.getByRole('button', { name: /show context/i }));
    expect(await screen.findByText(/context is unavailable/i)).toBeTruthy();
  });

  it('states a short read, and live state that could not be read (R-038-3, FR-CTX-022)', async () => {
    const short = inspection({
      package: {
        ...inspection().package,
        retrievalRequested: 40,
        retrievalReturned: 31,
        liveState: 'unavailable',
        liveStateReason: 'no LiveStateReader is bound',
      },
    });
    await openExecution(stubApi([short]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText(/returned 31 of 40/)).toBeTruthy();
    expect(screen.getByText(/live state unavailable — no LiveStateReader is bound/i)).toBeTruthy();
  });

  it('shows live state as read, each with its read instant (FR-CTX-021)', async () => {
    const withLive = inspection({
      package: { ...inspection().package, liveState: 'read' },
      liveState: [{ id: 'l1', kind: 'build', ref: 'build#812', state: 'failing', readAt: '2026-10-08T09:15:00.000Z' }],
    });
    await openExecution(stubApi([withLive]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    const list = screen.getByRole('list', { name: /live state/i });
    expect(list.textContent).toMatch(/build#812: failing/);
    expect(list.textContent).toMatch(/2026-10-08T09:15:00.000Z/);
  });

  it('says when nothing consumed the package — the execution never ran (T1816)', async () => {
    const waiting = inspection({
      execution: {
        executionId: 'ex_1',
        registered: true,
        consequential: 'undetermined',
        ran: false,
        consumption: 'the execution is registered and has not run, so nothing consumed this package',
      },
    });
    await openExecution(stubApi([waiting]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText('not run')).toBeTruthy();
    expect(screen.getByText(/nothing consumed this package/)).toBeTruthy();
  });

  it('states that a package is bounded, and shows the cost budget (T1833, FR-CTX-035)', async () => {
    const bounded = inspection({ bounded: true });
    await openExecution(stubApi([bounded]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText('bounded')).toBeTruthy();
    expect(screen.getByText(/budget excluded material/)).toBeTruthy();
    expect(screen.getByText(/a cost of 40/)).toBeTruthy();
  });

  it('a refusal made before ranking says so instead of naming a model (T1820)', async () => {
    const early = inspection({
      package: { ...inspection().package, state: 'refused', refusalReason: 'no embedding provider is bound', embeddingModelId: null },
      items: [],
      exclusions: [],
    });
    await openExecution(stubApi([early]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText(/refused before anything was ranked/)).toBeTruthy();
  });

  it('opens a package by id — a refusal made without an execution is still inspectable (T1834)', async () => {
    const refused = inspection({
      package: { ...inspection().package, id: 'cp_refused', executionId: null, state: 'refused', refusalReason: 'no embedding provider is bound' },
      items: [],
      exclusions: [],
    });
    const api = {
      contextPackagesForExecution: vi.fn(async () => []),
      contextPackage: vi.fn(async () => refused),
    } as unknown as ApiClient;
    render(<ContextPage api={api} />);
    fireEvent.change(screen.getByLabelText(/package id/i), { target: { value: 'cp_refused' } });
    fireEvent.click(screen.getByRole('button', { name: /open package/i }));
    expect(await screen.findByText(/no embedding provider is bound/)).toBeTruthy();
    expect(api.contextPackage).toHaveBeenCalledWith('cp_refused');
  });

  it('labels a crossing between projects as a project crossing, not a workspace one (T1860)', async () => {
    const projectCrossing = inspection({
      items: [
        {
          ...inspection().items[0]!,
          crossBoundary: true,
          authorisationRef: 'rka_p',
          sourceWorkspaceId: 'ws_1',
        },
      ],
    });
    await openExecution(stubApi([projectCrossing]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText('crossed a project boundary')).toBeTruthy();
    expect(screen.queryByText('crossed a workspace boundary')).toBeNull();
  });

  it('shows the classification each item was admitted under (T1863)', async () => {
    const classified = inspection({ items: [{ ...inspection().items[0]!, securityClassification: 'confidential' }] });
    await openExecution(stubApi([classified]));
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(screen.getByText(/classified confidential/)).toBeTruthy();
  });

  it('two packages open at once have distinct element ids (T1860)', async () => {
    const pkg = inspection();
    const api = {
      contextPackagesForExecution: vi.fn(async () => [pkg]),
      contextPackage: vi.fn(async () => pkg),
    } as unknown as ApiClient;
    const { container } = render(<ContextPage api={api} />);
    fireEvent.change(screen.getByLabelText(/package id/i), { target: { value: 'cp_1' } });
    fireEvent.click(screen.getByRole('button', { name: /open package/i }));
    await screen.findAllByText(/why does the booking notify twice/);
    fireEvent.change(screen.getByLabelText(/^execution$/i), { target: { value: 'ex_1' } });
    fireEvent.click(screen.getByRole('button', { name: /show context/i }));
    await screen.findByRole('heading', { name: /packages for ex_1/i });
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses no table, so nothing scrolls sideways at 360px (FR-CTX-074)', async () => {
    const { container } = render(<ContextPage api={stubApi([inspection()])} />);
    fireEvent.change(screen.getByLabelText(/execution/i), { target: { value: 'ex_1' } });
    fireEvent.click(screen.getByRole('button', { name: /show context/i }));
    await screen.findByRole('heading', { name: /packages for ex_1/i });
    fireEvent.click(screen.getByRole('button', { name: /why does the booking notify twice/i }));
    expect(container.querySelector('table')).toBeNull();
  });
});
