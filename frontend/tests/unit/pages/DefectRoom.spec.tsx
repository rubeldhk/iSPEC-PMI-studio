/**
 * `T998y` (EPIC-035) — the Room reads like the other two.
 *
 * `FR-DFR-090` to `FR-DFR-095`, `UX-0030`, `UX-0031`, `UX-0032`, `UX-0033`,
 * `UX-0035`, `UX-0040`, `UX-0042`.
 *
 * ## Verified by comparison, not by review
 *
 * That phrasing in the checkpoint is the whole design. Three Rooms agreeing
 * about six region names is exactly the kind of thing that stays true for a
 * year and then quietly does not, and a reviewer comparing two files by eye
 * will not catch the day one of them gains a `notes` region "temporarily".
 *
 * So the region set is compared against `ROOM_REGIONS` — the contract both
 * sibling Rooms already render — rather than against a list restated here. A
 * list restated here would be a fourth vocabulary, and the failure it is meant
 * to catch is a third.
 *
 * ## What this file does not do
 *
 * It does not measure pixels. jsdom has no layout engine, so a test asserting a
 * rendered width would assert a number jsdom made up — worse than no test,
 * because it reads as coverage for the requirement most likely to be broken by
 * a stylesheet change. What it asserts instead is what actually decides the
 * outcome: the retained regions are marked as retained **by the shell**, this
 * page contributes no breakpoint of its own, and all six regions stay in the
 * DOM at every width.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ROOM_REGIONS } from '@pmi/room-contract';
import { DefectRoomPage, type DefectRoomApi } from '../../../src/pages/DefectRoom';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '..', 'src');
const PAGE = readFileSync(join(SRC, 'pages', 'DefectRoom.tsx'), 'utf8');
/** Comments stripped: a structural check that reads its own prose is vacuous. */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const DEFECT = {
  id: 'df_1',
  projectId: 'pr_1',
  epicId: 'EPIC-999',
  state: 'triaged',
  origin: 'manual-report',
  contestedArtifactRef: 'spec_1',
  contestedArtifactVersion: 'v3',
  severity: 'high',
  reportedBy: 'u_0',
  reportedAt: '2026-08-20T09:00:00.000Z',
};

const CLASSIFICATION = {
  id: 'cl_1',
  outcome: 'confirmed-defect',
  destination: 'repair',
  approvedBehaviourRef: 'rv_1',
  absenceRecorded: false,
  classifiedBy: 'u_1',
  classifiedByKind: 'human',
  proposedByAgent: false,
  rationale: 'the baseline says one hour and it sends two',
  evaluatedAgainstVersion: null,
};

const EVIDENCE = {
  tests: [
    {
      id: 'dt_1',
      testRef: 'spec.ts::sends one',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: '2026-08-20T09:00:00.000Z',
      lastRunOutcome: 'fail',
      lastRunEvidenceRef: null,
    },
  ],
  reproductions: [
    {
      id: 'rp_1',
      reproducible: 'always',
      environment: 'production, EU region',
      evidenceRefs: ['ev_1'],
      affectedBehaviourRef: 'rv_1',
      notAutomatableReason: null,
    },
  ],
  evidenceChecks: [],
};

const api = (over: Partial<DefectRoomApi> = {}): DefectRoomApi => ({
  loopProgress: vi.fn().mockResolvedValue([]),
  defect: vi.fn().mockResolvedValue(DEFECT),
  defectClassification: vi.fn().mockResolvedValue(CLASSIFICATION),
  defectEvidence: vi.fn().mockResolvedValue(EVIDENCE),
  ...over,
});

function renderPage(over: Partial<DefectRoomApi> = {}, props: Record<string, unknown> = {}) {
  return render(
    <DefectRoomPage api={api(over)} defectId="df_1" projectId="pr_1" {...props} />,
  );
}

describe('T998y · FR-DFR-090, FR-DFR-091 — six regions, named by the contract', () => {
  it('renders exactly ROOM_REGIONS', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^room-region-/)).toHaveLength(6));
    const rendered = screen
      .getAllByTestId(/^room-region-/)
      .map((node) => node.getAttribute('data-testid')!.replace('room-region-', ''));
    expect(rendered.sort()).toEqual([...ROOM_REGIONS].sort());
  });

  it('and derives no region vocabulary of its own', async () => {
    // `UX-0035`: *if one Room needs a seventh region, the pattern changes for
    // all three*. A local list here would let this Room drift while its own
    // tests stayed green.
    expect(CODE).not.toMatch(/ROOM_REGIONS\s*=/);
    expect(CODE).toMatch(/RoomShell/);
  });

  it('composing through the imported shell rather than a local one', async () => {
    // `FR-DFR-090`. The import path is the assertion: a Room that built its own
    // six-panel layout would satisfy every visual review and none of the
    // guarantees the shell carries.
    expect(CODE).toMatch(/from\s+'\.\.\/rooms\/RoomShell'/);
  });
});

describe('T998y · FR-DFR-092, UX-0031 — AI triage is visibly not a fact', () => {
  it('marks an agent-proposed classification as AI output', async () => {
    // The distinction `UX-0031` actually asks for: what the system *observed*
    // versus what a model *produced*. An unlabelled recommendation is called
    // "a governance failure expressed as a styling choice".
    renderPage({
      defectClassification: vi
        .fn()
        .mockResolvedValue({ ...CLASSIFICATION, proposedByAgent: true }),
    });
    const mark = await screen.findByTestId('epistemic-mark');
    expect(mark.getAttribute('data-ai-output')).toBe('true');
    expect(mark.getAttribute('data-epistemic')).toBe('recommendation');
  });

  it('and a human classification is a recorded fact, not a recommendation', async () => {
    // The control. Without it, a page marking everything as AI output would
    // satisfy the assertion above while telling a reader nothing.
    renderPage();
    const mark = await screen.findByTestId('epistemic-mark');
    expect(mark.getAttribute('data-epistemic')).toBe('fact');
    expect(mark.getAttribute('data-ai-output')).toBeNull();
  });

  it('using the shared mapping rather than a local one', async () => {
    // `EPIC-029`'s tokens through `EPIC-033`'s component. A per-Room mapping
    // would let one Room paint an AI recommendation like a fact — `UX-0035`'s
    // failure one layer below the regions.
    expect(CODE).toMatch(/EpistemicMark/);
    expect(CODE).not.toMatch(/epistemic--/);
  });
});

describe('T998y · FR-DFR-093, UX-0032 — what is blocking, without another screen', () => {
  it('says a fix is blocked while no failing test is on record', async () => {
    renderPage({
      defectEvidence: vi.fn().mockResolvedValue({ ...EVIDENCE, tests: [] }),
    });
    const blockers = await screen.findByTestId('defect-blockers');
    expect(blockers.textContent).toMatch(/failing test/i);
  });

  it('and names the route that unblocks it', async () => {
    // A blocker a person cannot act on is a status message. `T996i` recorded
    // the same lesson for a refusal with nowhere to go.
    renderPage({
      defectEvidence: vi.fn().mockResolvedValue({ ...EVIDENCE, tests: [] }),
    });
    const blockers = await screen.findByTestId('defect-blockers');
    expect(blockers.textContent).toMatch(/\/test/);
  });

  it('says a change request cannot be fixed here', async () => {
    // `FR-DFR-075` surfaced where somebody would otherwise try it and be
    // refused by the server with no warning.
    renderPage({
      defectClassification: vi
        .fn()
        .mockResolvedValue({ ...CLASSIFICATION, outcome: 'change-request', destination: 'change-room' }),
    });
    const blockers = await screen.findByTestId('defect-blockers');
    expect(blockers.textContent).toMatch(/change request/i);
  });

  it('and says nothing is blocking when nothing is — the control', async () => {
    // Without this, a panel that always claimed a blocker would satisfy every
    // assertion above and mean nothing.
    renderPage();
    const blockers = await screen.findByTestId('defect-blockers');
    expect(blockers.textContent).toMatch(/nothing is blocking/i);
  });

  it('and one region failing does not take the others down', async () => {
    // `UX-0032` again: a page-level error boundary would take five working
    // regions down with the sixth, which is the opposite of what a person needs
    // when they are trying to find out what is blocking.
    renderPage({ loopProgress: vi.fn().mockRejectedValue(new Error('loop unreachable')) });
    await waitFor(() => expect(screen.getByText(/loop unreachable/)).toBeTruthy());
    expect(screen.getAllByTestId(/^room-region-/)).toHaveLength(6);
    expect(await screen.findByTestId('defect-blockers')).toBeTruthy();
  });
});

describe('T998y · FR-DFR-094, UX-0033 — a policy-refused action shows the policy', () => {
  it('names the refusing policy and the decision it belongs to', async () => {
    renderPage(
      {},
      {
        refusal: {
          remedy: 'decision-authority',
          decisionId: 'dec_1',
          reason: 'confirming a defect requires a human decider (FR-DFR-023)',
        },
      },
    );
    const panel = await screen.findByTestId('defect-refusal');
    expect(panel.textContent).toMatch(/FR-DFR-023/);
    expect(panel.textContent).toMatch(/dec_1/);
  });

  it('and shows nothing when nothing was refused', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^room-region-/)).toHaveLength(6));
    expect(screen.queryByTestId('defect-refusal')).toBeNull();
  });
});

describe('T998y · FR-DFR-095, UX-0040 — 360px, by inheritance', () => {
  it('the retained regions are marked by the shell', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^room-region-/)).toHaveLength(6));
    const retained = screen
      .getAllByTestId(/^room-region-/)
      .filter((node) => node.getAttribute('data-narrow-viewport') === 'retained')
      .map((node) => node.getAttribute('data-testid')!.replace('room-region-', ''));

    expect(retained.sort()).toEqual(['decision', 'evidence', 'objectState'].sort());
  });

  it('and this page sets no breakpoint of its own', async () => {
    // `FR-DFR-095` is satisfied by inheriting the shell's behaviour, not by
    // re-implementing it. A Room deciding for itself which of its regions is
    // expendable is what `RETAINED_AT_360` exists to prevent.
    expect(CODE).not.toMatch(/360|max-width|matchMedia|@media/);
  });

  it('and all six regions stay in the DOM at every width', async () => {
    // Retention is about **priority, not removal**. Dropping three regions at
    // 360px would take them from a screen reader too, on the viewport size most
    // correlated with a phone — a page that "helpfully" hid them would pass a
    // visual check and fail the people it was meant to help.
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^room-region-/)).toHaveLength(6));
  });
});

describe('T998y · and the page composes rather than decides', () => {
  it('calls the client by the names the client already has', async () => {
    // `FR-SHL-003`'s lesson from `EPIC-034`: an adapter reshaping names in
    // `area-views.tsx` is the shell reaching a domain endpoint with an extra
    // step. The page's interface is a subset of `ApiClient`, so the client
    // passes straight through.
    const client = api();
    renderPage(client);
    await waitFor(() => expect(client.defect).toHaveBeenCalledWith('df_1'));
    expect(client.defectClassification).toHaveBeenCalledWith('df_1');
    expect(client.defectEvidence).toHaveBeenCalledWith('df_1');
  });

  it('and holds no rule about what an outcome means', async () => {
    // The destination comes from the server, which stores it (`FR-DFR-077`). A
    // mapping here would be a second copy of one the database CHECKs.
    expect(CODE).not.toMatch(/'change-room'\s*:/);
    expect(CODE).not.toMatch(/requirement-room'\s*:/);
  });
});
