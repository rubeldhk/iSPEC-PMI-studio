/**
 * T439c / T439e (EPIC-036) — where Home's three sections come from, and what
 * two of them say instead.
 *
 * `EPIC-031` (0 of 92) would supply policy blocks and `EPIC-032` (0 of 83)
 * would supply evidence. **Stubbing them was rejected outright** (`R-036-4`): a
 * fabricated policy block is governance state the platform did not produce,
 * shown to somebody who would act on it. Worse than an absent one, not better.
 *
 * So the assertions below are as much about what these functions **do not**
 * return as what they do.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  missingEvidence,
  pendingApprovals,
  policyBlocks,
} from '../../../src/shell/home-sources';
import type { ApiClient, ReviewSession, Run } from '../../../src/services/api';

const run = (state: string, id = 'run_1'): Run => ({
  id,
  projectId: 'p1',
  mode: 'full',
  stopRange: 'implement',
  state,
  stoppedAtSelectedRange: true,
  outcomeReason: null,
  startedAt: '2026-08-23T10:00:00Z',
  endedAt: null,
});

const review = (answered: boolean): ReviewSession => ({
  id: 'rs_1',
  runId: 'run_1',
  state: 'open',
  openedAt: '2026-08-23T10:05:00Z',
  submittedAt: null,
  questions: [
    {
      id: 'q1',
      context: 'Which storage backend?',
      optionsConsidered: [],
      suggestedAnswer: 'S3',
      restricted: false,
      answers: answered ? [{ id: 'a1' }] : [],
    },
  ],
} as unknown as ReviewSession);

function api(overrides: Partial<Record<string, unknown>> = {}): ApiClient {
  return {
    listRuns: vi.fn(async (): Promise<Run[]> => [run('awaiting_review')]),
    getRunReview: vi.fn(async (): Promise<ReviewSession> => review(false)),
    ...overrides,
  } as unknown as ApiClient;
}

describe('T439c · pending approvals — the one source that exists', () => {
  it('reads the existing EPIC-023 endpoints and introduces none of its own', async () => {
    const client = api();
    await pendingApprovals(client, 'p1');
    expect(client.listRuns).toHaveBeenCalledWith('p1');
    expect(client.getRunReview).toHaveBeenCalledWith('run_1');
  });

  it('reports one item per run with unanswered questions', async () => {
    const result = await pendingApprovals(api(), 'p1');
    expect(result.status).toEqual({ kind: 'pending-approval', state: 'available' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.projectId).toBe('p1');
  });

  it('links to the run’s address, never an invented route (FR-SHL-031)', async () => {
    const result = await pendingApprovals(api(), 'p1');
    expect(result.items[0]?.href).toBe('/runs/run_1');
  });

  it('ignores runs that are not awaiting review', async () => {
    const result = await pendingApprovals(
      api({ listRuns: vi.fn(async () => [run('succeeded'), run('running', 'run_2')]) }),
      'p1',
    );
    expect(result.items).toEqual([]);
    expect(result.status.state).toBe('available');
  });

  it('ignores a review whose questions are all answered', async () => {
    const result = await pendingApprovals(api({ getRunReview: vi.fn(async () => review(true)) }), 'p1');
    expect(result.items).toEqual([]);
  });

  it('reports a failure as FAILED, not as an empty list (FR-SHL-062)', async () => {
    // The distinction the whole Epic turns on. An empty list here renders as
    // "nothing is waiting for you", which is a claim, and a false one.
    const result = await pendingApprovals(
      api({
        listRuns: vi.fn(async () => {
          throw new Error('the runs service did not answer');
        }),
      }),
      'p1',
    );
    expect(result.status.state).toBe('failed');
    expect(result.status.reason).toContain('did not answer');
    expect(result.items).toEqual([]);
  });
});

describe('T439e · the two sources that do not exist say so', () => {
  it.each([
    ['policy blocks', policyBlocks, 'policy-block', 'EPIC-031'],
    ['missing evidence', missingEvidence, 'missing-evidence', 'EPIC-032'],
  ] as const)('%s reports unavailable and names the Epic that will supply it', (_name, source, kind, epic) => {
    const result = source();
    expect(result.status.kind).toBe(kind);
    expect(result.status.state).toBe('unavailable');
    expect(result.status.reason).toContain(epic);
  });

  it('fabricates nothing at all', () => {
    // `R-036-4` rejected stubbing outright, and this is that decision as an
    // assertion rather than a comment: no invented policy block, no invented
    // evidence gap, ever.
    expect(policyBlocks().items).toEqual([]);
    expect(missingEvidence().items).toEqual([]);
  });

  it('is unavailable, not failed — the two are different claims', () => {
    // "There is no source" and "the source did not answer" lead somewhere
    // different: one waits for an Epic, the other is an incident.
    expect(policyBlocks().status.state).not.toBe('failed');
    expect(missingEvidence().status.state).not.toBe('failed');
  });
});
