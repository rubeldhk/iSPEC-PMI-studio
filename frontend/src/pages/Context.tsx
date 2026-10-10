/**
 * `T1269` (EPIC-038) — the Context inspection screen. `BR-0096`,
 * `FR-CTX-070`–`FR-CTX-074`, styled against the `EPIC-029` system.
 *
 * An **application area, not a Room** (`FR-CTX-070`, `R-038-11`). A context
 * package is assembled, used and inspected; nobody decides anything about it,
 * so this screen declares no workflow type and imports no Room shell — and
 * `context-not-a-room.spec.ts` asserts both, because an absence nobody checks
 * is one somebody adds later by analogy.
 *
 * ## What the screen shows, and what it refuses to blur
 *
 * - **Items and exclusions**, side by side (`FR-CTX-071`). Showing only items
 *   makes an empty package and a heavily filtered one look the same.
 * - **Ranked versus recorded** (`FR-CTX-072`). A relevance score is a judgement
 *   made at assembly; a source version and its authoritative status are facts.
 *   Each is marked with `data-kind` and labelled in words, not by colour alone.
 * - **Why something was excluded**, in place (`FR-CTX-073`).
 * - **Drift**, beside the retained item and never instead of it.
 *
 * Lists rather than tables, so state, provenance and exclusions wrap rather
 * than scroll sideways at 360px (`FR-CTX-074`).
 *
 * Packages are listed **per execution**: the route requires `executionId`, and
 * so does this screen. A workspace-wide listing would become the thing people
 * page through instead of the audit path (`FR-CTX-062`).
 */
import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '../design/components/Button';
import { EmptyState } from '../design/components/EmptyState';
import { ErrorState } from '../design/components/ErrorState';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { StatusPill } from '../design/components/StatusPill';
import { TextInput } from '../design/components/TextInput';
import { ApiError, type ApiClient, type ContextInspection } from '../services/api';

export interface ContextPageProps {
  api: ApiClient;
}

type Load =
  | { state: 'idle' }
  | { state: 'loading'; executionId: string }
  | { state: 'error'; message: string }
  | { state: 'ready'; executionId: string; packages: ContextInspection[] };

type Item = ContextInspection['items'][number];

function driftText(item: Item): string | null {
  return item.drift.kind === 'unchanged' ? null : item.drift.note;
}

function consequentialText(execution: ContextInspection['execution']): string {
  if (execution.consequential === true) return 'Consequential session';
  if (execution.consequential === false) return 'Not a consequential session';
  return `Consequentiality undetermined${execution.reason ? ` — ${execution.reason}` : ''}`;
}

/** `R-038-3` — "the ten most relevant" and "the eight the index surfaced" are different claims. */
function shortfallText(pkg: ContextInspection['package']): string | null {
  const { retrievalRequested: asked, retrievalReturned: got } = pkg;
  if (asked == null || got == null || got >= asked) return null;
  return `Retrieval returned ${got} of ${asked} candidates requested — a short read, so this package may be missing relevant material.`;
}

/**
 * `T1861` — `idPrefix` keeps two rendered packages from sharing element ids, so
 * each one's `aria-labelledby` names its own headings.
 */
function PackageDetail({ inspected, idPrefix }: { inspected: ContextInspection; idPrefix: string }): ReactElement {
  const { package: pkg, items, exclusions, execution } = inspected;
  const live = inspected.liveState ?? [];
  return (
    <section aria-labelledby={`${idPrefix}-package-heading`} className="context__package">
      <h2 id={`${idPrefix}-package-heading`}>{pkg.objective}</h2>
      <p>
        <StatusPill tone={pkg.state === 'refused' ? 'danger' : 'success'}>{pkg.state}</StatusPill>{' '}
        <span>
          Assembled for {pkg.actorId} ({pkg.actorRole}) within {pkg.budgetTokens} tokens and a cost of{' '}
          {String(pkg.budgetCost)},{' '}
          {pkg.embeddingModelId === null ? 'refused before anything was ranked' : `ranked by ${pkg.embeddingModelId}`}
        </span>
      </p>
      {pkg.state === 'refused' && pkg.refusalReason !== null && (
        <p className="context__refusal">
          <strong>Refused:</strong> {pkg.refusalReason}
        </p>
      )}
      <p>{consequentialText(execution)}</p>
      {execution.ran === false && (
        <p className="context__unconsumed">
          <StatusPill tone="warning">not run</StatusPill> {execution.consumption}
        </p>
      )}
      {shortfallText(pkg) !== null && <p className="context__shortfall">{shortfallText(pkg)}</p>}
      {inspected.bounded === true && (
        <p className="context__bounded">
          <StatusPill tone="warning">bounded</StatusPill> The budget excluded material — each is listed under
          Excluded, with the limit it reached (FR-CTX-035).
        </p>
      )}
      {pkg.executionHistory === 'unavailable' && (
        <p>Execution history unavailable — {pkg.executionHistoryReason}</p>
      )}
      {pkg.liveState === 'unavailable' && <p>Live state unavailable — {pkg.liveStateReason}</p>}
      {pkg.liveState === 'read' && (
        <>
          <h3 id={`${idPrefix}-live`}>Live state ({live.length})</h3>
          {live.length === 0 ? (
            <p>Live state was read and nothing was reported.</p>
          ) : (
            <ul aria-labelledby={`${idPrefix}-live`}>
              {live.map((e) => (
                <li key={e.id} data-kind="recorded">
                  {e.kind} {e.ref}: {e.state} <span>(read {e.readAt})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3 id={`${idPrefix}-included`}>Included ({items.length})</h3>
      {items.length === 0 ? (
        <p>Nothing was included.</p>
      ) : (
        <ul aria-labelledby={`${idPrefix}-included`} className="context__items">
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <strong>
                  {item.sourceType} {item.sourceId}
                </strong>
                {item.crossBoundary && (
                  <>
                    {' '}
                    <StatusPill tone="warning">
                      {/* `T1861` — a crossing between projects is not a crossing between workspaces. */}
                      {item.sourceWorkspaceId && item.sourceWorkspaceId !== pkg.workspaceId
                        ? 'crossed a workspace boundary'
                        : 'crossed a project boundary'}
                    </StatusPill>{' '}
                    <span>authorised by {item.authorisationRef}</span>
                  </>
                )}
              </p>
              <p data-kind="recorded">
                <span>Recorded: </span>
                <span>
                  version {item.sourceVersion}, {item.authoritativeStatus}
                  {item.securityClassification ? `, classified ${item.securityClassification}` : ''}
                  {item.authoritativeStatus === 'superseded' && item.supersededBy
                    ? ` by ${item.supersededBy}`
                    : ''}
                  {item.authoritativeStatus === 'undetermined' && item.undeterminedReason
                    ? ` — ${item.undeterminedReason}`
                    : ''}
                </span>
              </p>
              <p data-kind="ranked">
                <span>Ranked </span>
                <span>
                  relevance {item.relevanceScore.toFixed(2)} — {item.inclusionReason}
                </span>
              </p>
              {driftText(item) !== null && <p className="context__drift">{driftText(item)}</p>}
            </li>
          ))}
        </ul>
      )}

      <h3 id={`${idPrefix}-excluded`}>Excluded ({exclusions.length})</h3>
      {exclusions.length === 0 ? (
        <p>Nothing was excluded.</p>
      ) : (
        <ul aria-labelledby={`${idPrefix}-excluded`} className="context__exclusions">
          {exclusions.map((x) => (
            <li key={x.id}>
              <p>
                <strong>
                  {x.sourceType} {x.sourceId}
                </strong>{' '}
                <StatusPill tone="neutral">{x.reason}</StatusPill>
                {x.wasEssential && (
                  <>
                    {' '}
                    <StatusPill tone="danger">essential</StatusPill>
                  </>
                )}
              </p>
              <p>{x.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ContextPage({ api }: ContextPageProps): ReactElement {
  const [executionId, setExecutionId] = useState('');
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [open, setOpen] = useState<string | null>(null);
  // `T1835` — a package opened by id, for one bound to no execution: a refusal
  // made before an execution existed is still a fact somebody needs to see.
  const [packageId, setPackageId] = useState('');
  const [byId, setById] = useState<ContextInspection | null>(null);
  const [byIdError, setByIdError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const id = executionId.trim();
    if (id === '') return;
    setOpen(null);
    setLoad({ state: 'loading', executionId: id });
    try {
      const packages = await api.contextPackagesForExecution(id);
      setLoad({ state: 'ready', executionId: id, packages });
    } catch (error) {
      setLoad({
        state: 'error',
        message: error instanceof ApiError ? error.message : 'Context could not be read.',
      });
    }
  };

  const openById = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const id = packageId.trim();
    if (id === '') return;
    setByIdError(null);
    try {
      setById(await api.contextPackage(id));
    } catch (error) {
      setById(null);
      setByIdError(error instanceof ApiError ? error.message : 'That package could not be read.');
    }
  };

  const opened = load.state === 'ready' ? load.packages.find((p) => p.package.id === open) : undefined;

  return (
    <main className="context">
      <h1>Context</h1>
      <p>What an AI session was given, as it was given — and what was left out, and why.</p>

      <form onSubmit={(e) => void submit(e)}>
        <label htmlFor="context-execution">Execution</label>{' '}
        <TextInput
          id="context-execution"
          value={executionId}
          onChange={(e) => setExecutionId(e.target.value)}
          placeholder="Execution id"
        />{' '}
        <Button type="submit" variant="primary">
          Show context
        </Button>
      </form>

      <form onSubmit={(e) => void openById(e)}>
        <label htmlFor="context-package-id">Package id</label>{' '}
        <TextInput
          id="context-package-id"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          placeholder="Package id"
        />{' '}
        <Button type="submit" variant="secondary">
          Open package
        </Button>
      </form>
      {byIdError !== null && <ErrorState message={byIdError} action="Check the package id." />}
      {byId !== null && <PackageDetail inspected={byId} idPrefix="context-by-id" />}

      {load.state === 'loading' && <LoadingIndicator label={`Loading context for ${load.executionId}…`} />}

      {load.state === 'error' && <ErrorState message={load.message} action="Check the execution id, or try again shortly." />}

      {load.state === 'ready' && (
        <section aria-labelledby="context-packages-heading">
          <h2 id="context-packages-heading">Packages for {load.executionId}</h2>
          {load.packages.length === 0 ? (
            <EmptyState
              title="No context package was recorded"
              explanation="This execution was given no context package, or the id names no execution in this workspace."
            />
          ) : (
            <ul aria-labelledby="context-packages-heading" aria-label="Packages">
              {load.packages.map((p) => (
                <li key={p.package.id}>
                  <Button
                    variant="secondary"
                    onClick={() => setOpen(p.package.id)}
                    aria-pressed={open === p.package.id}
                  >
                    {p.package.objective}
                  </Button>{' '}
                  <StatusPill tone={p.package.state === 'refused' ? 'danger' : 'success'}>
                    {p.package.state}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {opened !== undefined && <PackageDetail inspected={opened} idPrefix="context-execution" />}
    </main>
  );
}
