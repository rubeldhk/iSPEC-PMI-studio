/**
 * `T753`, `T755` — the Decision Inbox projection. `FR-DPE-020`–`FR-DPE-025`,
 * `R-031-4`.
 *
 * **Derived, never stored.** There is no queue table: membership is computed
 * on every read from the decisions themselves, the reader and the current
 * policy. So a role change or a decision taken elsewhere is reflected with no
 * invalidation path that could be missed (`FR-DPE-022`, `FR-DPE-024`).
 *
 * Two kinds today:
 *
 * - **approval** — a pending decision, shown to the humans who may approve it:
 *   anyone in the workspace but the requester, unless policy permits
 *   self-approval for the class (`FR-DPE-015`). Never to automation.
 * - **blocked** — a refused request nobody has resolved or superseded, shown to
 *   the person it blocks, naming what would unblock it (`FR-DPE-025`).
 *
 * `review` and `escalation` are kinds the contract names and no source produces
 * yet: review requests are `EPIC-021`'s, escalation `EPIC-031`'s follow-on.
 * Recorded in `DEF-031-002` rather than faked.
 */
import type { ActorRef, RiskBand } from '@pmi/decision-contract';
import type { DecisionRecord } from './decision.repository.js';
import { patternCovers, type TenantPolicyDocument } from './policy.loader.js';

export type InboxKind = 'approval' | 'blocked' | 'review' | 'escalation';

export interface InboxEntry {
  readonly decisionId: string;
  readonly kind: InboxKind;
  readonly actionType: string;
  /** `FR-DPE-023` — the object, and below it the action, this entry concerns. */
  readonly objectRef: { readonly type: string; readonly id: string };
  readonly objectVersion: string;
  readonly projectId: string;
  readonly band: RiskBand;
  readonly requestedBy: string;
  /** `FR-DPE-025` — what would unblock it. Never a bare "not ready". */
  readonly blockedBy: string;
  readonly since: string;
}

function why(decision: DecisionRecord): string {
  const failing = decision.gateOutcomes.filter((g) => g.result !== 'satisfied' && g.result !== 'exception');
  if (failing.length > 0) {
    return failing.map((g) => `gate ${g.gateId} is ${g.result}${g.detail ? ` — ${g.detail}` : ''}`).join('; ');
  }
  // Policy refused: the authority line names the policy version and the reason.
  return decision.authorityBasis;
}

export function inboxFor(
  reader: ActorRef,
  decisions: readonly DecisionRecord[],
  policy: TenantPolicyDocument,
): InboxEntry[] {
  if (reader.kind !== 'human') return [];

  const resolved = new Set(decisions.map((d) => d.resolvesDecisionId).filter((id): id is string => id !== null));
  const key = (d: DecisionRecord) => `${d.actionType}|${d.target.type}|${d.target.id}`;
  const latest = new Map<string, DecisionRecord>();
  for (const d of decisions) {
    const existing = latest.get(key(d));
    if (existing === undefined || d.createdAt.getTime() >= existing.createdAt.getTime()) latest.set(key(d), d);
  }

  const entries: InboxEntry[] = [];
  for (const d of decisions) {
    if (resolved.has(d.id)) continue;
    const requester = d.requestedBy ?? d.actorId;
    const base = {
      decisionId: d.id,
      actionType: d.actionType,
      objectRef: d.target,
      objectVersion: d.objectVersion,
      projectId: d.projectId,
      band: d.effectiveClass,
      requestedBy: requester,
      since: d.createdAt.toISOString(),
    };

    if (d.outcome === 'pending') {
      const mayApprove =
        reader.id !== requester || policy.selfApprovalAllowed.some((p) => patternCovers(p, d.actionType));
      if (mayApprove) {
        entries.push({
          ...base,
          kind: 'approval',
          blockedBy: `awaits approval by an authorized human other than ${requester} (FR-DPE-010, FR-DPE-015)`,
        });
      }
    } else if (d.outcome === 'refused' && requester === reader.id && latest.get(key(d))?.id === d.id) {
      entries.push({ ...base, kind: 'blocked', blockedBy: why(d) });
    }
  }
  return entries.sort((a, b) => a.since.localeCompare(b.since));
}
