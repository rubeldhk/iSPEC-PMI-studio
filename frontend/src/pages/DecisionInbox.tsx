/**
 * `T758`, `T761` — the Decision Inbox. `BR-0192`, `FR-DPE-020`–`FR-DPE-026`,
 * `UX-0021`, `UX-0051`, styled against the `EPIC-029` system.
 *
 * Everything awaiting the reader, in one place, without opening an artifact:
 * approvals they may give, and their own work that is blocked — each naming the
 * action, the object and version it concerns, and what would unblock it. The
 * backend derives the list on every read (`R-031-4`), so this page holds no
 * queue of its own: after an approval it simply reads again.
 *
 * ## Four states, each defined (`FR-DPE-026`, `UX-0051`)
 *
 * Loading, empty, populated, error. The empty state **says so** — an Inbox that
 * renders blank because there is nothing looks identical to one that broke.
 *
 * ## Keyboard (`BR-0193`, `T761`)
 *
 * Native buttons only, in reading order, each named for the item it acts on.
 * Results are announced in a live region, and when an item leaves, focus moves
 * to the page heading rather than falling to the document body.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from '../design/components/Button';
import { EmptyState } from '../design/components/EmptyState';
import { ErrorState } from '../design/components/ErrorState';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { StatusPill } from '../design/components/StatusPill';
import { ApiError, type ApiClient, type InboxEntry } from '../services/api';

export interface DecisionInboxPageProps {
  api: ApiClient;
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; entries: InboxEntry[] };

const BAND_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const;

function describe(entry: InboxEntry): string {
  return `${entry.actionType} on ${entry.objectRef.type} ${entry.objectRef.id}`;
}

/** The reason a refused approval carries — the decision's own explanation, never a generic message. */
function refusalReason(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details as { result?: { explanation?: { authorityApplied?: string } } } | undefined;
    return details?.result?.explanation?.authorityApplied ?? error.message;
  }
  return 'The approval could not be recorded. Please try again.';
}

export function DecisionInboxPage({ api }: DecisionInboxPageProps): ReactElement {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [announcement, setAnnouncement] = useState('');
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const read = useCallback(async (): Promise<InboxEntry[] | null> => {
    try {
      const { entries } = await api.decisionInbox();
      setLoad({ state: 'ready', entries });
      return entries;
    } catch (error) {
      setLoad({
        state: 'error',
        message: error instanceof ApiError ? error.message : 'The Decision Inbox could not be read.',
      });
      return null;
    }
  }, [api]);

  useEffect(() => {
    void read();
  }, [read]);

  const approve = async (entry: InboxEntry): Promise<void> => {
    setBusy(entry.decisionId);
    try {
      await api.approveDecision(entry.decisionId);
      setRefusals(({ [entry.decisionId]: _gone, ...rest }) => rest);
      setAnnouncement(`Approved ${describe(entry)}.`);
      await read();
      heading.current?.focus();
    } catch (error) {
      const reason = refusalReason(error);
      setRefusals((r) => ({ ...r, [entry.decisionId]: reason }));
      setAnnouncement(`Approval refused: ${reason}`);
    } finally {
      setBusy(null);
    }
  };

  const approvals = load.state === 'ready' ? load.entries.filter((e) => e.kind === 'approval') : [];
  const blocked = load.state === 'ready' ? load.entries.filter((e) => e.kind !== 'approval') : [];

  const item = (entry: InboxEntry): ReactElement => (
    <li key={entry.decisionId} className="decision-inbox__item">
      <p>
        <strong>{entry.actionType}</strong>{' '}
        <span>
          {entry.objectRef.type} {entry.objectRef.id}
        </span>{' '}
        <span>v{entry.objectVersion}</span> <StatusPill tone={BAND_TONE[entry.band]}>{entry.band} band</StatusPill>
      </p>
      <p>
        Requested by <span>{entry.requestedBy}</span>
      </p>
      <p className="decision-inbox__why">{entry.blockedBy}</p>
      {refusals[entry.decisionId] !== undefined && (
        <p className="decision-inbox__refusal">{refusals[entry.decisionId]}</p>
      )}
      {entry.kind === 'approval' && (
        <Button
          variant="primary"
          loading={busy === entry.decisionId}
          disabled={busy !== null}
          onClick={() => void approve(entry)}
          aria-label={`Approve ${describe(entry)}`}
        >
          Approve
        </Button>
      )}
    </li>
  );

  return (
    <main className="decision-inbox">
      <h1 ref={heading} tabIndex={-1}>
        Decision Inbox
      </h1>
      <p role="status" aria-live="polite" className="decision-inbox__status">
        {announcement}
      </p>

      {load.state === 'loading' && <LoadingIndicator label="Loading your Decision Inbox…" />}

      {load.state === 'error' && <ErrorState message={load.message} action="Reload the page, or try again shortly." />}

      {load.state === 'ready' && load.entries.length === 0 && (
        <EmptyState
          title="Nothing is waiting for you"
          explanation="No approvals are awaiting you and none of your work is blocked. Anything that needs you will appear here."
        />
      )}

      {approvals.length > 0 && (
        <section aria-labelledby="inbox-approvals">
          <h2 id="inbox-approvals">Awaiting your approval</h2>
          <ul aria-labelledby="inbox-approvals">{approvals.map(item)}</ul>
        </section>
      )}

      {blocked.length > 0 && (
        <section aria-labelledby="inbox-blocked">
          <h2 id="inbox-blocked">Blocked</h2>
          <ul aria-labelledby="inbox-blocked">{blocked.map(item)}</ul>
        </section>
      )}
    </main>
  );
}
