/**
 * `T1973` (EPIC-047) — the Engineering Experts screen.
 *
 * `FR-EXP-070`…`FR-EXP-076`, quickstart Q17. A view-only registry: the roster
 * with role, risk class, effective version and status; one Expert's contract,
 * versions and a comparison of any two; recent runs, and a run's delegation
 * tree **inline**. Enforced and unenforceable limits must not look alike, and
 * there are **no authoring controls** — contracts are authored through the API
 * and approved in the Decision Inbox (`FR-EXP-076`).
 *
 * Written to FAIL before the page exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ExpertsPage } from '../../../src/pages/Experts';
import type {
  ApiClient,
  ExpertContractView,
  ExpertDetail,
  ExpertSessionView,
  ExpertSummary,
} from '../../../src/services/api';

afterEach(cleanup);

const contract = (over: Partial<ExpertContractView> = {}): ExpertContractView => ({
  rolePurpose: 'Writes and runs the tests a change needs',
  models: { preferred: 'claude-opus-5-5', fallbacks: ['claude-sonnet-5-5'] },
  capabilities: ['test'],
  allowedTools: ['run-tests'],
  prohibitedActions: ['push'],
  permissions: [{ artifactType: 'specification', action: 'read' }],
  riskClass: 'medium',
  budget: { time: { value: 600000 }, tokens: { value: 200000, onUnenforceable: 'proceed' } },
  memoryPolicy: 'none',
  expectedOutputs: [{ kind: 'test-report', required: true }],
  evidenceContract: { workClass: 'implementation', contractVersion: 1 },
  delegatesTo: ['reviewer'],
  contextPolicy: { budgetTokens: 12000, budgetCost: 4, includeLiveState: false },
  workspaceRequirements: { executionType: 'headless' },
  ...over,
});

const summary: ExpertSummary = {
  id: 'ex_1', key: 'test-engineer', name: 'Test Engineer', status: 'active',
  rolePurpose: 'Writes and runs the tests a change needs', riskClass: 'medium', effectiveVersion: 1, latestVersion: 2,
};

const detail: ExpertDetail = {
  expert: { id: 'ex_1', key: 'test-engineer', name: 'Test Engineer', status: 'active' },
  versions: [
    { id: 'cv_1', version: 1, status: 'approved', contract: contract(), createdBy: 'u_1', createdAt: '2026-10-09T09:00:00.000Z' },
    { id: 'cv_2', version: 2, status: 'submitted', contract: contract({ riskClass: 'high' }), createdBy: 'u_1', createdAt: '2026-10-09T10:00:00.000Z' },
  ],
  effectiveVersion: { id: 'cv_1', version: 1, status: 'approved', contract: contract(), createdBy: 'u_1', createdAt: '2026-10-09T09:00:00.000Z' },
};

const node = (executionId: string, expertKey: string, depth: number, children: ExpertSessionView['tree']['node'][] = []) => ({
  executionId, expertKey, contractVersion: 1, depth, outcome: 'succeeded', model: 'claude-opus-5-5', children,
});

const sessionView: ExpertSessionView = {
  session: { executionId: 'exe_1', model: 'claude-sonnet-5-5', usedFallback: true, fallbackReason: 'preferred had no runner', outcome: 'succeeded', toolObservation: 'unobserved', depth: 0, startedAt: '2026-10-09T09:00:00.000Z', reviewRequired: false },
  limits: [
    { limit: 'time', value: 600000, requested: null, enforcement: 'enforced', consumed: null, consumedReason: null, reached: 'no' },
    { limit: 'tokens', value: 200000, requested: null, enforcement: 'unenforceable', consumed: null, consumedReason: 'the provider did not report tokens consumption', reached: 'no' },
  ],
  events: [{ kind: 'fallback-used', detail: {} }],
  tree: { ancestors: [], node: node('exe_1', 'test-engineer', 0, [node('exe_2', 'reviewer', 1)]) },
};

function stubApi(): ApiClient {
  return {
    listExperts: vi.fn(async () => [summary]),
    getExpert: vi.fn(async () => detail),
    compareExpertVersions: vi.fn(async () => [
      { element: 'role and purpose', changed: false, from: {}, to: {} },
      { element: 'risk class', changed: true, from: { riskClass: 'medium' }, to: { riskClass: 'high' } },
    ]),
    expertSessions: vi.fn(async () => [sessionView.session]),
    expertSession: vi.fn(async () => sessionView),
  } as unknown as ApiClient;
}

describe('T1973 · the Engineering Experts screen', () => {
  it('lists Experts with role, risk class, effective version and status', async () => {
    render(<ExpertsPage api={stubApi()} />);
    const row = await screen.findByRole('listitem', { name: /test-engineer/i });
    expect(within(row).getByText(/Writes and runs the tests/)).toBeTruthy();
    expect(within(row).getByText(/risk: medium/i)).toBeTruthy();
    expect(within(row).getByText(/approved v1/i)).toBeTruthy();
    expect(within(row).getByText(/active/i)).toBeTruthy();
  });

  it('says so when there are no Experts, and when the request fails', async () => {
    const empty = { ...stubApi(), listExperts: vi.fn(async () => []) } as unknown as ApiClient;
    render(<ExpertsPage api={empty} />);
    expect(await screen.findByText(/no engineering experts are registered/i)).toBeTruthy();
    cleanup();
    const failing = { ...stubApi(), listExperts: vi.fn(async () => { throw new Error('x'); }) } as unknown as ApiClient;
    render(<ExpertsPage api={failing} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('opens an Expert: its effective contract and every version with its status', async () => {
    render(<ExpertsPage api={stubApi()} />);
    fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
    const contractRegion = await screen.findByRole('region', { name: /effective contract/i });
    expect(within(contractRegion).getByText(/claude-opus-5-5/)).toBeTruthy();
    expect(within(contractRegion).getByText(/push/)).toBeTruthy();
    const versions = screen.getByRole('region', { name: /versions/i });
    expect(within(versions).getByText(/v1.*approved/i)).toBeTruthy();
    expect(within(versions).getByText(/v2.*submitted/i)).toBeTruthy();
  });

  it('compares two versions, marking what changed and showing what did not', async () => {
    const api = stubApi();
    render(<ExpertsPage api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /compare v1 and v2/i }));
    const diff = await screen.findByRole('region', { name: /comparison/i });
    expect(api.compareExpertVersions).toHaveBeenCalledWith('ex_1', 1, 2);
    expect(within(diff).getByText(/risk class.*changed/i)).toBeTruthy();
    expect(within(diff).getByText(/role and purpose.*unchanged/i)).toBeTruthy();
  });

  it('opens a run with its delegation tree inline, and enforced and unenforceable limits distinct', async () => {
    render(<ExpertsPage api={stubApi()} />);
    fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /open run exe_1/i }));
    const run = await screen.findByRole('region', { name: /run exe_1/i });
    const tree = within(run).getByRole('tree', { name: /delegation/i });
    expect(within(tree).getByText(/reviewer/)).toBeTruthy();
    const time = within(run).getByText(/time/i, { selector: '[data-enforcement]' });
    const tokens = within(run).getByText(/tokens/i, { selector: '[data-enforcement]' });
    expect(time.getAttribute('data-enforcement')).toBe('enforced');
    expect(tokens.getAttribute('data-enforcement')).toBe('unenforceable');
    expect(tokens.textContent).toMatch(/not enforced/i);
    expect(within(run).getByText(/tool use unobserved/i)).toBeTruthy();
    expect(within(run).getByText(/fallback/i)).toBeTruthy();
  });

  it('offers no authoring controls (FR-EXP-076)', async () => {
    render(<ExpertsPage api={stubApi()} />);
    fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
    await screen.findByRole('region', { name: /effective contract/i });
    for (const label of [/register/i, /edit/i, /submit/i, /retire/i, /new version/i, /save/i, /delete/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('lays out without tables, so it stays readable at 360px (UX-0040)', async () => {
    const { container } = render(<ExpertsPage api={stubApi()} />);
    fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
    await screen.findByRole('region', { name: /effective contract/i });
    expect(container.querySelector('table')).toBeNull();
  });
});
