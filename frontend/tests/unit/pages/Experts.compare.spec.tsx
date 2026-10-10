/**
 * `T2010` (EPIC-047) — comparing and reading any contract version.
 *
 * `FR-EXP-072`, US6/AC2, `FR-EXP-071`. A reviewer compares **any** two
 * versions, not only adjacent ones; every one of `BR-0102`'s twelve elements
 * is shown, including the context policy and workspace requirements; and any
 * version's contract can be read — including when none is approved, which is
 * exactly when a reviewer most needs to see what is being proposed.
 *
 * Written to FAIL before the page changes (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ExpertsPage } from '../../../src/pages/Experts';
import type { ApiClient, ExpertContractView, ExpertDetail, ExpertSummary, ExpertVersionView } from '../../../src/services/api';

afterEach(cleanup);

const contract = (over: Partial<ExpertContractView> = {}): ExpertContractView => ({
  rolePurpose: 'Writes and runs the tests a change needs',
  models: { preferred: 'claude-opus-5-5', fallbacks: [] },
  capabilities: ['test'],
  allowedTools: ['run-tests'],
  prohibitedActions: ['push'],
  permissions: [{ artifactType: 'specification', action: 'read' }],
  riskClass: 'medium',
  budget: { time: { value: 600000 } },
  memoryPolicy: 'none',
  expectedOutputs: [{ kind: 'test-report', required: true }],
  evidenceContract: { workClass: 'implementation', contractVersion: 1 },
  delegatesTo: [],
  contextPolicy: { budgetTokens: 12000, budgetCost: 4, includeLiveState: true },
  workspaceRequirements: { executionType: 'headless', repositoryAccess: ['read', 'commit'], supportsUnattended: true },
  ...over,
});

const v = (version: number, status: ExpertVersionView['status'], over: Partial<ExpertContractView> = {}): ExpertVersionView => ({
  id: `cv_${version}`, version, status, contract: contract(over), createdBy: 'u_1', createdAt: `2026-10-09T0${version}:00:00.000Z`,
});

const summary: ExpertSummary = {
  id: 'ex_1', key: 'test-engineer', name: 'Test Engineer', status: 'active',
  rolePurpose: 'Writes and runs the tests a change needs', riskClass: 'medium', effectiveVersion: null, latestVersion: 3,
};

function stubApi(detail: ExpertDetail): ApiClient {
  return {
    listExperts: vi.fn(async () => [summary]),
    getExpert: vi.fn(async () => detail),
    compareExpertVersions: vi.fn(async () => [{ element: 'risk class', changed: true, from: { riskClass: 'medium' }, to: { riskClass: 'high' } }]),
    expertSessions: vi.fn(async () => []),
    expertSession: vi.fn(),
  } as unknown as ApiClient;
}

const threeVersions = (approved: boolean): ExpertDetail => {
  const versions = [v(1, approved ? 'approved' : 'refused'), v(2, 'refused', { riskClass: 'low' }), v(3, 'submitted', { riskClass: 'high' })];
  return {
    expert: { id: 'ex_1', key: 'test-engineer', name: 'Test Engineer', status: 'active' },
    versions,
    effectiveVersion: approved ? versions[0]! : null,
  };
};

async function open(api: ApiClient): Promise<void> {
  render(<ExpertsPage api={api} />);
  fireEvent.click(await screen.findByRole('button', { name: /open test-engineer/i }));
  await screen.findByRole('region', { name: /versions/i });
}

describe('T2010 · comparing and reading versions', () => {
  it('compares any two versions, not only adjacent ones', async () => {
    const api = stubApi(threeVersions(true));
    await open(api);
    fireEvent.change(screen.getByRole('combobox', { name: /compare from/i }), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /compare to/i }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /compare v1 and v3/i }));
    await screen.findByRole('region', { name: /comparison of v1 and v3/i });
    expect(api.compareExpertVersions).toHaveBeenCalledWith('ex_1', 1, 3);
  });

  it('does not offer to compare a version with itself', async () => {
    await open(stubApi(threeVersions(true)));
    fireEvent.change(screen.getByRole('combobox', { name: /compare from/i }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: /compare to/i }), { target: { value: '2' } });
    expect((screen.getByRole('button', { name: /compare v2 and v2/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows every one of the twelve elements, including context policy and workspace requirements', async () => {
    await open(stubApi(threeVersions(true)));
    const region = screen.getByRole('region', { name: /effective contract/i });
    for (const element of [
      /role and purpose/i, /models/i, /capabilities and tools/i, /context policy/i, /workspace requirements/i,
      /permissions/i, /prohibited actions/i, /risk class/i, /budget/i, /memory policy/i, /expected outputs/i, /evidence contract/i,
    ]) {
      expect(within(region).getAllByText(element, { selector: 'dt' }).length).toBeGreaterThan(0);
    }
    expect(within(region).getByText(/12000 tokens/)).toBeTruthy();
    expect(within(region).getByText(/live state included/i)).toBeTruthy();
    expect(within(region).getByText(/headless/)).toBeTruthy();
    expect(within(region).getByText(/read, commit/)).toBeTruthy();
  });

  it('reads any version’s contract, including when none is approved', async () => {
    await open(stubApi(threeVersions(false)));
    expect(screen.getByText(/no version is approved/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /view v3 contract/i }));
    const shown = await screen.findByRole('region', { name: /contract v3/i });
    expect(within(shown).getByText(/^high$/)).toBeTruthy();
    expect(within(shown).getByText(/submitted/i)).toBeTruthy();
  });
});
