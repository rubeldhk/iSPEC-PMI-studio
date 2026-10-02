/**
 * `T1577` (EPIC-044, `FR-EPB-020`, `FR-EPB-024`, `FR-EPB-027`, `FR-EPB-041`,
 * `FR-EPB-047`) — the Epic list in the Requirement Room: a filtered table with
 * number, title, status, requirement count and the derived stage; a create
 * form gated to the owner; the unassigned requirements as their own group.
 * Four states per `FR-SHL-060`.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type BoardRead, type Epic, type EpicRequirementRef, type Project } from '../services/api';
import { Button } from '../design/components/Button';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { Table } from '../design/components/Table';
import { TextInput } from '../design/components/TextInput';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export interface EpicListPageProps {
  readonly api: ApiClient;
  readonly projectId: string;
  readonly currentUserId?: string | undefined;
  readonly onOpen: (epicId: string) => void;
}

export function EpicListPage({ api, projectId, currentUserId, onOpen }: EpicListPageProps): ReactElement {
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[] | null>(null);
  const [unassigned, setUnassigned] = useState<EpicRequirementRef[]>([]);
  const [board, setBoard] = useState<BoardRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([api.getProject(projectId), api.listEpics(projectId), api.getBoard(projectId)]);
    const failures: string[] = [];
    const [p, e, b] = results;
    if (p.status === 'fulfilled') setProject(p.value);
    else failures.push(`project: ${message(p.reason)}`);
    if (e.status === 'fulfilled') {
      setEpics(e.value.epics);
      setUnassigned(e.value.unassigned);
    } else failures.push(`epics: ${message(e.reason)}`);
    if (b.status === 'fulfilled') setBoard(b.value);
    else failures.push(`stages: ${message(b.reason)}`);
    if (failures.length === results.length) setError(failures.join(' · '));
    setPartial(failures.length > 0 && failures.length < results.length ? failures : []);
    setLoading(false);
  }, [api, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canWrite = currentUserId === undefined || project === null || project.ownerUserId === currentUserId;
  const writeReason = canWrite ? null : "Only the project's owner may create Epics or assign requirements.";
  const stageOf = (epicId: string): string => board?.epics.find((s) => s.epicId === epicId)?.stage ?? '—';

  const onCreate = (event: FormEvent): void => {
    event.preventDefault();
    setActionError(null);
    void (async (): Promise<void> => {
      try {
        await api.createEpic(projectId, { title, description });
        setTitle('');
        setDescription('');
        await load();
      } catch (err) {
        setActionError(message(err));
      }
    })();
  };

  return (
    <section className="ds-stack">
      <PageHeader title="Epics" description="Epics group this project's requirements and own its specifications. Their stage is derived from the executions the hooks record, never set by hand." level={2} />
      {loading && <LoadingIndicator label="Loading Epics" />}
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
      {actionError !== null && (
        <p className="ds-field__error" role="alert">
          {actionError}
        </p>
      )}
      {writeReason !== null && <p className="ds-field__hint">{writeReason}</p>}

      {!loading && epics !== null && (
        <Table
          caption="Epics"
          filterLabel="Filter epics"
          columns={[
            { key: 'number', header: 'Number' },
            { key: 'title', header: 'Title' },
            { key: 'status', header: 'Status' },
            { key: 'requirements', header: 'Requirements' },
            { key: 'stage', header: 'Stage' },
            { key: 'actions', header: 'Actions' },
          ]}
          rowKey={(_row, index) => epics[index]?.id ?? String(index)}
          emptyTitle="No Epics yet."
          emptyExplanation="Create one below; the first specify run will produce one specification per Epic."
          rows={epics.map((e) => ({
            number: e.number,
            title: e.title,
            status: e.status,
            requirements: e.requirementCount,
            stage: stageOf(e.id),
            actions: (
              <Button type="button" variant="ghost" onClick={(): void => onOpen(e.id)}>
                Open {e.title}
              </Button>
            ),
          }))}
        />
      )}

      {!loading && epics !== null && (
        <section aria-label="Unassigned requirements" className="ds-stack">
          <h3>Unassigned requirements</h3>
          <p className="ds-field__hint">
            {unassigned.length} {unassigned.length === 1 ? 'requirement' : 'requirements'} belong to no Epic. They are listed, never omitted; the first run cannot decompose them.
          </p>
          {unassigned.length > 0 && (
            <ul className="ds-list">
              {unassigned.map((r) => (
                <li key={r.id}>
                  {r.reference}
                  {r.status === 'retired' ? ' (retired)' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && (
        <form className="ds-stack" aria-label="Create an Epic" onSubmit={onCreate}>
          <h3>New Epic</h3>
          <FormField id="epic-title" label="Title" hint="1–120 characters; the slug is derived from it." disabled={!canWrite}>
            <TextInput id="epic-title" value={title} onChange={(ev) => setTitle(ev.target.value)} disabled={!canWrite} maxLength={120} required />
          </FormField>
          <FormField id="epic-description" label="Description" disabled={!canWrite}>
            <TextInput id="epic-description" value={description} onChange={(ev) => setDescription(ev.target.value)} disabled={!canWrite} />
          </FormField>
          <Button type="submit" variant="primary" disabled={!canWrite}>
            Create Epic
          </Button>
        </form>
      )}
    </section>
  );
}
