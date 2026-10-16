/**
 * `T2378` (EPIC-048, US6, `FR-LRN-071`, `-072`, `-074`, `-075`; `UX-0032`) — the
 * candidate detail the Decision Inbox renders for `learning-candidate`.
 *
 * - statement, category, source session, evidence with its state, confidence and
 *   basis, claimed scope, corroborations and conflict — all on one view;
 * - a superseding candidate beside the entry it replaces;
 * - agent-proposed content and approved content visually distinct;
 * - withheld evidence shown as a count, never as an item;
 * - approve with narrowing and editing; reject with a reason;
 * - readable at 360px — asserted on what can be established without a layout
 *   engine (`T994w`'s reasoning): no width floor above 360, the comparison
 *   collapses to one column, nothing is hidden.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LearningCandidateDetail, type LearningCandidateApi } from '../../../src/pages/inbox-details/LearningCandidateDetail';
import type { LearningCandidateView } from '../../../src/services/api';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '..', 'src');

function view(over: Partial<LearningCandidateView> = {}): LearningCandidateView {
  return {
    candidate: {
      id: 'lc_1',
      kind: 'new',
      statement: 'Integration tests need the local database started first.',
      category: 'test-setup',
      subject: 'integration prerequisites',
      projectId: 'p1',
      confidenceLevel: 'medium',
      confidenceBasis: 'Three failing runs without it.',
      claimedScope: { kind: 'projects', projectIds: ['p1', 'p2'] },
      state: 'pending-review',
      submittedAt: '2026-10-09T10:00:00Z',
      late: false,
      transitions: [
        { seq: 1, state: 'proposed', reason: null, at: '2026-10-09T10:00:00Z', actorKind: 'platform', actorId: 'learning-intake' },
        { seq: 2, state: 'pending-review', reason: null, at: '2026-10-09T10:00:01Z', actorKind: 'platform', actorId: 'learning-intake' },
      ],
    },
    source: { kind: 'execution', executionId: 'exe_42', principalId: 'agent_7', expert: { id: 'expert_qa', contractVersionId: 'ecv', contractVersion: 3 } },
    evidence: [
      { state: 'verified', evidenceId: 'ev_1', digest: 'a'.repeat(64), predicateType: 'https://pmi.studio/attestation/test-run/v1' },
      { state: 'integrity-failed', evidenceId: 'ev_2', digest: 'b'.repeat(64), predicateType: null },
      { state: 'withheld' },
    ],
    withheldEvidenceCount: 1,
    corroborations: [{ id: 'co_1', sourceKind: 'execution', executionId: 'exe_43', sourcePrincipalId: 'agent_8', statement: 'Start Postgres before the suite.', confidenceLevel: 'high', confidenceBasis: 'Saw it twice.', submittedAt: '2026-10-09T11:00:00Z', evidence: [] }],
    eligibility: { automatic: false, failedConditions: ['scope-not-source-project', 'evidence-not-verified'] },
    decision: { decisionId: 'dec_1', outcome: 'pending' },
    flags: [],
    ...over,
  };
}

type RecordingApi = LearningCandidateApi & { reviewLearningCandidate: ReturnType<typeof vi.fn> };

function api(v: LearningCandidateView = view()): RecordingApi {
  return {
    getLearningCandidate: vi.fn(async () => v),
    reviewLearningCandidate: vi.fn(async () => ({ state: 'approved', entryId: 'ke_1', versionId: 'kv_1', version: 1, retrievability: { outcome: 'not-yet-retrievable', reason: 'EmbeddingPort is not bound' } })),
  } as unknown as RecordingApi;
}

async function shown(client: LearningCandidateApi): Promise<HTMLElement> {
  render(<LearningCandidateDetail api={client} candidateId="lc_1" />);
  return screen.findByRole('article', { name: /Learning candidate/ });
}

describe('T2378 · everything on one view (FR-LRN-071, UX-0032)', () => {
  it('statement, category, source session, confidence and basis, claimed scope', async () => {
    const article = await shown(api());
    // The proposed statement sits in its own labelled figure (the edit box below repeats it).
    const proposed = within(article).getByRole('figure', { name: /Proposed by an agent/ });
    expect(within(proposed).getByText('Integration tests need the local database started first.')).toBeTruthy();
    expect(within(article).getByText('test-setup')).toBeTruthy();
    expect(within(article).getByText(/exe_42/)).toBeTruthy();
    expect(within(article).getByText(/expert_qa.*v3/)).toBeTruthy();
    expect(within(article).getByText(/medium/)).toBeTruthy();
    expect(within(article).getByText('Three failing runs without it.')).toBeTruthy();
    expect(within(article).getByText('Claimed scope').nextElementSibling?.textContent).toBe('projects p1, p2');
  });

  it('evidence with its state, and withheld evidence as a count only', async () => {
    const article = await shown(api());
    const evidence = within(article).getByRole('region', { name: 'Evidence' });
    expect(within(evidence).getByText('verified')).toBeTruthy();
    expect(within(evidence).getByText('integrity-failed')).toBeTruthy();
    expect(within(evidence).getByText(/1 evidence item is not visible to you/)).toBeTruthy();
    expect(within(evidence).getAllByRole('listitem')).toHaveLength(2);
  });

  it('corroborations, eligibility and the decision state', async () => {
    const article = await shown(api());
    const corro = within(article).getByRole('region', { name: 'Corroborations' });
    expect(within(corro).getByText('Start Postgres before the suite.')).toBeTruthy();
    expect(within(article).getByText(/scope-not-source-project/)).toBeTruthy();
    expect(within(article).getByText(/pending-review/)).toBeTruthy();
  });

  it('T2676 · open flags are shown with their detail; cleared ones are not (FR-LRN-037, FR-LRN-071)', async () => {
    const article = await shown(
      api(
        view({
          flags: [
            { kind: 'source-invalid', detail: 'execution exe_42 validation-failed', raisedAt: '2026-10-10T09:00:00Z', open: true },
            { kind: 'evidence-changed', detail: 'ev_9 integrity-failed', raisedAt: '2026-10-10T08:00:00Z', open: false },
          ],
        }),
      ),
    );
    const flags = within(article).getByRole('region', { name: 'Open flags' });
    expect(within(flags).getByText(/source-invalid/)).toBeTruthy();
    expect(within(flags).getByText(/execution exe_42 validation-failed/)).toBeTruthy();
    expect(within(flags).queryByText(/evidence-changed/)).toBeNull();
  });

  it('no open flag, no flags region', async () => {
    const article = await shown(api());
    expect(within(article).queryByRole('region', { name: 'Open flags' })).toBeNull();
  });

  it('T2691 · the candidate’s age (US6 acceptance scenario 1)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    try {
      const article = await shown(api());
      expect(within(article).getByText('Age').nextElementSibling?.textContent).toBe('2 days');
    } finally {
      vi.useRealTimers();
    }
  });

  it('T2691 · each corroboration shows its own evidence with its state, withheld items as a count (FR-LRN-071)', async () => {
    const article = await shown(
      api(
        view({
          corroborations: [
            {
              ...view().corroborations[0]!,
              evidence: [{ state: 'verified', evidenceId: 'ev_c1', digest: 'c'.repeat(64), predicateType: null }, { state: 'withheld' }],
            },
          ],
        }),
      ),
    );
    const corro = within(article).getByRole('region', { name: 'Corroborations' });
    expect(within(corro).getByText('ev_c1')).toBeTruthy();
    expect(within(corro).getByText('verified')).toBeTruthy();
    expect(within(corro).getByText(/1 evidence item is not visible to you/)).toBeTruthy();
  });

  it('a conflict names the approved entry', async () => {
    const article = await shown(api(view({ conflictsWith: { entryId: 'ke_9', versionId: 'kv_9', version: 2, statement: 'The opposite is true.' } })));
    const conflict = within(article).getByRole('region', { name: 'Conflicts with approved knowledge' });
    expect(within(conflict).getByText('The opposite is true.')).toBeTruthy();
    expect(within(conflict).getByText(/v2/)).toBeTruthy();
  });
});

describe('T2378 · side by side, and proposed versus approved (FR-LRN-072, FR-LRN-074)', () => {
  it('a superseding candidate is shown beside the entry it replaces, each labelled', async () => {
    const article = await shown(
      api(view({ candidate: { ...view().candidate, kind: 'supersede', statement: 'Start the database, then migrate.' }, supersedes: { entryId: 'ke_1', versionId: 'kv_1', version: 1, statement: 'Start the database first.', scope: { kind: 'project', projectIds: ['p1'] }, classification: 'internal', status: 'current' } })),
    );
    const compare = within(article).getByRole('region', { name: 'Proposed change' });
    const current = within(compare).getByRole('figure', { name: /Approved knowledge — v1/ });
    const proposed = within(compare).getByRole('figure', { name: /Proposed by an agent/ });
    expect(within(current).getByText('Start the database first.')).toBeTruthy();
    expect(within(proposed).getByText('Start the database, then migrate.')).toBeTruthy();
    expect(current.className).toMatch(/lrn-approved/);
    expect(proposed.className).toMatch(/lrn-proposed/);
  });

  it('the proposed statement is always marked as proposed, not knowledge', async () => {
    const article = await shown(api());
    expect(within(article).getByText(/Proposed — not knowledge until decided/)).toBeTruthy();
  });
});

describe('T2378 · deciding (FR-LRN-028, FR-LRN-029)', () => {
  it('approve with a narrowed scope and an edited statement', async () => {
    const client = api();
    const article = await shown(client);
    fireEvent.change(within(article).getByLabelText('Approved statement'), { target: { value: 'Start the database first.' } });
    fireEvent.change(within(article).getByLabelText('Approved scope'), { target: { value: 'project:p1' } });
    fireEvent.click(within(article).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(client.reviewLearningCandidate).toHaveBeenCalledTimes(1));
    expect(client.reviewLearningCandidate).toHaveBeenCalledWith('lc_1', { decision: 'approve', statement: 'Start the database first.', scope: { kind: 'project', projectIds: ['p1'] } });
    expect(await within(article).findByText(/not yet retrievable/i)).toBeTruthy();
  });

  it('offers only scopes within the claim — never wider', async () => {
    const article = await shown(api());
    const options = within(within(article).getByLabelText('Approved scope')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['claimed', 'project:p1', 'project:p2']);
  });

  it('T2691 · a workspace claim offers the source project as a narrowing (FR-LRN-028)', async () => {
    const article = await shown(api(view({ candidate: { ...view().candidate, claimedScope: { kind: 'workspace', projectIds: [] } } })));
    const options = within(within(article).getByLabelText('Approved scope')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['claimed', 'project:p1']);
  });

  it('reject needs a reason, then sends it', async () => {
    const client = api();
    const article = await shown(client);
    const reject = within(article).getByRole('button', { name: 'Reject' });
    expect((reject as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(article).getByLabelText('Reason for rejecting'), { target: { value: 'Only true on one laptop.' } });
    fireEvent.click(reject);
    await waitFor(() => expect(client.reviewLearningCandidate).toHaveBeenCalledWith('lc_1', { decision: 'reject', reason: 'Only true on one laptop.' }));
  });

  it('shows the refusal when the decision is refused (e.g. 403 for a non-human reviewer)', async () => {
    const client = api();
    client.reviewLearningCandidate.mockRejectedValueOnce(new Error('Refused: an AI never approves.'));
    const article = await shown(client);
    fireEvent.click(within(article).getByRole('button', { name: 'Approve' }));
    expect(await within(article).findByRole('alert')).toBeTruthy();
    expect(within(article).getByText(/an AI never approves/)).toBeTruthy();
  });

  it('no decision controls once the candidate is not pending review', async () => {
    const article = await shown(api(view({ candidate: { ...view().candidate, state: 'rejected' } })));
    expect(within(article).queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});

describe('T2378 · readable at 360px (FR-LRN-075, UX-0040)', () => {
  const css = readFileSync(join(SRC, 'pages', 'inbox-details', 'learning.css'), 'utf8');
  const code = readFileSync(join(SRC, 'pages', 'inbox-details', 'LearningCandidateDetail.tsx'), 'utf8');

  it('sets no width floor above 360px', () => {
    for (const m of css.matchAll(/(?:min-)?width:\s*(\d+)px/g)) expect(Number(m[1])).toBeLessThanOrEqual(360);
    expect(code).not.toMatch(/minWidth|style=\{\{\s*width/);
  });

  it('collapses the side-by-side comparison to one column when narrow', () => {
    expect(css).toMatch(/\.lrn-compare\s*{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%/);
  });

  it('long statements and ids wrap rather than overflow', () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
