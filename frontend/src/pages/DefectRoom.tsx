/**
 * `T998z` (EPIC-035) — the Defect Room page. `FR-DFR-090`–`FR-DFR-095`,
 * `UX-0030`–`UX-0033`, `UX-0035`, `UX-0040`, `UX-0042`.
 *
 * **It composes and it does not decide.** Every region's content comes from a
 * projection somebody else owns — loop progress from `EPIC-030`, the
 * classification and the evidence from this Room's own services. The page's
 * judgement is limited to which region a projection belongs in, and it holds no
 * rule about what any outcome means: the destination is stored server-side
 * (`FR-DFR-077`) and a mapping here would be a second copy of one the database
 * already CHECKs.
 *
 * **It derives no region vocabulary.** `RoomShell` is imported and its six prop
 * names come from `@pmi/room-contract`. `T998y` compares them by comparison
 * rather than review, and that comparison is only worth running because this
 * file restates nothing.
 *
 * **Each region fails on its own.** One failed fetch darkens one region; the
 * other five still render. A page-level error boundary would be simpler and
 * would take five working regions down with the sixth — the opposite of what a
 * person needs when they are trying to find out what is blocking (`UX-0032`).
 *
 * The narrow-viewport behaviour is the shell's, not this page's
 * (`FR-DFR-095`). A Room deciding for itself which of its regions is expendable
 * is what that set exists to prevent.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { RoomShell } from '../rooms/RoomShell';
import { LoopProgress } from '../rooms/regions/LoopProgress';
import { EpistemicMark } from '../rooms/regions/Epistemic';
import type {
  DefectClassificationSummary,
  DefectEvidenceSummary,
  DefectSummary,
} from '../services/api';

/**
 * The Room reads these shapes; `services/api.ts` declares them.
 *
 * Aliased rather than restated, so the page and the client cannot drift into
 * two descriptions of one response — the shape `DEF-034-001` took one layer
 * down.
 */
export type DefectView = DefectSummary;
export type DefectClassificationView = DefectClassificationSummary;
export type DefectEvidenceView = DefectEvidenceSummary;

export interface LoopProgressRow {
  readonly stage: string;
  readonly status: string;
  readonly omitted: boolean;
}

/**
 * What the page needs, and nothing more. No method here decides anything.
 *
 * The names match `ApiClient`'s, so the shell passes the client straight
 * through and calls nothing itself. `FR-SHL-003` forbids the shell reaching a
 * domain endpoint, and an adapter built in `area-views.tsx` would be exactly
 * that with an extra step.
 */
export interface DefectRoomApi {
  loopProgress(roomObjectId: string): Promise<readonly LoopProgressRow[]>;
  defect(defectId: string): Promise<DefectView>;
  defectClassification(defectId: string): Promise<DefectClassificationView | null>;
  defectEvidence(defectId: string): Promise<DefectEvidenceView>;
}

/**
 * `FR-DFR-094`, `UX-0033` — a policy-refused action shows the refusing policy.
 *
 * A refusal that named nothing would leave a person guessing which of their
 * roles fell short, which is the same as not telling them.
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
    // The dependency list is the caller's, passed in. `react-hooks` is not
    // configured in this repository, so a disable directive for it is itself a
    // lint error — the rule that does not exist cannot be silenced.
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

export interface DefectRoomPageProps {
  readonly api: DefectRoomApi;
  readonly defectId: string;
  readonly projectId: string;
  /** Present when the last attempted action was refused by policy. */
  readonly refusal?: PolicyRefusalView | undefined;
}

export function DefectRoomPage({
  api,
  defectId,
  projectId,
  refusal,
}: DefectRoomPageProps): ReactElement {
  const defect = useSlot(() => api.defect(defectId), [defectId]);
  const progress = useSlot(() => api.loopProgress(defectId), [defectId]);
  const classification = useSlot(() => api.defectClassification(defectId), [defectId]);
  const evidence = useSlot(() => api.defectEvidence(defectId), [defectId]);

  return (
    <RoomShell
      objectState={
        <Region title="Object state" slot={defect}>
          {defect.value === null ? null : (
            <div className="room-object-state">
              <p>
                Defect <code>{defect.value.id}</code> against{' '}
                <code>{defect.value.contestedArtifactRef}</code>{' '}
                {defect.value.contestedArtifactVersion} in project <code>{projectId}</code>.
              </p>
              <p>
                {/* `FR-DFR-024` — the version REPORTED. Shown as such, because a
                    reader needs to know the report was not re-targeted. */}
                Reported against {defect.value.contestedArtifactVersion} by{' '}
                {defect.value.reportedBy}. State: {defect.value.state}. Severity:{' '}
                {defect.value.severity}.
              </p>
              <p>
                {/* `FR-DFR-012` — an unlinked defect is HELD FOR TRIAGE rather
                    than filed against an Epic somebody guessed. */}
                Epic: {defect.value.epicId ?? 'none yet — held for triage'}.
              </p>
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
        <Region title="AI analysis" slot={classification}>
          <TriagePanel classification={classification.value} />
        </Region>
      }
      decision={
        <Region title="Decision" slot={classification}>
          <BlockersPanel
            classification={classification.value}
            evidence={evidence.value}
            refusal={refusal}
          />
          {classification.value === null ? (
            // Says which of the two it is. An empty region and "nobody has
            // judged this yet" look identical unless one of them says so.
            <p>This defect has not been classified. Nothing has been judged against approved behaviour.</p>
          ) : (
            <div className="defect-decision">
              <p>
                {classification.value.outcome} → {classification.value.destination}
              </p>
              <p>{classification.value.rationale}</p>
              <p>
                Classified by {classification.value.classifiedBy} (
                {classification.value.classifiedByKind}).
              </p>
              {classification.value.absenceRecorded ? (
                // `FR-DFR-021` — the absence is a finding, and reads as one.
                <p>No approved behaviour was found. That absence is the finding.</p>
              ) : (
                <p>Judged against {classification.value.approvedBehaviourRef}.</p>
              )}
            </div>
          )}
        </Region>
      }
      evidence={
        <Region title="Evidence" slot={evidence}>
          <EvidencePanel evidence={evidence.value} />
        </Region>
      }
      activityTimeline={
        <Region title="Activity timeline" slot={defect}>
          {defect.value === null ? null : (
            <ul className="defect-timeline">
              <li>
                Reported by {defect.value.reportedBy} ({defect.value.origin})
              </li>
              <li>State: {defect.value.state}</li>
              {classification.value === null ? null : (
                <li>Classified {classification.value.outcome}</li>
              )}
              {(evidence.value?.evidenceChecks ?? []).map((check) => (
                <li key={check.id}>
                  Evidence check: {check.path} — {check.rationale}
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
 * `FR-DFR-092`, `UX-0031` — AI triage output, visibly not a recorded fact.
 *
 * The label comes from `proposedByAgent`, which the server records because the
 * confirming actor is a different question from the proposing one. The visual
 * treatment is `EPIC-029`'s through `EPIC-033`'s component: this file chooses
 * no colour and names no token, because a per-Room mapping is how one Room
 * comes to paint a recommendation like a fact.
 */
function TriagePanel({
  classification,
}: {
  classification: DefectClassificationView | null;
}): ReactElement {
  if (classification === null) {
    return <p>No triage has been proposed for this defect.</p>;
  }

  return (
    <div className="defect-triage">
      <EpistemicMark
        value={{
          epistemic: classification.proposedByAgent ? 'recommendation' : 'fact',
          value: `${classification.outcome}: ${classification.rationale}`,
        }}
      />
      <p>
        {classification.proposedByAgent
          ? 'Proposed by an agent. An agent may propose a classification and may not confirm a defect (FR-DFR-023).'
          : 'Recorded by a person, not produced by a model.'}
      </p>
    </div>
  );
}

/**
 * `FR-DFR-093`, `UX-0032` — what is blocking, without opening another screen.
 *
 * Each blocker names the route that clears it. A blocker somebody cannot act on
 * is a status message, and `T996i` recorded the same lesson for a refusal with
 * nowhere to go.
 *
 * Derived here rather than fetched because every input is already on this page.
 * `T999f` adds `GET /rooms/defect/:id/blockers` for callers that are not this
 * page; when it lands, this panel reads it instead of deriving.
 */
function BlockersPanel({
  classification,
  evidence,
  refusal,
}: {
  classification: DefectClassificationView | null;
  evidence: DefectEvidenceView | null;
  refusal: PolicyRefusalView | undefined;
}): ReactElement {
  const blockers: string[] = [];

  if (classification === null) {
    blockers.push(
      'Nothing has been classified yet. Judge it against approved behaviour at POST /rooms/defect/:id/triage.',
    );
  } else if (classification.outcome === 'change-request') {
    blockers.push(
      'This is a change request and cannot be fixed as a defect (FR-DFR-075). Transfer it at POST /rooms/defect/:id/transfer.',
    );
  } else if (classification.outcome === 'requirement-gap') {
    blockers.push(
      'This is a requirement gap: there is no approved behaviour to restore. Route it at POST /rooms/defect/:id/route-gap.',
    );
  }

  const automatable = !(evidence?.reproductions ?? []).some(
    (row) => row.reproducible === 'not-automatable',
  );
  if (evidence !== null && automatable && evidence.tests.length === 0) {
    blockers.push(
      'No failing test is on record, so no fix can be accepted (FR-DFR-041). Record one at POST /rooms/defect/:id/test.',
    );
  }

  return (
    <div data-testid="defect-blockers" className="defect-blockers">
      {refusal === undefined ? null : (
        <p data-testid="defect-refusal" className="defect-refusal" role="status">
          Refused by policy ({refusal.remedy}) on decision <code>{refusal.decisionId}</code>:{' '}
          {refusal.reason}
        </p>
      )}
      {blockers.length === 0 ? (
        <p>Nothing is blocking this defect.</p>
      ) : (
        <ul>
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * `FR-DFR-030`–`FR-DFR-044` — what has been established, by reference.
 *
 * No attestation content appears here. `FR-DFR-033` puts evidence under the
 * access rules of the artifact it concerns, and a Room rendering a payload
 * would put it under this Room's instead.
 */
function EvidencePanel({ evidence }: { evidence: DefectEvidenceView | null }): ReactElement {
  if (evidence === null) return <p>No evidence has been recorded.</p>;

  return (
    <div className="defect-evidence">
      <h3>Failing tests</h3>
      {evidence.tests.length === 0 ? (
        // "None recorded" and "none exist" read the same in an empty list, so
        // one of them says so.
        <p>None recorded. A fix cannot be accepted without one (FR-DFR-041).</p>
      ) : (
        <ul>
          {evidence.tests.map((test) => (
            <li key={test.id}>
              {test.testRef} — first seen failing {test.firstObservedFailingAt}; last run{' '}
              {test.lastRunOutcome}
            </li>
          ))}
        </ul>
      )}

      <h3>Reproductions</h3>
      {evidence.reproductions.length === 0 ? (
        <p>None recorded.</p>
      ) : (
        <ul>
          {evidence.reproductions.map((row) => (
            <li key={row.id}>
              {row.reproducible} in {row.environment} — evidence:{' '}
              {row.evidenceRefs.join(', ') || 'none'}
              {row.notAutomatableReason === null ? '' : ` (${row.notAutomatableReason})`}
            </li>
          ))}
        </ul>
      )}

      <h3>Evidence checks</h3>
      {evidence.evidenceChecks.length === 0 ? (
        <p>None. A passing reproduction run raises one (FR-DFR-044).</p>
      ) : (
        <ul>
          {evidence.evidenceChecks.map((check) => (
            <li key={check.id}>
              {check.path} by {check.resolvedBy} — {check.rationale}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
