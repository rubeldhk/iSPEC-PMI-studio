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
    parent: null, children: [], decisions: { createdBy: null, lastProcessed: null, decidedBy: null }, findings: [],
    ...over,
  };
}

const STAGE: EpicStage = { epicId: 'e1', number: 1, slug: 'intake', title: 'Intake', status: 'active', stage: 'Specified', missing: [], unrecognised: [], last: { executionId: 'exec_1', command: 'specify', outcome: 'completed', at: '2026-09-05T10:00:00Z' }, next: '/speckit-clarify', readiness: { verdict: 'n/a', failing: [] }, running: null, derivedFrom: 'executions' };
const UNASSIGNED = [{ id: 'r2', reference: 'REQ-002', status: 'active', epicId: null, workspaceId: 'ws_a', projectId: 'p1', description: 'x', type: 'functional', priority: 'p1', contentHash: 'h', retiredAt: null, createdAt: '', updatedAt: '' }];

function api(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    getProject: vi.fn(async () => PROJECT),
    getEpic: vi.fn(async () => detail()),
    getEpicStage: vi.fn(async () => STAGE),
    listRequirements: vi.fn(async () => UNASSIGNED),
    updateEpic: vi.fn(async () => detail({ title: 'Intake and triage' })),
    assignRequirementEpic: vi.fn(async () => ({ id: 'r2', epicId: 'e1' })),
    // EPIC-045 T1653: the Files section reads this on mount. Empty by default —
    // the tests that care about its content set their own answer.
    getEpicArtifacts: vi.fn(async () => ({ epicId: 'e1', files: [], refusals: [], findings: { reportedNotSynced: [], syncedNotReported: [] } })),
    getArtifactVersion: vi.fn(async () => ({ versionId: 'v1', path: 'specs/001-intake/spec.md', kind: 'spec', digest: 'a'.repeat(64), sizeBytes: 3, content: '# Intake\n', firstSyncedAt: '2026-09-05T10:00:00Z', deliveredBy: [] })),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function page(client: ApiClient, currentUserId = 'u_owner') {
  const onOpenTimeline = vi.fn();
  const onOpenTasks = vi.fn();
  render(
    <EpicDetailPage
      api={client}
      epicId="e1"
      currentUserId={currentUserId}
      onOpenTimeline={onOpenTimeline}
      onOpenTasks={onOpenTasks}
    />,
  );
  await screen.findByRole('heading', { name: 'Epic 1 · Intake' });
  await waitFor(() => expect(screen.queryByText('Loading Epic')).toBeNull());
  return { onOpenTimeline, onOpenTasks };
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

  it('shows parent and children with the decision that created them and who decided (T1595)', async () => {
    await page(api({ getEpic: vi.fn(async () => detail({ status: 'split', children: [detail({ id: 'e8', number: 8, title: 'Intake (a)', splitSuffix: 'a', parentEpicId: 'e1' }), detail({ id: 'e9', number: 9, title: 'Intake (b)', splitSuffix: 'b', parentEpicId: 'e1' })], decisions: { createdBy: null, lastProcessed: 'cmt_1', decidedBy: 'u_owner' } })) }));
    const split = screen.getByRole('region', { name: 'Split' });
    expect(split.textContent).toContain('split into 8, 9');
    expect(split.textContent).toContain('cmt_1');
    expect(split.textContent).toContain('decided by u_owner');
  });

  it('a child names its parent and its suffix (T1595, FR-EPB-063)', async () => {
    await page(api({ getEpic: vi.fn(async () => detail({ parentEpicId: 'e7', splitSuffix: 'a', parent: detail({ id: 'e7', number: 7, title: 'Whole', status: 'split' }), decisions: { createdBy: 'cmt_1', lastProcessed: null, decidedBy: 'u_owner' } })) }));
    const split = screen.getByRole('region', { name: 'Split' });
    expect(split.textContent).toContain('Child a of Epic 7 · Whole');
    expect(split.textContent).toContain('decision cmt_1');
    expect(split.textContent).toContain('by u_owner');
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

describe('T1588 · the stage card shows readiness as a separate claim and offers no control that marks the Epic ready', () => {
  it('states the verdict and note, and where conditions will be configured', async () => {
    await page(api({ getEpicStage: vi.fn(async () => ({ ...STAGE, stage: 'Ready', next: '/speckit-implement', readiness: { verdict: 'Ready', note: 'no readiness conditions configured', failing: [] } })) }));
    const stage = screen.getByRole('region', { name: 'Stage' });
    expect(stage.textContent).toContain('Readiness: Ready — no readiness conditions configured');
    expect(stage.textContent).toContain('configured in Governance');
    expect(within(stage).getAllByRole('button').map((b) => b.textContent)).toEqual(['Open executions']);
  });
});

describe('T1618 · a slug collision is shown on the child it renamed (EPIC-044, spec §Edge Cases)', () => {
  it('the Split section carries the finding', async () => {
    await page(api({ getEpic: vi.fn(async () => detail({ parentEpicId: 'e7', splitSuffix: 'a', slug: 'intake-1', parent: detail({ id: 'e7', number: 7, title: 'Whole', status: 'split' }), decisions: { createdBy: 'cmt_1', lastProcessed: null, decidedBy: 'u_owner' }, findings: ['slug `intake` collided with Epic 7; created as `intake-1`'] })) }));
    expect(screen.getByRole('region', { name: 'Split' }).textContent).toContain('slug `intake` collided with Epic 7; created as `intake-1`');
  });
});

/**
 * `T1652` (EPIC-045, `FR-ART-011`, `FR-ART-015`) — the Files section is part of
 * the Epic detail, below Stage, and its failure is contained.
 *
 * The containment assertion is the one with teeth: the artifacts read is a new
 * dependency of a screen that already worked, and a section that took the page
 * down with it when the read failed would be a regression in the Epic detail,
 * not a shortcoming of this Epic.
 */
describe('T1652 · the Files section on the Epic detail', () => {
  it('is present, below Stage', async () => {
    await page(api({ getEpicArtifacts: vi.fn(async () => ({ epicId: 'e1', files: [], refusals: [], findings: { reportedNotSynced: [], syncedNotReported: [] } })) }));
    const files = await screen.findByRole('region', { name: 'Files' });
    expect(files).toBeDefined();
    const stage = screen.getByRole('region', { name: 'Stage' });
    // Document order: Stage first, then Files.
    expect(stage.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passes the Epic\'s slug, so a renamed Epic can say so (FR-ART-035)', async () => {
    const getEpicArtifacts = vi.fn(async () => ({ epicId: 'e1', files: [], refusals: [], findings: { reportedNotSynced: [], syncedNotReported: [] } }));
    await page(api({ getEpicArtifacts }));
    await screen.findByRole('region', { name: 'Files' });
    expect(getEpicArtifacts).toHaveBeenCalledWith('e1');
  });

  it('a failure of the artifacts read leaves the rest of the detail standing, and the section states it', async () => {
    await page(api({ getEpicArtifacts: vi.fn(async () => { throw new ApiError('not_found', 'Artifacts are unavailable.', 404); }) }));
    const files = await screen.findByRole('region', { name: 'Files' });
    expect(files.textContent).toContain('Artifacts are unavailable.');
    // Everything the Epic detail showed before this Epic still shows.
    expect(screen.getByText('First.')).toBeDefined();
    expect(screen.getByRole('table', { name: 'Requirements of this Epic' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Stage' })).toBeDefined();
  });
});


/**
 * `T1784` (EPIC-046, `FR-KAN-050`) — the board is reachable from the Epic.
 *
 * `/speckit-converge` found it reachable from the Spec Journey Board's card and
 * from the Plan &amp; Tasks landing, and not from the Epic itself — which is the
 * one screen a reader is already on when they wonder about this Epic's tasks.
 */
describe('T1784 · the Epic detail opens its task board (FR-KAN-050)', () => {
  it('offers the control and names the Epic it opens', async () => {
    const { onOpenTasks } = await page(api());
    fireEvent.click(screen.getByRole('button', { name: 'Open the task board' }));
    expect(onOpenTasks).toHaveBeenCalledWith('e1');
  });

  it('states which side is authoritative, as every surface that reaches a move must', async () => {
    await page(api());
    const tasks = screen.getByRole('region', { name: 'Tasks' });
    expect(tasks.textContent).toContain('project directory');
    expect(tasks.textContent).toContain('proposal');
  });

  it('renders no control at all when the host has not routed the board', async () => {
    // A dead control is worse than none: it promises a screen that is not there.
    render(<EpicDetailPage api={api()} epicId="e1" currentUserId="u_owner" onOpenTimeline={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Epic 1 · Intake' });
    expect(screen.queryByRole('button', { name: 'Open the task board' })).toBeNull();
  });
});
