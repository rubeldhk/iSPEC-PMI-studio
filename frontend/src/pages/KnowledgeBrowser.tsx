/**
 * EPIC-048 `T2381` (`FR-LRN-052`, `-073`, `-074`, `-075`) — the knowledge
 * browser: approved knowledge, its scope, status and history.
 *
 * Hosted at `/context/knowledge`, a sub-view of `EPIC-038`'s Context area, reached
 * from the Context page (`FR-LRN-070`, `UX-0003`). The route and the link are
 * `T2387`, blocked until `EPIC-038` merges; this Epic adds no navigation area.
 *
 * - Filters by project, scope, category and status go to the server; the table
 *   keeps its own row filter as well (PMI-DOC-005).
 * - Current, superseded, deprecated and not-yet-retrievable read differently —
 *   by text and tone, never by colour alone (`FR-DS-012`).
 * - The page says what it is: **approved knowledge, not authoritative** — a
 *   specification outranks it (`FR-LRN-052`).
 * - An entry's history opens in place, in order (`FR-LRN-035`).
 *
 * Four states per `FR-SHL-060`.
 */
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactElement } from 'react';
import type { KnowledgeFilter, KnowledgeHistory, KnowledgeItem, KnowledgePage, Project } from '../services/api';
import { Button } from '../design/components/Button';
import { ErrorState } from '../design/components/ErrorState';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { StatusPill } from '../design/components/StatusPill';
import { Table } from '../design/components/Table';
import { describeScope } from './inbox-details/LearningCandidateDetail';
import './inbox-details/learning.css';

/** The calls this view makes — a narrowing of `ApiClient`. */
export interface KnowledgeBrowserApi {
  listProjects(): Promise<Project[]>;
  browseKnowledge(filter?: KnowledgeFilter): Promise<KnowledgePage>;
  knowledgeHistory(entryId: string): Promise<KnowledgeHistory>;
}

export interface KnowledgeBrowserProps {
  readonly api: KnowledgeBrowserApi;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

function statusPill(row: KnowledgeItem): ReactElement {
  if (row.status === 'superseded') return <StatusPill tone="neutral">{`superseded by ${row.successorVersionId ?? 'a later version'}`}</StatusPill>;
  if (row.status === 'deprecated') return <StatusPill tone="danger">deprecated</StatusPill>;
  if (row.status === 'current') return <StatusPill tone="success">current</StatusPill>;
  return <StatusPill tone="warning">no status</StatusPill>;
}

export function KnowledgeBrowser({ api }: KnowledgeBrowserProps): ReactElement {
  const projectId = useId();
  const scopeId = useId();
  const statusId = useId();
  const categoryId = useId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<KnowledgeFilter>({});
  const [category, setCategory] = useState('');
  const [page, setPage] = useState<KnowledgePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<KnowledgeHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const load = useCallback(
    async (f: KnowledgeFilter) => {
      setError(null);
      try {
        setPage(await api.browseKnowledge(f));
      } catch (err) {
        setError(message(err));
      }
    },
    [api],
  );

  useEffect(() => {
    void api.listProjects().then(setProjects, () => setProjects([]));
  }, [api]);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const set = (key: keyof KnowledgeFilter, value: string): void => setFilter((f) => ({ ...f, [key]: value || undefined }));

  const openHistory = async (entryId: string): Promise<void> => {
    setHistoryError(null);
    try {
      setHistory(await api.knowledgeHistory(entryId));
    } catch (err) {
      setHistoryError(message(err));
    }
  };

  const rows = (page?.items ?? []).map((row) => ({
    statement: row.statement,
    category: row.category,
    scope: describeScope(row.scope),
    version: `v${row.version}`,
    status: (
      <>
        {statusPill(row)}{' '}
        {row.retrievability.outcome === 'not-yet-retrievable' && <StatusPill tone="warning">not yet retrievable</StatusPill>}
        {row.openFlags.length > 0 && <StatusPill tone="accent">{`flagged: ${row.openFlags.join(', ')}`}</StatusPill>}
      </>
    ),
    approved: `${row.approvedByKind === 'policy' ? 'by policy' : `by ${row.approvedBy}`} · ${row.classification}`,
    history: (
      <Button variant="ghost" aria-label={`History of ${row.entryId}`} onClick={() => void openHistory(row.entryId)}>
        History
      </Button>
    ),
  }));

  const versionOf = (versionId: string): string => {
    const v = history?.versions.find((x) => x.id === versionId);
    return v ? `v${v.version}` : versionId;
  };

  return (
    <div className="lrn-view">
      <PageHeader title="Knowledge" description="What the workspace has learned, as approved by people or by explicit policy." loading={page === null && error === null} />
      <p className="lrn-banner">Approved knowledge, not authoritative — an approved specification or steering rule always takes precedence.</p>

      <form
        role="search"
        aria-label="Filter knowledge by"
        className="lrn-filters"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          set('category', category.trim());
        }}
      >
        <p>
          <label htmlFor={projectId}>Project</label>
          <select id={projectId} value={filter.projectId ?? ''} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor={scopeId}>Scope</label>
          <select id={scopeId} value={filter.scope ?? ''} onChange={(e) => set('scope', e.target.value)}>
            <option value="">Any scope</option>
            <option value="project">One project</option>
            <option value="projects">A named set</option>
            <option value="workspace">Workspace</option>
          </select>
        </p>
        <p>
          <label htmlFor={statusId}>Status</label>
          <select id={statusId} value={filter.status ?? ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">Any status</option>
            <option value="current">Current</option>
            <option value="superseded">Superseded</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </p>
        <p>
          <label htmlFor={categoryId}>Category</label>
          <input id={categoryId} value={category} onChange={(e) => setCategory(e.target.value)} />
        </p>
        <div className="lrn-actions">
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </div>
      </form>

      {error !== null ? (
        <ErrorState message={error} action="Try again." />
      ) : page === null ? (
        <LoadingIndicator label="Loading knowledge" />
      ) : (
        <Table
          caption="Approved knowledge"
          filterLabel="Filter knowledge"
          columns={[
            { key: 'statement', header: 'Statement' },
            { key: 'category', header: 'Category' },
            { key: 'scope', header: 'Scope' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status' },
            { key: 'approved', header: 'Approved' },
            { key: 'history', header: 'History' },
          ]}
          rows={rows}
          emptyTitle="No approved knowledge yet"
          emptyExplanation="Candidates become knowledge only when a person or explicit policy approves them."
        />
      )}

      {historyError !== null && <p role="alert">{historyError}</p>}
      {history !== null && (
        <section className="lrn-section" aria-label={`History of entry ${history.entry.id}`}>
          <h2>History of {history.entry.subjectKey}</h2>
          {history.versions.map((v) => (
            <p key={v.id}>
              {`v${v.version}: proposed by ${v.candidate.sourceKind === 'person' ? 'person' : 'agent'} ${v.candidate.sourcePrincipalId} · approved by ${v.decision.approvedBy} (${v.decision.approvedByKind}) — ${v.statement}`}
            </p>
          ))}
          <ol className="lrn-list">
            {history.events.map((e, i) => (
              <li key={`${e.versionId}-${e.type}-${i}`}>
                {`${new Date(e.at).toISOString().slice(0, 16).replace('T', ' ')} — ${versionOf(e.versionId)} ${e.type}${e.detail ? `: ${e.detail}` : ''}`}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
