/**
 * EPIC-042 `T1514` (`FR-EXT-065`–`FR-EXT-068`, `R-042-10`) — the Constraints
 * screen: the first delivered screen of the Governance area. Per project: the
 * owner's entries by kind (principle, constraint, non-goal) with add, edit,
 * reorder and retire; the decomposition policy and the offline mode; and a
 * read-only preview of the constitution PMI Studio renders from them, with its
 * version and digest. The *Governed Execution* section is owned by PMI Studio
 * and is not editable here. *File differs* is shown while a workstation's last
 * report says its file matches an earlier render or none (`FR-EXT-067`).
 *
 * Four states per `FR-SHL-060`; every table has a filter (PMI-DOC-005).
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type ConstitutionRender,
  type ConstraintKind,
  type DecompositionPolicy,
  type Project,
  type ProjectConstraint,
  type WorkstationConnection,
} from '../services/api';
import { Button } from '../design/components/Button';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { Table } from '../design/components/Table';
import { TextInput } from '../design/components/TextInput';

const KINDS: { kind: ConstraintKind; label: string; caption: string }[] = [
  { kind: 'principle', label: 'Principle', caption: 'Principles' },
  { kind: 'constraint', label: 'Constraint', caption: 'Constraints' },
  { kind: 'non_goal', label: 'Non-goal', caption: 'Non-goals' },
];

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export interface ConstraintsPageProps {
  readonly api: ApiClient;
  readonly projectId: string;
  /** The signed-in user; when known, forms are disabled for anyone but the owner with the reason shown. */
  readonly currentUserId?: string | undefined;
}

export function ConstraintsPage({ api, projectId, currentUserId }: ConstraintsPageProps): ReactElement {
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<ProjectConstraint[] | null>(null);
  const [policy, setPolicy] = useState<DecompositionPolicy | null>(null);
  const [render, setRender] = useState<ConstitutionRender | null>(null);
  const [connections, setConnections] = useState<WorkstationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newKind, setNewKind] = useState<ConstraintKind>('principle');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [editing, setEditing] = useState<ProjectConstraint | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [policyDraft, setPolicyDraft] = useState<Omit<DecompositionPolicy, 'version'> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      api.getProject(projectId),
      api.listConstraints(projectId),
      api.getPolicy(projectId),
      api.getConstitution(projectId),
      api.listWorkstationConnections(projectId),
    ]);
    const failures: string[] = [];
    const [p, e, pol, r, c] = results;
    if (p.status === 'fulfilled') setProject(p.value);
    else failures.push(`project: ${message(p.reason)}`);
    if (e.status === 'fulfilled') setEntries(e.value);
    else failures.push(`constraints: ${message(e.reason)}`);
    if (pol.status === 'fulfilled') {
      setPolicy(pol.value);
      const { version: _v, ...draft } = pol.value;
      setPolicyDraft(draft);
    } else failures.push(`policy: ${message(pol.reason)}`);
    if (r.status === 'fulfilled') setRender(r.value);
    else failures.push(`constitution: ${message(r.reason)}`);
    if (c.status === 'fulfilled') setConnections(c.value);
    else failures.push(`workstations: ${message(c.reason)}`);
    if (failures.length === results.length) setError(failures.join(' · '));
    setPartial(failures.length > 0 && failures.length < results.length ? failures : []);
    setLoading(false);
  }, [api, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canWrite = currentUserId === undefined || project === null || project.ownerUserId === currentUserId;
  const writeReason = canWrite ? null : "Only the project's owner may change constraints and the policy.";

  const run = async (work: () => Promise<unknown>): Promise<void> => {
    setActionError(null);
    try {
      await work();
      await load();
    } catch (err) {
      setActionError(message(err));
    }
  };

  const onAdd = (event: FormEvent): void => {
    event.preventDefault();
    void run(async () => {
      await api.createConstraint(projectId, { kind: newKind, title: newTitle, body: newBody });
      setNewTitle('');
      setNewBody('');
    });
  };

  const onSaveEdit = (event: FormEvent): void => {
    event.preventDefault();
    if (!editing) return;
    const id = editing.id;
    void run(async () => {
      await api.updateConstraint(projectId, id, { title: editTitle, body: editBody });
      setEditing(null);
    });
  };

  const onSavePolicy = (event: FormEvent): void => {
    event.preventDefault();
    if (!policyDraft) return;
    void run(() => api.putPolicy(projectId, policyDraft));
  };

  const move = (entry: ProjectConstraint, direction: -1 | 1): void => {
    const siblings = (entries ?? []).filter((e) => e.kind === entry.kind && e.status === 'active').sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((e) => e.id === entry.id);
    const other = siblings[index + direction];
    if (!other) return;
    void run(async () => {
      await api.reorderConstraint(projectId, entry.id, other.order);
      await api.reorderConstraint(projectId, other.id, entry.order);
    });
  };

  const differing = connections.filter((c) => c.constitutionState === 'drift' || c.constitutionState === 'stale');

  return (
    <main className="ds-stack">
      <PageHeader title="Constraints" description="What this project's constitution is rendered from. The file in every workstation is generated from these; change it here, never by hand." />
      {loading && <LoadingIndicator label="Loading constraints" />}
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
      {differing.length > 0 && (
        <p role="status" aria-label="Constitution file differs" className="ds-field__error">
          File differs on{' '}
          {differing
            .map((c) => `${c.label} (${c.constitutionState === 'stale' ? (c.constitutionRenderVersion != null ? `matches render v${c.constitutionRenderVersion}` : 'matches an earlier render') : 'matches no render'}${c.constitutionReportedAt ? `, reported ${new Date(c.constitutionReportedAt).toLocaleString()}` : ''})`)
            .join('; ')}
          . The next governed command on that workstation refreshes a stale file and asks before replacing a drifted one.
        </p>
      )}
      {writeReason !== null && <p className="ds-field__hint">{writeReason}</p>}

      {!loading && entries !== null && (
        <>
          {KINDS.map(({ kind, caption }) => {
            const rows = entries.filter((e) => e.kind === kind && e.status === 'active').sort((a, b) => a.order - b.order);
            return (
              <section key={kind} aria-label={caption} className="ds-stack">
                <Table
                  caption={caption}
                  filterLabel={`Filter ${caption.toLowerCase()}`}
                  columns={[
                    { key: 'order', header: 'Order' },
                    { key: 'title', header: 'Title' },
                    { key: 'body', header: 'Body' },
                    { key: 'version', header: 'Version' },
                    { key: 'actions', header: 'Actions' },
                  ]}
                  rowKey={(_row, index) => rows[index]?.id ?? String(index)}
                  emptyTitle={`No ${caption.toLowerCase()} yet.`}
                  emptyExplanation="Add one below; the constitution's section keeps its heading until then."
                  rows={rows.map((e) => ({
                    order: e.order,
                    title: e.title,
                    body: e.body.length > 120 ? `${e.body.slice(0, 120)}…` : e.body,
                    version: e.version,
                    actions: (
                      <span className="ds-inline">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!canWrite}
                          onClick={(): void => {
                            setEditing(e);
                            setEditTitle(e.title);
                            setEditBody(e.body);
                          }}
                        >
                          Edit {e.title}
                        </Button>
                        <Button type="button" variant="ghost" disabled={!canWrite} onClick={(): void => move(e, -1)}>
                          Move up {e.title}
                        </Button>
                        <Button type="button" variant="ghost" disabled={!canWrite} onClick={(): void => move(e, 1)}>
                          Move down {e.title}
                        </Button>
                        <Button type="button" variant="danger" disabled={!canWrite} onClick={(): void => void run(() => api.retireConstraint(projectId, e.id))}>
                          Retire {e.title}
                        </Button>
                      </span>
                    ),
                  }))}
                />
              </section>
            );
          })}

          {editing !== null && (
            <form onSubmit={onSaveEdit} className="ds-stack" aria-label={`Edit ${editing.title}`}>
              <FormField id="edit-title" label="Title">
                <TextInput id="edit-title" value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)} required maxLength={120} />
              </FormField>
              <FormField id="edit-body" label="Body">
                <textarea id="edit-body" className="ds-input" value={editBody} onChange={(ev) => setEditBody(ev.target.value)} rows={4} />
              </FormField>
              <span className="ds-inline">
                <Button type="submit" variant="primary">
                  Save changes
                </Button>
                <Button type="button" variant="secondary" onClick={(): void => setEditing(null)}>
                  Cancel
                </Button>
              </span>
            </form>
          )}

          <form onSubmit={onAdd} className="ds-stack" aria-label="Add an entry">
            <FormField id="new-kind" label="Kind">
              <select id="new-kind" className="ds-input" value={newKind} onChange={(ev) => setNewKind(ev.target.value as ConstraintKind)} disabled={!canWrite}>
                {KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="new-title" label="Title">
              <TextInput id="new-title" value={newTitle} onChange={(ev) => setNewTitle(ev.target.value)} required maxLength={120} disabled={!canWrite} />
            </FormField>
            <FormField id="new-body" label="Body">
              <textarea id="new-body" className="ds-input" value={newBody} onChange={(ev) => setNewBody(ev.target.value)} rows={3} disabled={!canWrite} />
            </FormField>
            <Button type="submit" variant="primary" disabled={!canWrite || newTitle.trim().length === 0}>
              Add entry
            </Button>
          </form>
        </>
      )}

      {!loading && policyDraft !== null && policy !== null && (
        <form onSubmit={onSavePolicy} className="ds-stack" aria-label="Decomposition policy">
          <h2>Decomposition policy and offline mode</h2>
          <p className="ds-field__hint">Version {policy.version}. Rendered into the constitution's Decomposition Policy and Governed Execution sections.</p>
          <FormField id="policy-one-spec" label="One specification per Epic">
            <input id="policy-one-spec" type="checkbox" checked={policyDraft.oneSpecPerEpic} onChange={(ev) => setPolicyDraft({ ...policyDraft, oneSpecPerEpic: ev.target.checked })} disabled={!canWrite} />
          </FormField>
          <FormField id="policy-ceiling" label="Task ceiling">
            <TextInput id="policy-ceiling" type="number" min={1} max={500} value={policyDraft.taskCeiling} onChange={(ev) => setPolicyDraft({ ...policyDraft, taskCeiling: Number(ev.target.value) })} disabled={!canWrite} />
          </FormField>
          <FormField id="policy-confirm" label="A split needs a person's confirmation">
            <input id="policy-confirm" type="checkbox" checked={policyDraft.splitRequiresConfirmation} onChange={(ev) => setPolicyDraft({ ...policyDraft, splitRequiresConfirmation: ev.target.checked })} disabled={!canWrite} />
          </FormField>
          <FormField id="policy-offline" label="Offline mode" hint="Strict stops a governed command when PMI Studio is unreachable; provisional queues a record that is not governed until reconciled.">
            <select id="policy-offline" className="ds-input" value={policyDraft.offlineMode} onChange={(ev) => setPolicyDraft({ ...policyDraft, offlineMode: ev.target.value as 'strict' | 'provisional' })} disabled={!canWrite}>
              <option value="strict">strict</option>
              <option value="provisional">provisional</option>
            </select>
          </FormField>
          <Button type="submit" variant="primary" disabled={!canWrite}>
            Save policy
          </Button>
        </form>
      )}

      {!loading && render !== null && (
        <section aria-label="Constitution preview" className="ds-stack">
          <h2>Constitution preview</h2>
          <p className="ds-field__hint">
            Version {render.version} · digest <code>{render.digest}</code> · rendered {new Date(render.renderedAt).toLocaleString()}
          </p>
          <p className="ds-field__hint">The Governed Execution section is owned by PMI Studio and is the same in every project; it cannot be edited here.</p>
          {entries?.some((e) => e.status === 'active' && e.title.trim().toLowerCase() === 'governed execution') && (
            // T1546 (edge case): an owner's entry with that title never replaces the invariant section.
            <p className="ds-field__hint" role="note">
              An entry titled Governed Execution is filed under its own kind above (Core Principles, Constraints or Non-goals); the Governed Execution section stays PMI Studio's invariant text and is not replaced by it.
            </p>
          )}
          <pre className="ds-code" aria-label="Rendered constitution">
            {render.content}
          </pre>
        </section>
      )}
    </main>
  );
}
