/**
 * `T1578` (EPIC-044, `FR-EPB-022`–`FR-EPB-024`, `FR-EPB-041`, `FR-EPB-064`) —
 * the Epic detail: description with edit, the Epic's requirements with
 * unassign and an assign control over the project's unassigned requirements,
 * its specifications, the stage card, a link to the timeline, parent and
 * children, decisions; a closed Epic offers no assignment; four states.
 * Written to FAIL before `T1579`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EpicDetailPage } from '../../../src/pages/EpicDetail';
import { ApiError, type ApiClient, type EpicDetail, type EpicStage } from '../../../src/services/api';

const PROJECT = { id: 'p1', workspaceId: 'ws_a', name: 'Alpha', description: '', status: 'active', engineName: 'fixture', ownerUserId: 'u_owner', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' };

function detail(over: Partial<EpicDetail> = {}): EpicDetail {
  return {
    id: 'e1', projectId: 'p1', number: 1, slug: 'intake', title: 'Intake', description: 'First.', status: 'active',
    parentEpicId: null, splitSuffix: null, createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z', closedAt: null,
    requirementCount: 1, specificationCount: 1,
    requirements: [{ id: 'r1', reference: 'REQ-001', status: 'active', epicId: 'e1' }],
    specifications: [{ id: 's1', projectId: 'p1', epicId: 'e1' }],
    parent: null, children: [], decisions: { createdBy: null, lastProcessed: null },
    ...over,
  };
}

const STAGE: EpicStage = { epicId: 'e1', number: 1, slug: 'intake', title: 'Intake', status: 'active', stage: 'Specified', missing: [], last: { executionId: 'exec_1', command: 'specify', outcome: 'completed', at: '2026-09-05T10:00:00Z' }, next: '/speckit-clarify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' };
const UNASSIGNED = [{ id: 'r2', reference: 'REQ-002', status: 'active', epicId: null, workspaceId: 'ws_a', projectId: 'p1', description: 'x', type: 'functional', priority: 'p1', contentHash: 'h', retiredAt: null, createdAt: '', updatedAt: '' }];

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    getEpic: vi.fn(async () => detail()),
    getEpicStage: vi.fn(async () => STAGE),
    listRequirements: vi.fn(async () => UNASSIGNED),
    updateEpic: vi.fn(async () => detail({ title: 'Intake and triage' })),
    assignRequirementEpic: vi.fn(async () => ({ id: 'r2', epicId: 'e1' })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function page(client: ApiClient, currentUserId = 'u_owner') {
  const onOpenTimeline = vi.fn();
  render(<EpicDetailPage api={client} epicId="e1" currentUserId={currentUserId} onOpenTimeline={onOpenTimeline} />);
  await screen.findByRole('heading', { name: 'Epic 1 · Intake' });
  await waitFor(() => expect(screen.queryByText('Loading Epic')).toBeNull());
  return { onOpenTimeline };
}

describe('T1578 · the Epic detail', () => {
  it('shows the description, the requirements with unassign, the specifications, and the stage card with last and next', async () => {
    const { onOpenTimeline } = await page(api());
    expect(screen.getByText('First.')).toBeDefined();
    const requirements = screen.getByRole('table', { name: 'Requirements of this Epic' });
    expect(requirements.textContent).toContain('REQ-001');
    expect(within(requirements).getByRole('button', { name: 'Unassign REQ-001' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Specifications' }).textContent).toContain('s1');
    const stage = screen.getByRole('region', { name: 'Stage' });
    expect(stage.textContent).toContain('Specified');
    expect(stage.textContent).toContain('specify · completed');
    expect(stage.textContent).toContain('/speckit-clarify');
    expect(stage.textContent).toContain('derived from executions');
    fireEvent.click(within(stage).getByRole('button', { name: 'Open executions' }));
    expect(onOpenTimeline).toHaveBeenCalledWith('p1');
  });

  it('assigns one of the project\'s unassigned requirements and reloads', async () => {
    const client = api();
    await page(client);
    fireEvent.change(screen.getByLabelText('Assign a requirement'), { target: { value: 'r2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(client.assignRequirementEpic).toHaveBeenCalledWith('r2', 'e1'));
    await waitFor(() => expect(client.getEpic).toHaveBeenCalledTimes(2));
  });

  it('unassigns a requirement', async () => {
    const client = api();
    await page(client);
    fireEvent.click(screen.getByRole('button', { name: 'Unassign REQ-001' }));
    await waitFor(() => expect(client.assignRequirementEpic).toHaveBeenCalledWith('r1', null));
  });

  it('edits the title and description; the number never changes', async () => {
    const client = api();
    await page(client);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Intake and triage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.updateEpic).toHaveBeenCalledWith('e1', { title: 'Intake and triage', description: 'First.' }));
    expect(screen.getByRole('heading', { name: /Epic 1 ·/ })).toBeDefined();
  });

  it('a closed Epic offers no assignment and says so; a member without the grant sees disabled controls and why', async () => {
    await page(api({ getEpic: vi.fn(async () => detail({ status: 'closed', closedAt: '2026-09-05T01:00:00Z' })) }));
    expect(screen.queryByLabelText('Assign a requirement')).toBeNull();
    expect(screen.getByText(/This Epic is closed/)).toBeDefined();
    cleanup();
    await page(api(), 'u_member');
    expect(screen.getByRole('button', { name: 'Assign' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/Only the project's owner may/)).toBeDefined();
  });

  it('shows parent and children with the decision that created them', async () => {
    await page(api({ getEpic: vi.fn(async () => detail({ status: 'split', children: [detail({ id: 'e8', number: 8, title: 'Intake (a)', splitSuffix: 'a', parentEpicId: 'e1' }), detail({ id: 'e9', number: 9, title: 'Intake (b)', splitSuffix: 'b', parentEpicId: 'e1' })], decisions: { createdBy: null, lastProcessed: 'cmt_1' } })) }));
    const split = screen.getByRole('region', { name: 'Split' });
    expect(split.textContent).toContain('split into 8, 9');
    expect(split.textContent).toContain('cmt_1');
  });

  it('four states: loading, error, partial', async () => {
    render(<EpicDetailPage api={api()} epicId="e1" currentUserId="u_owner" onOpenTimeline={vi.fn()} />);
    expect(screen.getByText('Loading Epic')).toBeDefined();
    cleanup();
    render(<EpicDetailPage api={api({ getEpic: vi.fn(async () => { throw new ApiError('not_found', 'The Epic does not exist.', 404); }), getEpicStage: vi.fn(async () => { throw new ApiError('not_found', 'x', 404); }), listRequirements: vi.fn(async () => { throw new ApiError('not_found', 'x', 404); }) })} epicId="e1" currentUserId="u_owner" onOpenTimeline={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The Epic does not exist.'));
    cleanup();
    await page(api({ getEpicStage: vi.fn(async () => { throw new ApiError('internal_error', 'Stage down.', 500); }) }));
    expect(screen.getByRole('alert').textContent).toContain('Some of this screen did not load');
  });
});
