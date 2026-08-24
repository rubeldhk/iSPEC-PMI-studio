/**
 * T439d / T439f (EPIC-036) — where Home's three sections come from.
 *
 * **No new endpoint** (`FR-SHL-034`, `PP-007`): Home composes endpoints any
 * other client could call. Pending approvals are two existing `EPIC-023` calls;
 * the other two sections have no endpoint at all, and say so.
 *
 * Stubbing the missing two was rejected outright (`R-036-4`). A fabricated
 * policy block is worse than an absent one — it is governance state the
 * platform did not produce, shown to somebody who would act on it.
 *
 * Unit tests: `frontend/tests/unit/shell/home-sources.spec.ts` (T439c, T439e).
 */
import {
  available,
  failed,
  unavailable,
  type AttentionItem,
  type SourceResult,
} from './home-model';
import type { ApiClient } from '../services/api';

/** The run states that mean a person still has to look at it (`EPIC-023`). */
const AWAITING_REVIEW = 'awaiting_review';

/**
 * Pending approvals — the one source that exists.
 *
 * `GET /projects/:projectId/runs` filtered to `awaiting_review`, then
 * `GET /runs/:id/review` for the questions nobody has answered. Both have been
 * served since `EPIC-023`; until `T200d` built `RunsPage`, nothing called
 * either, which is how `ReviewSession` came to be one of `DEF-010-001`'s five
 * unreachable pages.
 */
export async function pendingApprovals(api: ApiClient, projectId: string): Promise<SourceResult> {
  try {
    const runs = (await api.listRuns(projectId)).filter((run) => run.state === AWAITING_REVIEW);
    const items: AttentionItem[] = [];
    for (const run of runs) {
      const review = await api.getRunReview(run.id);
      const unanswered = review.questions.filter((question) => question.answers.length === 0);
      if (unanswered.length === 0) continue;
      items.push({
        kind: 'pending-approval',
        subject: `Run ${run.id} — ${unanswered.length} question${unanswered.length === 1 ? '' : 's'} unanswered`,
        projectId: run.projectId,
        // An `Area.path` sub-view, never an invented route (`FR-SHL-031`).
        href: `/runs/${encodeURIComponent(run.id)}`,
      });
    }
    return available('pending-approval', items);
  } catch (error) {
    // `FR-SHL-062` — a failed section reports as failed. Returning an empty
    // list here would render as "nothing is waiting for you", which is a
    // different and much worse claim than "we could not find out".
    return failed(
      'pending-approval',
      error instanceof Error ? error.message : 'The runs service did not answer.',
    );
  }
}

/**
 * Policy blocks — **no source exists**.
 *
 * `EPIC-031` (0 of 92 tasks) owns the decision policy engine. There is no
 * endpoint to call, so this reports `unavailable` and names the Epic. It is not
 * a defect and must not be filed as one.
 */
export function policyBlocks(): SourceResult {
  return unavailable(
    'policy-block',
    'The decision policy engine is not built yet (EPIC-031). Policy blocks cannot be shown.',
  );
}

/**
 * Missing evidence — **no source exists**.
 *
 * `EPIC-032` (0 of 83 tasks) owns evidence contracts. Same posture, same
 * reason.
 */
export function missingEvidence(): SourceResult {
  return unavailable(
    'missing-evidence',
    'Evidence contracts are not built yet (EPIC-032). Missing evidence cannot be shown.',
  );
}
