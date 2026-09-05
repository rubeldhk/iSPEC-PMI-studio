/**
 * `T1579` / `T1589` / `T1596` (EPIC-044, `FR-EPB-022`–`FR-EPB-024`, `FR-EPB-041`,
 * `FR-EPB-045`, `FR-EPB-064`) — one Epic: description with edit, its
 * requirements with unassign and an assign control over the project's
 * unassigned requirements, its specifications, the stage card (derived from
 * executions; readiness a separate claim), parent and children with the
 * decision that created them. Four states per `FR-SHL-060`.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type EpicDetail, type EpicStage, type Project, type Requirement } from '../services/api';
import { Button } from '../design/components/Button';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { Select } from '../design/components/Select';
import { Table } from '../design/components/Table';
import { TextInput } from '../design/components/TextInput';

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export interface EpicDetailPageProps {
  readonly api: ApiClient;
  readonly epicId: string;
  readonly currentUserId?: string | undefined;
  /** Opens the project's executions timeline (the project screen). */
  readonly onOpenTimeline: (projectId: string) => void;
}

export function EpicDetailPage({ api, epicId, currentUserId, onOpenTimeline }: EpicDetailPageProps): ReactElement {
  const [epic, setEpic] = useState<EpicDetail | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stage, setStage] = useState<EpicStage | null>(null);
  const [candidates, setCandidates] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chosen, setChosen] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const failures: string[] = [];
    let detail: EpicDetail | null = null;
    try {
      detail = await api.getEpic(epicId);
      setEpic(detail);
      setTitle(detail.title);
      setDescription(detail.description);
    } catch (err) {
      failures.push(`epic: ${message(err)}`);
    }
    const rest = await Promise.allSettled([
      api.getEpicStage(epicId),
      detail ? api.getProject(detail.projectId) : Promise.reject(new Error('no project')),
      detail ? api.listRequirements(detail.projectId, {}) : Promise.reject(new Error('no project')),
    ]);
    const [s, p, r] = rest;
    if (s.status === 'fulfilled') setStage(s.value);
    else failures.push(`stage: ${message(s.reason)}`);
    if (p.status === 'fulfilled') setProject(p.value);
    else if (detail) failures.push(`project: ${message(p.reason)}`);
    if (r.status === 'fulfilled') setCandidates(r.value.filter((x) => !x.epicId));
    else if (detail) failures.push(`requirements: ${message(r.reason)}`);
    if (!detail) setError(failures.join(' · '));
    else setPartial(failures);
    setLoading(false);
  }, [api, epicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canWrite = currentUserId === undefined || project === null || project.ownerUserId === currentUserId;
  const writeReason = canWrite ? null : "Only the project's owner may edit an Epic or assign requirements.";
  const active = epic?.status === 'active';

  const run = async (work: () => Promise<unknown>): Promise<void> => {
    setActionError(null);
    try {
      await work();
      await load();
    } catch (err) {
      setActionError(message(err));
    }
  };

  const onSave = (event: FormEvent): void => {
    event.preventDefault();
    void run(async () => {
      await api.updateEpic(epicId, { title, description });
      setEditing(false);
    });
  };

  const onAssign = (event: FormEvent): void => {
    event.preventDefault();
    if (!chosen) return;
    void run(async () => {
      await api.assignRequirementEpic(chosen, epicId);
      setChosen('');
    });
  };

  return (
    <section className="ds-stack">
      <PageHeader title={epic ? `Epic ${epic.number} · ${epic.title}` : 'Epic'} description={epic ? `${epic.slug} · ${epic.status}` : undefined} level={2} />
      {loading && <LoadingIndicator label="Loading Epic" />}
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
      {writeReason !== null && !loading && <p className="ds-field__hint">{writeReason}</p>}

      {!loading && epic !== null && (
        <>
          <section aria-label="Description" className="ds-stack">
            {!editing && (
              <>
                <p>{epic.description || <em>No description.</em>}</p>
                <Button type="button" variant="ghost" disabled={!canWrite} onClick={(): void => setEditing(true)}>
                  Edit
                </Button>
              </>
            )}
            {editing && (
              <form className="ds-stack" aria-label="Edit the Epic" onSubmit={onSave}>
                <FormField id="epic-edit-title" label="Title" hint="The number never changes; the slug follows the title.">
                  <TextInput id="epic-edit-title" value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={120} required />
                </FormField>
                <FormField id="epic-edit-description" label="Description">
                  <TextInput id="epic-edit-description" value={description} onChange={(ev) => setDescription(ev.target.value)} />
                </FormField>
                <span className="ds-inline">
                  <Button type="submit" variant="primary">
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={(): void => setEditing(false)}>
                    Cancel
                  </Button>
                </span>
              </form>
            )}
          </section>

          <section aria-label="Stage" className="ds-stack">
            <h3>Stage</h3>
            {stage === null && <p className="ds-field__hint">The stage could not be derived right now.</p>}
            {stage !== null && (
              <>
                <p>
                  <strong>{stage.stage}</strong>
                  {stage.running ? ` · running since ${new Date(stage.running.since).toLocaleString()}` : ''}
                  {stage.missing.length > 0 ? ` · missing: ${stage.missing.join(', ')}` : ''}
                </p>
                <p className="ds-field__hint">
                  Last: {stage.last ? `${stage.last.command} · ${stage.last.outcome} · ${new Date(stage.last.at).toLocaleString()}` : 'no execution yet'} · Next: {stage.next ?? '—'}
                </p>
                <p className="ds-field__hint">
                  Readiness: {stage.readiness.verdict}
                  {stage.readiness.note ? ` — ${stage.readiness.note}` : ''}
                  {stage.readiness.failing.length > 0 ? ` (${stage.readiness.failing.join(', ')})` : ''}. Readiness conditions for this project are configured in Governance once a later Epic defines them; nothing here marks an Epic ready by hand.
                </p>
                <p className="ds-field__hint">derived from executions</p>
                <Button type="button" variant="ghost" onClick={(): void => onOpenTimeline(epic.projectId)}>
                  Open executions
                </Button>
              </>
            )}
          </section>

          <Table
            caption="Requirements of this Epic"
            filterLabel="Filter requirements"
            columns={[
              { key: 'reference', header: 'Reference' },
              { key: 'status', header: 'Status' },
              { key: 'actions', header: 'Actions' },
            ]}
            rowKey={(_row, index) => epic.requirements[index]?.id ?? String(index)}
            emptyTitle="No requirements assigned."
            emptyExplanation="Assign one below, or from the Requirement Room."
            rows={epic.requirements.map((r) => ({
              reference: r.reference,
              status: r.status,
              actions: (
                <Button type="button" variant="ghost" disabled={!canWrite} onClick={(): void => void run(() => api.assignRequirementEpic(r.id, null))}>
                  Unassign {r.reference}
                </Button>
              ),
            }))}
          />

          {active ? (
            <form className="ds-row" aria-label="Assign a requirement to this Epic" onSubmit={onAssign}>
              <FormField id="epic-assign" label="Assign a requirement" hint={candidates.length === 0 ? 'Every requirement of the project already belongs to an Epic.' : undefined} disabled={!canWrite}>
                <Select id="epic-assign" value={chosen} onChange={(ev) => setChosen(ev.target.value)} disabled={!canWrite}>
                  <option value="">choose…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button type="submit" variant="primary" disabled={!canWrite || chosen === ''}>
                Assign
              </Button>
            </form>
          ) : (
            <p className="ds-field__hint">This Epic is {epic.status}; it keeps its requirements and accepts no new assignment.</p>
          )}

          <section aria-label="Specifications" className="ds-stack">
            <h3>Specifications</h3>
            {epic.specifications.length === 0 && <p className="ds-field__hint">No specification belongs to this Epic yet.</p>}
            {epic.specifications.length > 0 && (
              <ul className="ds-list">
                {epic.specifications.map((s) => (
                  <li key={s.id}>{s.id}</li>
                ))}
              </ul>
            )}
          </section>

          {(epic.parent !== null || epic.children.length > 0 || epic.decisions.lastProcessed !== null) && (
            <section aria-label="Split" className="ds-stack">
              <h3>Split</h3>
              {epic.parent !== null && (
                <p>
                  Child {epic.splitSuffix ?? ''} of Epic {epic.parent.number} · {epic.parent.title}
                  {epic.decisions.createdBy ? ` — created by decision ${epic.decisions.createdBy}` : ''}
                </p>
              )}
              {epic.children.length > 0 && <p>split into {epic.children.map((c) => c.number).join(', ')}</p>}
              {epic.decisions.lastProcessed !== null && <p className="ds-field__hint">Last decision processed: {epic.decisions.lastProcessed}</p>}
            </section>
          )}
        </>
      )}
    </section>
  );
}
