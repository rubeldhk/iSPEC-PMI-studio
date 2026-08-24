/**
 * T439b (EPIC-036) — what Home is made of.
 *
 * `FR-SHL-032` names three kinds of attention item: pending approvals, policy
 * blocks and missing evidence. **One of the three has a source that exists.**
 * `EPIC-031` (0 of 92) would supply policy blocks and `EPIC-032` (0 of 83)
 * would supply evidence; neither has an endpoint to call (`R-036-4`).
 *
 * So `sources` carries three entries **always, and is not optional**. A
 * `HomeModel` with only `items` would let a Home with one working source render
 * as though nothing were blocked — the confident blank screen this Epic exists
 * to stop repeating. Making the absence part of the type means it has to be
 * rendered or deliberately discarded, and `FR-SHL-062` forbids the second.
 *
 * This is the posture `EPIC-033` took for its unbound `AgentGateway`: degrade
 * visibly, and say so in the payload rather than in a comment.
 *
 * Unit tests: `frontend/tests/unit/shell/home-model.spec.ts` (T439a).
 */

export type AttentionKind = 'pending-approval' | 'policy-block' | 'missing-evidence';

/** The three, in the order Home renders them. */
export const ATTENTION_KINDS: readonly AttentionKind[] = Object.freeze([
  'pending-approval',
  'policy-block',
  'missing-evidence',
]);

export const KIND_LABELS: Readonly<Record<AttentionKind, string>> = Object.freeze({
  'pending-approval': 'Waiting for your approval',
  'policy-block': 'Blocked by policy',
  'missing-evidence': 'Missing evidence',
});

export interface AttentionItem {
  readonly kind: AttentionKind;
  /** What it is about, in the user's words (`FR-SHL-031`). */
  readonly subject: string;
  /** Which project it belongs to (`FR-SHL-031`). */
  readonly projectId: string;
  /** The address of the thing needing action — an `Area.path`, never invented. */
  readonly href: string;
  /** For a policy block, **the policy that produced it** (`FR-SHL-033`, `BR-0174`). */
  readonly detail?: string;
}

export type SourceState = 'available' | 'unavailable' | 'failed';

export interface SourceStatus {
  readonly kind: AttentionKind;
  readonly state: SourceState;
  /** Why, when not available — names the Epic that will supply it. */
  readonly reason?: string;
}

export interface HomeModel {
  readonly items: readonly AttentionItem[];
  /** Always three. Not optional, and that is the point — see the header. */
  readonly sources: readonly [SourceStatus, SourceStatus, SourceStatus];
}

/** True when a source produced nothing because there was nothing to produce. */
export function isEmptyAndWorking(model: HomeModel, kind: AttentionKind): boolean {
  const source = model.sources.find((candidate) => candidate.kind === kind);
  return source?.state === 'available' && model.items.every((item) => item.kind !== kind);
}

/**
 * Assemble the three source results into one model, in `ATTENTION_KINDS` order.
 *
 * Takes exactly three results because the type takes exactly three. A caller
 * that forgot one would otherwise produce a Home that silently under-reports,
 * which is the failure mode, not a missing feature.
 */
export function homeModel(
  results: readonly [SourceResult, SourceResult, SourceResult],
): HomeModel {
  const ordered = ATTENTION_KINDS.map(
    (kind) => results.find((result) => result.status.kind === kind) ?? unavailable(kind, 'No source'),
  );
  return {
    items: ordered.flatMap((result) => result.items),
    sources: [ordered[0]!.status, ordered[1]!.status, ordered[2]!.status],
  };
}

export interface SourceResult {
  readonly status: SourceStatus;
  readonly items: readonly AttentionItem[];
}

export function available(kind: AttentionKind, items: readonly AttentionItem[]): SourceResult {
  return { status: { kind, state: 'available' }, items };
}

export function unavailable(kind: AttentionKind, reason: string): SourceResult {
  return { status: { kind, state: 'unavailable', reason }, items: [] };
}

export function failed(kind: AttentionKind, reason: string): SourceResult {
  return { status: { kind, state: 'failed', reason }, items: [] };
}
