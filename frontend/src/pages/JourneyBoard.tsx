/**
 * `T1585` / `T1589` / `T1596` (EPIC-044, `FR-EPB-040`, `FR-EPB-042`–`FR-EPB-049`)
 * — the Spec Journey Board: one column per stage of the product profile, one
 * card per Epic in the column of its derived stage, the unbound executions as
 * their own group. The screen names no stage of its own — the columns come from
 * the read (`FR-EPB-011`) — and offers no control that sets one (`FR-EPB-001`).
 * Readiness is shown beside the stage as a separate claim (`FR-EPB-045`).
 * Four states per `FR-SHL-060`; reflects a completed execution on reload
 * (`FR-EPB-048`), with no refresh control of its own.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type BoardRead, type Epic, type EpicStage, type UnboundArtifacts, type UnboundTasks } from '../services/api';
import { Button } from '../design/components/Button';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { Select } from '../design/components/Select';
import { TextInput } from '../design/components/TextInput';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export interface JourneyBoardPageProps {
  readonly api: ApiClient;
  readonly projectId: string;
  readonly onOpenEpic: (epicId: string) => void;
  /**
   * Opens the Epic's Task Kanban (`EPIC-046` `T1722`, `FR-KAN-050`). Optional
   * so a host that has not wired Plan & Tasks renders the board unchanged
   * rather than throwing — the board is `EPIC-044`'s and must not depend on
   * a later Epic being present.
   */
  readonly onOpenTasks?: ((epicId: string) => void) | undefined;
  /** Opens the project's executions timeline (the project screen). */
  readonly onOpenTimeline: (projectId: string) => void;
}

function whyNoNext(card: EpicStage): string {
  if (card.status === 'closed') return 'closed — no next command';
  if (card.status === 'split') return 'split — the children carry the journey';
  return 'end of the journey';
}

export function JourneyBoardPage({ api, projectId, onOpenEpic, onOpenTasks, onOpenTimeline }: JourneyBoardPageProps): ReactElement {
  const [board, setBoard] = useState<BoardRead | null>(null);
  const [epics, setEpics] = useState<Epic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [titleFilter, setTitleFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  // EPIC-045 T1683 (FR-ART-007): what the unbound executions' syncs stored.
  // Read SEPARATELY from the board, and failing separately: a board that went
  // blank because the artifacts read failed would be a regression in EPIC-044's
  // screen paid for by this Epic's addition.
  const [unboundFiles, setUnboundFiles] = useState<UnboundArtifacts | null>(null);
  const [unboundError, setUnboundError] = useState<string | null>(null);
  // EPIC-046 T1793 (FR-KAN-032): what those same executions' TASK syncs
  // parsed. Its own read, failing on its own, for the reason above.
  const [unboundTasks, setUnboundTasks] = useState<UnboundTasks | null>(null);
  const [openSync, setOpenSync] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([api.getBoard(projectId), api.listEpics(projectId)]);
    const failures: string[] = [];
    const [b, e] = results;
    if (b.status === 'fulfilled') setBoard(b.value);
    else failures.push(`stages: ${message(b.reason)}`);
    if (e.status === 'fulfilled') setEpics(e.value.epics);
    else failures.push(`epics: ${message(e.reason)}`);
    if (failures.length === results.length) setError(failures.join(' · '));
    setPartial(failures.length > 0 && failures.length < results.length ? failures : []);
    setLoading(false);
  }, [api, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let live = true;
    setUnboundError(null);
    api
      .getUnboundTasks(projectId)
      .then((answer) => {
        if (live) setUnboundTasks(answer);
      })
      .catch(() => {
        // Silent, and deliberately: the artifacts read already reports a
        // failure of this group, and two notices for one absent group would
        // tell a reader twice what they can do nothing about.
        if (live) setUnboundTasks(null);
      });
    void api
      .getUnboundArtifacts(projectId)
      .then((answer) => {
        if (live) setUnboundFiles(answer);
      })
      .catch((err: unknown) => {
        if (live) {
          setUnboundFiles(null);
          setUnboundError(message(err));
        }
      });
    return (): void => {
      live = false;
    };
  }, [api, projectId]);

  const needle = titleFilter.trim().toLowerCase();
  const visible = (board?.epics ?? []).filter((c) => (needle === '' || c.title.toLowerCase().includes(needle) || String(c.number).includes(needle)) && (stageFilter === '' || c.stage === stageFilter));
  const countOf = (epicId: string): number | null => epics?.find((e) => e.id === epicId)?.requirementCount ?? null;
  /** FR-EPB-063: a split parent names the children it became; a child names its parent and suffix. */
  const splitLine = (card: EpicStage): string | null => {
    const me = epics?.find((e) => e.id === card.epicId);
    if (card.status === 'split') {
      const children = (epics ?? []).filter((e) => e.parentEpicId === card.epicId).map((e) => e.number).sort((a, b) => a - b);
      return children.length > 0 ? `split into ${children.join(', ')}` : 'split';
    }
    if (me?.parentEpicId) {
      const parent = epics?.find((e) => e.id === me.parentEpicId);
      return `child ${me.splitSuffix ?? ''} of Epic ${parent?.number ?? '?'}`;
    }
    return null;
  };

  return (
    <section className="ds-stack">
      <PageHeader title="Spec Journey Board" description="Every Epic in the column of its stage — derived from the executions the hooks record, never set here — with the command that put it there and the command expected next." level={2} />
      {loading && <LoadingIndicator label="Loading the board" />}
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
      {partial.length > 0 && (
        <p className="ds-field__error" role="alert">
          Some of this screen did not load: {partial.join(' · ')}
        </p>
      )}

      {!loading && board !== null && (
        <>
          <div className="ds-row">
            <FormField id="board-title-filter" label="Filter by title">
              <TextInput id="board-title-filter" value={titleFilter} onChange={(ev) => setTitleFilter(ev.target.value)} />
            </FormField>
            <FormField id="board-stage-filter" label="Filter by stage">
              <Select id="board-stage-filter" value={stageFilter} onChange={(ev) => setStageFilter(ev.target.value)}>
                <option value="">all</option>
                {board.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {board.epics.length === 0 && <p className="ds-field__hint">No Epics yet. Create them in the Requirement Room; the first specify run gives each its first card.</p>}

          <div className="ds-board">
            {board.columns.map((column) => (
              <section key={column} aria-label={`Stage: ${column}`} className="ds-board__column">
                <h3>{column}</h3>
                {visible
                  .filter((c) => c.stage === column)
                  .map((c) => (
                    <article key={c.epicId} aria-label={`Epic ${c.number} · ${c.title}`} className="ds-card">
                      <p>
                        <strong>
                          Epic {c.number} · {c.title}
                        </strong>
                        {countOf(c.epicId) !== null ? ` · ${countOf(c.epicId)} requirements` : ''}
                      </p>
                      <p className="ds-field__hint">
                        Last:{' '}
                        {c.last ? (
                          <Button type="button" variant="ghost" onClick={(): void => onOpenTimeline(projectId)}>
                            {c.last.command} · {c.last.outcome} · {new Date(c.last.at).toLocaleString()}
                          </Button>
                        ) : (
                          'no execution yet'
                        )}
                      </p>
                      <p className="ds-field__hint">{c.next ? `Next: ${c.next}` : whyNoNext(c)}</p>
                      {c.running && <p className="ds-field__hint">running since {new Date(c.running.since).toLocaleString()}</p>}
                      {c.missing.length > 0 && <p className="ds-field__hint">missing: {c.missing.join(', ')}</p>}
                      {c.unrecognised.length > 0 && <p className="ds-field__hint">unrecognised command: {c.unrecognised.join(', ')}</p>}
                      {c.readiness.verdict !== 'n/a' && (
                        <p className="ds-field__hint">
                          Readiness: {c.readiness.verdict}
                          {c.readiness.note ? ` — ${c.readiness.note}` : ''}
                          {c.readiness.failing.length > 0 ? ` (${c.readiness.failing.join(', ')})` : ''}
                        </p>
                      )}
                      {c.status !== 'active' && c.status !== 'split' && <p className="ds-field__hint">{c.status}</p>}
                      {splitLine(c) !== null && <p className="ds-field__hint">{splitLine(c)}</p>}
                      <Button type="button" variant="ghost" onClick={(): void => onOpenEpic(c.epicId)}>
                        Open Epic {c.number}
                      </Button>
                      {onOpenTasks !== undefined && (
                        <Button type="button" variant="ghost" onClick={(): void => onOpenTasks(c.epicId)}>
                          Open tasks
                        </Button>
                      )}
                    </article>
                  ))}
              </section>
            ))}
          </div>

          <section aria-label="Unbound executions" className="ds-stack">
            <h3>Unbound executions</h3>
            {board.unbound.length === 0 && <p className="ds-field__hint">Every execution names an Epic of this project.</p>}
            {unboundError !== null && (
              <p className="ds-field__hint">
                The files these executions synced could not be read — {unboundError} The executions themselves are listed above.
              </p>
            )}
            {board.unbound.length > 0 && (
              <ul className="ds-list">
                {board.unbound.map((u) => {
                  // EPIC-045 T1683 (FR-ART-007): what this execution's sync
                  // stored. An unbound execution's files are reachable nowhere
                  // else — no Epic's tree lists them — so the board is where
                  // they are named or they are lost.
                  const sync = unboundFiles?.syncs.find((x) => x.executionId === u.executionId) ?? null;
                  // EPIC-046 T1793 (FR-KAN-032): and what its TASK sync parsed.
                  // Stored correctly and reachable from no Epic's board, for
                  // exactly the reason the files are.
                  const tasks = unboundTasks?.syncs.find((x) => x.executionId === u.executionId) ?? null;
                  return (
                    <li key={u.executionId}>
                      {u.command} for Epic {u.targetId} · {new Date(u.registeredAt).toLocaleString()} — no such Epic in this project; listed, never attached
                      {unboundError === null && sync === null && <span className="ds-field__hint"> · no files synced</span>}
                      {tasks !== null && (
                        <span className="ds-field__hint" data-testid="unbound-tasks">
                          {' '}
                          · {tasks.counts.parsed} task{tasks.counts.parsed === 1 ? '' : 's'} parsed
                          {tasks.counts.refused > 0 && <>, {tasks.counts.refused} refused</>}
                          {tasks.taskKeys.length > 0 && <> ({tasks.taskKeys.join(', ')})</>}
                        </span>
                      )}
                      {sync !== null && (
                        <span>
                          {' '}
                          ·{' '}
                          <button type="button" className="ds-link-button" onClick={(): void => setOpenSync(openSync === sync.syncId ? null : sync.syncId)}>
                            {sync.files.length} file{sync.files.length === 1 ? '' : 's'} synced
                          </button>
                        </span>
                      )}
                      {sync !== null && openSync === sync.syncId && (
                        <ul className="ds-list">
                          {sync.files.map((f) => (
                            <li key={f.path}>
                              <code>{f.path}</code> — {f.refusalCode ?? f.outcome}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="ds-field__hint">Stages are derived from executions · epic-stage v{board.packageVersion}</p>
          {/* FR-EPB-046 (T1616): readiness is a separate claim; the screen says where its conditions will live. */}
          <p className="ds-field__hint">Readiness conditions for this project will be configured under Governance → Constraints; none are configured today.</p>
        </>
      )}
    </section>
  );
}
