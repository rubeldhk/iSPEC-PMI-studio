/**
 * `T994s`, `T994v` (EPIC-034) — the Change Room page. `FR-CHR-080`–`FR-CHR-085`,
 * `UX-0030`, `UX-0032`, `UX-0033`, `UX-0035`, `UX-0040`, `UX-0042`, `UX-0051`.
 *
 * **It composes and it does not decide.** Every region's content comes from a
 * projection somebody else owns — loop progress from `EPIC-030`, options from
 * `EPIC-028` through this Room's service, the impact view from `EPIC-020`. The
 * page's judgement is limited to which region a projection belongs in, and it
 * holds no rule about what any of them mean.
 *
 * **It derives no region vocabulary.** `RoomShell` is imported and its six prop
 * names come from `@pmi/room-contract`. `T994t` compares them by comparison
 * rather than review, and that comparison is only worth running because this
 * file restates nothing.
 *
 * **Each region fails on its own.** One failed fetch darkens one region; the
 * other five still render. A page-level error boundary would be simpler and
 * would take five working regions down with the sixth — the opposite of what a
 * person needs when they are trying to find out what is blocking (`UX-0032`).
 *
 * The narrow-viewport behaviour is the shell's (`RETAINED_AT_360`), not this
 * page's. A Room deciding for itself which of its regions is expendable is what
 * that set exists to prevent, and `FR-CHR-085` is satisfied by inheriting it
 * rather than by re-implementing it here.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { RoomShell } from '../rooms/RoomShell';
import { LoopProgress } from '../rooms/regions/LoopProgress';
import { ChangeOptionsRegion, type ChangeOptionsView } from '../rooms/regions/ChangeOptions';
import { EpistemicMark } from '../rooms/regions/Epistemic';
import type {
  ChangeClosureSummary,
  ChangeDecisionSummary,
  ChangeImpactSummary,
  ChangeRequestSummary,
} from '../services/api';

/**
 * The Room reads these shapes; `services/api.ts` declares them.
 *
 * Aliased rather than restated, so the page and the client cannot drift into
 * two descriptions of one response - which is the shape `DEF-034-001` took one
 * layer down.
 */
export type ChangeRequestView = ChangeRequestSummary;
export type ImpactView = ChangeImpactSummary;
export type ChangeDecisionView = ChangeDecisionSummary;
export type ChangeClosureView = ChangeClosureSummary;

/**
 * What the page needs, and nothing more. No method here decides anything.
 *
 * The names match `ApiClient`'s, so the shell passes the client straight
 * through and calls nothing itself. `FR-SHL-003` forbids the shell reaching a
 * domain endpoint, and an adapter built in `area-views.tsx` would be exactly
 * that with an extra step.
 */
export interface ChangeRoomApi {
  loopProgress(roomObjectId: string): Promise<readonly LoopProgressRow[]>;
  changeRequest(changeRequestId: string): Promise<ChangeRequestView>;
  changeImpact(changeRequestId: string): Promise<ImpactView | null>;
  changeDecision(changeRequestId: string): Promise<ChangeDecisionView | null>;
  changeClosure(changeRequestId: string): Promise<ChangeClosureView | null>;
  /**
   * `FR-CHR-040` - generating options invokes an analysis provider.
   *
   * A `POST`, and not called on mount. Opening a screen should not spend money
   * or a provider's time, and a page that generated options every time somebody
   * looked at a change would produce a new set nobody asked for beside the one
   * a decision was taken against.
   */
  changeOptions(changeRequestId: string): Promise<ChangeOptionsView>;
}

export interface LoopProgressRow {
  readonly stage: string;
  readonly status: string;
  readonly omitted: boolean;
}

export interface ImpactAreaView {
  readonly area: string;
  readonly state: string;
  readonly detail: string;
  readonly itemCount: number | null;
}

/**
 * `FR-CHR-084`, `UX-0033` — a policy-refused action shows the refusing policy.
 *
 * The shape `ChangeDecisionRefusedError` puts in a 403 body. A refusal that
 * named nothing would leave a person guessing which of their roles fell short,
 * which is the same as not telling them.
 */
export interface PolicyRefusalView {
  readonly remedy: 'decision-authority';
  readonly decisionId: string;
  readonly reason: string;
}

/** One region's fetch: its value, or the error that stopped it. Never both. */
interface Slot<T> {
  readonly value: T | null;
  readonly error: string | null;
  readonly loading: boolean;
}

const PENDING = { value: null, error: null, loading: true } as const;

/**
 * What the options region shows before anybody has asked for any.
 *
 * Not an empty list: "no options exist" and "none have been generated" are
 * different claims, and only the second one is true here.
 */
const NOT_REQUESTED: Slot<ChangeOptionsView> = {
  value: {
    available: false,
    options: null,
    degradedKind: 'not-requested',
    degradedReason:
      'No options have been generated for this change yet. Generating them invokes an ' +
      'analysis provider, so it is a deliberate act rather than something opening this screen ' +
      'does.',
    rejected: [],
  },
  error: null,
  loading: false,
};

function useSlot<T>(load: () => Promise<T>, deps: readonly unknown[]): Slot<T> {
  const [slot, setSlot] = useState<Slot<T>>(PENDING);
  useEffect(() => {
    let live = true;
    setSlot(PENDING);
    load().then(
      (value) => {
        if (live) setSlot({ value, error: null, loading: false });
      },
      (error: unknown) => {
        // The message, not a generic one: "loop unreachable" tells a person
        // which dependency to chase, and `UX-0032` is about not making them
        // open another screen to find out.
        if (live) {
          setSlot({
            value: null,
            error: error instanceof Error ? error.message : 'unknown error',
            loading: false,
          });
        }
      },
    );
    return (): void => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return slot;
}

function Region({
  title,
  slot,
  children,
}: {
  title: string;
  slot: Slot<unknown>;
  children: ReactNode;
}): ReactElement {
  return (
    <div>
      <h2>{title}</h2>
      {slot.loading ? <p className="room-region__loading">Loading {title.toLowerCase()}…</p> : null}
      {slot.error === null ? null : (
        // Darkens this region only. The other five keep their content.
        <p className="room-region__error" role="status">
          {slot.error}
        </p>
      )}
      {slot.loading || slot.error !== null ? null : children}
    </div>
  );
}

export interface ChangeRoomPageProps {
  readonly api: ChangeRoomApi;
  readonly changeRequestId: string;
  readonly projectId: string;
  /** Present when the last attempted action was refused by policy. */
  readonly refusal?: PolicyRefusalView | undefined;
}

export function ChangeRoomPage({
  api,
  changeRequestId,
  projectId,
  refusal,
}: ChangeRoomPageProps): ReactElement {
  const request = useSlot(() => api.changeRequest(changeRequestId), [changeRequestId]);
  const progress = useSlot(() => api.loopProgress(changeRequestId), [changeRequestId]);
  const impact = useSlot(() => api.changeImpact(changeRequestId), [changeRequestId]);
  const decision = useSlot(() => api.changeDecision(changeRequestId), [changeRequestId]);
  const closure = useSlot(() => api.changeClosure(changeRequestId), [changeRequestId]);
  const [options, setOptions] = useState<Slot<ChangeOptionsView>>(NOT_REQUESTED);

  return (
    <RoomShell
      objectState={
        <Region title="Object state" slot={request}>
          {request.value === null ? null : (
            <div className="room-object-state">
              <p>{request.value.requestedOutcome}</p>
              <p>
                Change request <code>{request.value.id}</code> against baseline{' '}
                <code>{request.value.targetBaselineId}</code> v{request.value.targetBaselineVersion}{' '}
                in project <code>{projectId}</code>.
              </p>
              <p>
                {/* `FR-CHR-021` — shown because a reviewer should see what was
                    claimed, and nothing here reads it to decide anything. */}
                Urgency claimed: {request.value.urgency}. Urgency is recorded and never skips a
                gate.
              </p>
              {request.value.rebasedFrom === null ? null : (
                <p>Rebased from baseline v{request.value.rebasedFrom}.</p>
              )}
            </div>
          )}
        </Region>
      }
      loopProgress={
        <Region title="Loop progress" slot={progress}>
          <LoopProgress progress={progress.value as never} error={undefined} />
        </Region>
      }
      aiAnalysis={
        <Region title="AI analysis" slot={options}>
          {options.value === null ? null : <ChangeOptionsRegion view={options.value} />}
          <button
            type="button"
            data-testid="generate-options"
            onClick={(): void => {
              setOptions(PENDING);
              api.changeOptions(changeRequestId).then(
                (value) => setOptions({ value, error: null, loading: false }),
                (error: unknown) =>
                  setOptions({
                    value: null,
                    error: error instanceof Error ? error.message : 'unknown error',
                    loading: false,
                  }),
              );
            }}
          >
            Generate options
          </button>
          <ImpactPanel slot={impact} />
        </Region>
      }
      decision={
        <Region title="Decision" slot={decision}>
          <BlockersPanel request={request.value} decision={decision.value} refusal={refusal} />
          {decision.value === null ? null : (
            <div className="change-decision">
              <p>
                Chosen: {decision.value.chosenOption.summary} — {decision.value.rationale}
              </p>
              <p>
                Decided by {decision.value.decidedBy} under {decision.value.authorityBasis}.
              </p>
              <p>
                Declined:{' '}
                {decision.value.declinedOptions.map((o) => o.summary).join(', ') || 'none'}
              </p>
            </div>
          )}
        </Region>
      }
      evidence={
        <Region title="Evidence" slot={closure}>
          {closure.value === null ? (
            // Says which of the two it is. An empty region and "nothing proved
            // it yet" look identical unless one of them says so.
            <p>This change is not closed. No validating evidence has been recorded.</p>
          ) : (
            <div className="change-evidence">
              <p>{closure.value.whatChanged}</p>
              <p>{closure.value.why}</p>
              <p>Validated by: {closure.value.evidenceRefs.join(', ')}</p>
              <p>
                Superseded by baseline {closure.value.supersedingBaselineId} (v
                {closure.value.supersedingBaselineVersion}).
              </p>
            </div>
          )}
        </Region>
      }
      activityTimeline={
        <Region title="Activity timeline" slot={request}>
          {request.value === null ? null : (
            <ul className="change-timeline">
              <li>Raised by {request.value.requester}</li>
              <li>State: {request.value.state}</li>
              {request.value.openQuestions.map((question) => (
                <li key={question.id}>
                  {question.question} — {question.answer ?? 'unanswered'}
                </li>
              ))}
            </ul>
          )}
        </Region>
      }
    />
  );
}

/**
 * `FR-CHR-030`–`FR-CHR-034` — the blast radius, in the region that holds AI
 * output.
 *
 * An area the platform could not determine reads `unknown` with its reason, and
 * the architecture panel states that `BR-0073`'s violation check has not run.
 * A blank panel would read as "no warnings", which is what an empty warnings
 * list means everywhere else a person has ever looked.
 */
function ImpactPanel({ slot }: { slot: Slot<ImpactView | null> }): ReactElement {
  if (slot.loading) return <p className="room-region__loading">Loading impact…</p>;
  if (slot.error !== null) return <p className="room-region__error">{slot.error}</p>;
  if (slot.value === null) {
    return <p>No impact view has been computed for this change yet.</p>;
  }
  return (
    <div className="change-impact">
      <ul>
        {Object.values(slot.value.areas).map((area) => (
          <li key={area.area} data-testid="impact-area" data-state={area.state}>
            {area.area}: {area.state}
            {area.itemCount === null ? '' : ` (${area.itemCount})`} — {area.detail}
          </li>
        ))}
      </ul>
      <p className="change-impact__violation-check">
        {slot.value.architecture.violationCheck.because}
      </p>
    </div>
  );
}

/**
 * `FR-CHR-083`, `FR-CHR-084`, `UX-0032`, `UX-0033` — what is blocking, without
 * opening another screen.
 */
function BlockersPanel({
  request,
  decision,
  refusal,
}: {
  request: ChangeRequestView | null;
  decision: ChangeDecisionView | null;
  refusal: PolicyRefusalView | undefined;
}): ReactElement | null {
  const blockers: string[] = [];
  if (request !== null) {
    const unanswered = request.openQuestions.filter((q) => q.answer === null);
    if (unanswered.length > 0) {
      blockers.push(`${unanswered.length} unanswered question(s)`);
    }
    if (request.state === 'open' && decision === null) {
      blockers.push('no decision has been recorded');
    }
  }

  if (refusal === undefined && blockers.length === 0) return null;

  return (
    <div className="change-blockers" data-testid="change-blockers">
      {refusal === undefined ? null : (
        <p className="change-blockers__refusal" data-testid="policy-refusal">
          {/* `UX-0033` — the refusing policy, named. Marked as a recorded fact
              rather than a recommendation: a policy said this, it is not a
              suggestion. */}
          <EpistemicMark
            value={{
              epistemic: 'fact',
              value: `Refused by policy decision ${refusal.decisionId}: ${refusal.reason}`,
            }}
          />
        </p>
      )}
      {blockers.length === 0 ? null : (
        <ul className="change-blockers__list">
          {blockers.map((blocker) => (
            <li key={blocker} data-testid="change-blocker">
              {blocker}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
