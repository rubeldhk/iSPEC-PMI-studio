/**
 * `T2020` (EPIC-047) — the memory policy is shown with what it means.
 *
 * `FR-EXP-020` (amended by `A-047-1`), `FR-EXP-072`. A reviewer reading a
 * contract must see, in words, that `governed-knowledge` sends learning to
 * Governed Learning and brings knowledge back only through context, and grants
 * no private memory — and that `none` retains nothing beyond the session.
 *
 * Written to FAIL before the page changes (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ExpertsPage } from '../../../src/pages/Experts';
import type { ApiClient, ExpertContractView, ExpertDetail, ExpertSummary } from '../../../src/services/api';

afterEach(cleanup);

const contract = (memoryPolicy: ExpertContractView['memoryPolicy']): ExpertContractView => ({
  rolePurpose: 'Writes and runs the tests a change needs',
  models: { preferred: 'claude-opus-5-5', fallbacks: [] },
  capabilities: ['test'],
  allowedTools: ['run-tests'],
  prohibitedActions: [],
  permissions: [],
  riskClass: 'medium',
  budget: { time: { value: 600000 } },
  memoryPolicy,
  expectedOutputs: [],
  evidenceContract: { workClass: 'implementation', contractVersion: 1 },
  delegatesTo: [],
  contextPolicy: { budgetTokens: 12000, budgetCost: 4, includeLiveState: false },
  workspaceRequirements: {},
});

const summary: ExpertSummary = {
  id: 'ex_1', key: 'learner', name: 'Learner', status: 'active',
  rolePurpose: 'Writes and runs the tests a change needs', riskClass: 'medium', effectiveVersion: 1, latestVersion: 1,
};

function apiWith(memoryPolicy: ExpertContractView['memoryPolicy']): ApiClient {
  const version = { id: 'cv_1', version: 1, status: 'approved' as const, contract: contract(memoryPolicy), createdBy: 'u_1', createdAt: '2026-10-09T09:00:00.000Z' };
  const detail: ExpertDetail = { expert: { id: 'ex_1', key: 'learner', name: 'Learner', status: 'active' }, versions: [version], effectiveVersion: version };
  return {
    listExperts: vi.fn(async () => [summary]),
    getExpert: vi.fn(async () => detail),
    compareExpertVersions: vi.fn(async () => []),
    expertSessions: vi.fn(async () => []),
    expertSession: vi.fn(),
  } as unknown as ApiClient;
}

async function effectiveContract(api: ApiClient): Promise<HTMLElement> {
  render(<ExpertsPage api={api} />);
  fireEvent.click(await screen.findByRole('button', { name: /open learner/i }));
  return screen.findByRole('region', { name: /effective contract/i });
}

describe('T2020 · the memory policy in words', () => {
  it('governed-knowledge says where learning goes, where knowledge comes from, and that nothing is private', async () => {
    const region = await effectiveContract(apiWith('governed-knowledge'));
    const policy = within(region).getByText(/governed-knowledge/);
    expect(policy.textContent).toMatch(/Governed Learning/);
    expect(policy.textContent).toMatch(/only through context/i);
    expect(policy.textContent).toMatch(/no private memory/i);
  });

  it('none says the session retains nothing beyond itself', async () => {
    const region = await effectiveContract(apiWith('none'));
    expect(within(region).getByText(/^none —/).textContent).toMatch(/retains nothing beyond the session/i);
  });
});
