/**
 * `T403n`, `T403t`, `T403w` — the Requirement Room page. `FR-RQR-070`,
 * `FR-RQR-004`, `UX-0002`, `UX-0030`, `UX-0032`, `UX-0035`.
 *
 * **A new page beside `Requirements.tsx`, not a replacement.** The register list
 * and the governed Room are two surfaces onto the same data; swapping the first
 * for the second would remove a working screen to gain one.
 *
 * **It composes and it does not decide.** Every region's content comes from a
 * projection somebody else owns — loop progress from `EPIC-030`, readiness from
 * the backend's `readiness.projection.ts`. The page's judgement is limited to
 * which region a projection belongs in, and it holds no rule about what any of
 * them mean.
 *
 * **Each region fails on its own.** One failed fetch darkens one region; the
 * other five still render. A page-level error boundary would be simpler and
 * would take five working regions down with the sixth, which is the opposite of
 * what a person needs when they are trying to find out what is blocking.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { LoopProgress as LoopProgressRow } from '@pmi/loop-contract';
import { RoomShell } from '../rooms/RoomShell';
import { LoopProgress } from '../rooms/regions/LoopProgress';
import { Blockers, type Readiness } from '../rooms/regions/Blockers';
import { Candidates } from '../rooms/regions/Candidates';
import { Clarifications } from '../rooms/regions/Clarifications';
import { Decision } from '../rooms/regions/Decision';
import { Baseline } from '../rooms/regions/Baseline';
import type { RecordedRoomDecision, RoomCandidate, RoomClarification } from '../services/api';

/**
 * What this page needs, and nothing more.
 *
 * A narrow port rather than the whole `ApiClient`: the page is testable without
 * a transport, and what it is allowed to reach is legible in one place. There
 * is deliberately no method here that decides or approves anything — the Room
 * displays governed state, and `EPIC-030` adjudicates it.
 */
export interface RequirementRoomApi {
  loopProgress(roomObjectId: string): Promise<readonly LoopProgressRow[]>;
  /**
   * Named to match `ApiClient` exactly, so the client **structurally satisfies**
   * this port and the shell can pass it straight through. `T436m` forbids the
   * shell from calling a domain endpoint, and an adapter built there to bridge
   * two names would be doing precisely that.
   */
  roomReadiness(
    roomObjectId: string,
    projectId: string,
    evidenceContractRef?: string,
  ): Promise<Readiness>;
  /**
   * `T1188` — the four the journey needs, named to match `ApiClient` for the
   * same reason as above.
   *
   * Still nothing that decides or approves: setting a criterion and answering a
   * question are a person recording what they mean, and `EPIC-030` remains the
   * only thing that adjudicates a transition.
   */
  roomCandidates(roomObjectId: string): Promise<readonly RoomCandidate[]>;
  setCandidateCriteria(
    roomObjectId: string,
    candidateId: string,
    input: { acceptanceCriteria: readonly string[] | null; intendedForImplementation: boolean },
  ): Promise<RoomCandidate>;
  roomClarifications(roomObjectId: string): Promise<readonly RoomClarification[]>;
  answerClarification(
    roomObjectId: string,
    clarificationId: string,
    answer: string,
  ): Promise<RoomClarification>;
  /** `T1193` — the decision and baseline half of the journey. */
  roomDecisions(roomObjectId: string): Promise<readonly RecordedRoomDecision[]>;
  decideRoom(
    roomObjectId: string,
    input: {
      options: readonly unknown[];
      chosenOptionId: string;
      rationale: string;
      objectVersion?: number;
    },
  ): Promise<RecordedRoomDecision>;
  approveBaseline(
    roomObjectId: string,
    input: {
      projectId: string;
      rationale: string;
      decisionId: string;
      members: readonly { requirementVersionId: string; contentHash: string; candidateId: string }[];
      evidenceContractRef: string;
    },
  ): Promise<unknown>;
  promoteCandidate(
    roomObjectId: string,
    candidateId: string,
  ): Promise<{ requirementId: string; requirementVersionId: string; contentHash: string }>;
}

export interface RequirementRoomPageProps {
  readonly api: RequirementRoomApi;
  readonly roomObjectId: string;
  readonly projectId: string;
}

/** One fetch, three outcomes, held apart. */
interface Loaded<T> {
  readonly value: T | null;
  readonly error: string | undefined;
}

const PENDING = { value: null, error: undefined } as const;

/**
 * `T1207` — the Evidence Contract this Room's baseline is judged against.
 *
 * A constant because nothing yet attaches a Contract to a Room: `FR-EVS-021`
 * wants one attached at creation of the work it governs, and that is the rest of
 * `EPIC-032`. Named here, visibly, rather than hidden in a call — when Contracts
 * become per-Room this is the one place that changes.
 */
const EVIDENCE_CONTRACT_REF = 'ev_room';

export function RequirementRoomPage({
  api,
  roomObjectId,
  projectId,
}: RequirementRoomPageProps): ReactElement {
  const [progress, setProgress] = useState<Loaded<readonly LoopProgressRow[]>>(PENDING);
  const [readiness, setReadiness] = useState<Loaded<Readiness>>(PENDING);
  // `T1188` — the two the journey runs through. Held here rather than inside
  // each region so an edit in one refreshes what the other blocks on.
  const [candidates, setCandidates] = useState<readonly RoomCandidate[]>([]);
  const [clarifications, setClarifications] = useState<readonly RoomClarification[]>([]);
  const [decisions, setDecisions] = useState<readonly RecordedRoomDecision[]>([]);
  const [frozen, setFrozen] = useState<
    readonly { candidateId: string; requirementVersionId: string; contentHash: string }[]
  >([]);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    void api
      .loopProgress(roomObjectId)
      .then((value) => live && setProgress({ value, error: undefined }))
      .catch(() =>
        live
          ? setProgress({ value: null, error: 'Loop progress could not be loaded.' })
          : undefined,
      );
    void api
      .roomReadiness(roomObjectId, projectId, EVIDENCE_CONTRACT_REF)
      .then((value) => live && setReadiness({ value, error: undefined }))
      .catch(() =>
        live
          ? setReadiness({
              value: null,
              // Never "ready". A readiness call that failed says nothing about
              // whether anything is blocking.
              error: 'Readiness could not be loaded, so what is blocking is unknown.',
            })
          : undefined,
      );
    void api
      .roomCandidates(roomObjectId)
      .then((rows) => live && setCandidates(rows))
      .catch(() => undefined);
    void api
      .roomClarifications(roomObjectId)
      .then((rows) => live && setClarifications(rows))
      .catch(() => undefined);
    void api
      .roomDecisions(roomObjectId)
      .then((rows) => live && setDecisions(rows))
      .catch(() => undefined);
    return (): void => {
      live = false;
    };
  }, [api, roomObjectId, projectId]);

  /**
   * `T1188` — after a write, re-read rather than patching local state.
   *
   * Answering a clarification or adding a criterion changes what is **blocking**,
   * and that is computed server-side by the readiness projection. Editing the
   * local array would leave the Evidence region showing a blocker that no longer
   * exists, which is the one thing `UX-0032` asks this screen not to do.
   */
  const refresh = async (): Promise<void> => {
    const [nextCandidates, nextClarifications, nextDecisions] = await Promise.all([
      api.roomCandidates(roomObjectId),
      api.roomClarifications(roomObjectId),
      api.roomDecisions(roomObjectId),
    ]);
    setCandidates(nextCandidates);
    setClarifications(nextClarifications);
    setDecisions(nextDecisions);
    await api
      .roomReadiness(roomObjectId, projectId, EVIDENCE_CONTRACT_REF)
      .then((value) => setReadiness({ value, error: undefined }))
      .catch(() => undefined);
  };

  useEffect(() => {
    // `T403t` — focus lands on the heading when the Room opens, so a keyboard
    // user starts at the top of the Room rather than wherever the previous
    // screen left them.
    heading.current?.focus();
  }, [roomObjectId]);

  return (
    <div className="requirement-room">
      <header className="requirement-room__header">
        {/* `tabIndex={-1}` makes it programmatically focusable without adding it
            to the tab order — the pattern for moving focus on navigation. */}
        <h1 className="requirement-room__title" ref={heading} tabIndex={-1}>
          Requirement Room
        </h1>
        <p className="requirement-room__object">
          Object <code>{roomObjectId}</code>
        </p>
      </header>

      <RoomShell
        objectState={
          <div className="room-object-state">
            <h2>Object state</h2>
            <p>
              Requirement Room object <code>{roomObjectId}</code> in project <code>{projectId}</code>
              .
            </p>
          </div>
        }
        loopProgress={
          <div>
            <h2>Loop progress</h2>
            <LoopProgress progress={progress.value} error={progress.error} />
          </div>
        }
        aiAnalysis={
          <div>
            <h2>AI analysis</h2>
            <p>
              Analysis is labelled by epistemic status. Nothing here is a recorded fact until a
              person decides it is.
            </p>
            <Candidates
              candidates={candidates}
              onSetCriteria={async (candidateId, criteria, intended): Promise<void> => {
                await api.setCandidateCriteria(roomObjectId, candidateId, {
                  acceptanceCriteria: criteria,
                  intendedForImplementation: intended,
                });
                await refresh();
              }}
              onPromote={async (candidateId): Promise<void> => {
                // `T1207` — the frozen version is remembered here, because a
                // baseline member is made of it and nothing else on the page
                // carries it.
                const frozen = await api.promoteCandidate(roomObjectId, candidateId);
                setFrozen((current) => [
                  ...current.filter((f) => f.candidateId !== candidateId),
                  { candidateId, ...frozen },
                ]);
                await refresh();
              }}
            />
          </div>
        }
        decision={
          <div>
            <h2>Decision</h2>
            <Clarifications
              clarifications={clarifications}
              onAnswer={async (clarificationId, answer): Promise<void> => {
                await api.answerClarification(roomObjectId, clarificationId, answer);
                await refresh();
              }}
            />
            <Decision
              decisions={decisions}
              onDecide={async (options, chosenOptionId, rationale): Promise<void> => {
                await api.decideRoom(roomObjectId, { options, chosenOptionId, rationale });
                await refresh();
              }}
            />
            <p>A requirement decision is taken by an authorized person, and records what was not chosen.</p>
          </div>
        }
        evidence={
          <div>
            <h2>Evidence</h2>
            <Blockers readiness={readiness.value} error={readiness.error} />
            <Baseline
              blockers={readiness.value?.blockers ?? []}
              ready={readiness.value ? readiness.value.ready : null}
              onApprove={async (rationale): Promise<void> => {
                await api.approveBaseline(roomObjectId, {
                  projectId,
                  rationale,
                  decisionId: decisions[decisions.length - 1]?.id ?? '',
                  // `T1207` — the frozen versions, each carrying the candidate
                  // it came from so the criteria gate can resolve it.
                  members: frozen.map((f) => ({
                    requirementVersionId: f.requirementVersionId,
                    contentHash: f.contentHash,
                    candidateId: f.candidateId,
                  })),
                  evidenceContractRef: EVIDENCE_CONTRACT_REF,
                });
                await refresh();
              }}
            />
          </div>
        }
        activityTimeline={
          <div>
            <h2>Activity timeline</h2>
            <ExternalReviewUnavailable />
          </div>
        }
      />
    </div>
  );
}

/**
 * `T403w` — `FR-RQR-004`, `UX-0002`. The Room **states** that external review is
 * unavailable.
 *
 * Not a disabled button, and not a control that fails on click. `BR-0004` is
 * `U-02` and unowned, so there is nothing to enable later by flipping a flag —
 * a greyed-out control would imply a feature exists and this user lacks it,
 * which is a different and untrue thing.
 */
function ExternalReviewUnavailable(): ReactElement {
  return (
    <p className="requirement-room__unavailable" data-testid="external-review-unavailable">
      External stakeholder review is not available in this Room. It serves
      workspace-internal authorized identities only.
    </p>
  );
}
