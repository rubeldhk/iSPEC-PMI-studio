/**
 * T056 — project list and detail pages (US1, FR-001).
 *
 * Archive is a visible state, never a disappearance: an archived project stays
 * on screen with its content — the same rule the service enforces.
 *
 * Restyled onto the design system (EPIC-029 T896): the empty list explains
 * itself (FR-DS-021), archive is a StatusPill (text as well as colour,
 * FR-DS-012), loading is a status region.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type Job,
  type MintedConnectorCredential,
  type Project,
  type ProvisioningRecord,
  type Requirement,
  type Run,
} from '../services/api';
import { CredentialOnce } from '../components/CredentialOnce';
import { JobProgress } from '../components/JobProgress';
import { Button } from '../design/components/Button';
import { Select } from '../design/components/Select';
import { EmptyState } from '../design/components/EmptyState';
import { FormField } from '../design/components/FormField';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { StatusPill } from '../design/components/StatusPill';
import { TextInput } from '../design/components/TextInput';

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------- list

export interface ProjectsPageProps {
  api: ApiClient;
  onOpen: (projectId: string) => void;
}

export function ProjectsPage({ api, onOpen }: ProjectsPageProps): ReactElement {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState('');
  // EPIC-041 (FR-LPW-050): the local directory and its integration.
  const [rootPath, setRootPath] = useState('');
  const [agentIntegration, setAgentIntegration] = useState('');
  const [scriptType, setScriptType] = useState<'' | 'sh' | 'ps'>('');
  // The credential minted at provisioning — held only until the person moves on (FR-LPW-021).
  const [minted, setMinted] = useState<MintedConnectorCredential | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setProjects(await api.listProjects());
    } catch (err) {
      setError(message(err));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const trimmedRoot = rootPath.trim();
      const created = await api.createProject({
        name,
        ...(trimmedRoot !== '' ? { rootPath: trimmedRoot } : {}),
        ...(agentIntegration.trim() !== '' ? { agentIntegration: agentIntegration.trim() } : {}),
        ...(scriptType !== '' ? { scriptType } : {}),
      });
      setMinted(created.connectorCredential ?? null);
      setName('');
      setRootPath('');
      setAgentIntegration('');
      setScriptType('');
      await refresh();
    } catch (err) {
      setError(message(err));
    }
  }

  const open = (projectId: string): void => {
    setMinted(null);
    onOpen(projectId);
  };

  return (
    <main className="ds-page">
      <PageHeader title="Projects" />
      <form className="ds-stack" onSubmit={(e) => void create(e)}>
        <div className="ds-row">
          <FormField id="project-name" label="Project name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="project-root-path" label="Root path" hint="A directory name under the projects root. Leave empty for a project without a local directory.">
            <TextInput value={rootPath} onChange={(e) => setRootPath(e.target.value)} />
          </FormField>
        </div>
        <div className="ds-row">
          <FormField id="project-agent-integration" label="Agent integration">
            <TextInput value={agentIntegration} placeholder="platform default" onChange={(e) => setAgentIntegration(e.target.value)} />
          </FormField>
          <FormField id="project-script-type" label="Script type">
            <Select value={scriptType} onChange={(e) => setScriptType(e.target.value as '' | 'sh' | 'ps')}>
              <option value="">platform default</option>
              <option value="sh">sh</option>
              <option value="ps">ps</option>
            </Select>
          </FormField>
          <Button type="submit">Create</Button>
        </div>
        <span className="ds-field__hint">Integration and script type use the platform default unless chosen.</span>
      </form>
      {minted !== null && <CredentialOnce label={minted.label} value={minted.value} onDismiss={() => setMinted(null)} />}
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
      {projects === null && <LoadingIndicator label="Loading projects" />}
      {projects !== null && projects.length === 0 && (
        <EmptyState
          title="No projects yet."
          explanation="Nothing has been created in this workspace — the form above starts the first one."
        />
      )}
      {projects !== null && projects.length > 0 && (
        <ul className="ds-stack">
          {projects.map((project) => (
            <li key={project.id} className="ds-row">
              <Button variant="ghost" onClick={() => open(project.id)}>
                {project.name}
              </Button>
              {project.status === 'archived' && <StatusPill tone="neutral">archived</StatusPill>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- provisioning

const STATE_LABEL: Record<Project['provisioningState'], string> = {
  not_provisioned: 'Not provisioned',
  prepared: 'Prepared',
  initialisation_pending: 'Initialisation pending',
  provisioned: 'Provisioned',
  failed: 'Failed',
};

/** What the state asks of the person, in words (FR-LPW-051, FR-SHL-061). */
function stateGuidance(project: Project, latest: ProvisioningRecord | null): string {
  switch (project.provisioningState) {
    case 'prepared':
      return 'Prepared — wait. The worker is initialising the directory; this page updates when it is done.';
    case 'initialisation_pending':
      return 'Initialisation pending — no worker reached this directory. Run the setup skill (setup-PMIStudio) from the project directory with your agent to finish it.';
    case 'failed':
      return `Failed at step ${latest?.failedStep ?? 'unknown'}${latest?.failureReason ? `: ${latest.failureReason}` : ''}. Fix the cause and provision again.`;
    case 'provisioned':
      return `Provisioned${project.provisionedAt ? ` on ${project.provisionedAt}` : ''}. Open the directory with your agent.`;
    default:
      return 'No local directory. Provision one to work with your agent locally.';
  }
}

/**
 * EPIC-041 T1379 (`FR-LPW-051`): the provisioning panel — path, integration,
 * script type, engine tag, extension version and state, with the state's next
 * step in words.
 */
export function ProvisioningPanel({ api, project }: { api: ApiClient; project: Project }): ReactElement {
  // T1397 (FR-LPW-051, FR-SHL-060): the history has its own loading and error
  // states, distinct from the project's — `undefined` is loading.
  const [latest, setLatest] = useState<ProvisioningRecord | null | undefined>(project.latestProvisioning);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (project.latestProvisioning !== undefined) {
      setLatest(project.latestProvisioning);
      return;
    }
    void (async (): Promise<void> => {
      try {
        const [first] = await api.listProvisioning(project.id);
        setLatest(first ?? null);
      } catch (err) {
        setHistoryError(message(err));
        setLatest(null);
      }
    })();
  }, [api, project]);

  const record = latest ?? null;
  return (
    <section className="ds-stack" aria-label="Local workspace" role="region">
      <h2>Local workspace</h2>
      {latest === undefined && project.rootPath !== null && <LoadingIndicator label="Loading provisioning history" />}
      {historyError !== null && (
        <p className="ds-field__error" role="alert">
          {historyError}
        </p>
      )}
      {project.rootPath === null ? (
        <p className="ds-field__hint">{stateGuidance(project, record)}</p>
      ) : (
        <>
          <dl>
            <dt>Path</dt>
            <dd>
              <code>{project.rootPath}</code>
            </dd>
            <dt>Agent integration</dt>
            <dd>{project.agentIntegration ?? '—'}</dd>
            <dt>Script type</dt>
            <dd>{project.scriptType ?? '—'}</dd>
            <dt>Engine tag</dt>
            <dd>{record?.engineTag ?? '—'}</dd>
            <dt>Extension version</dt>
            <dd>{record?.bundleVersion ?? '—'}</dd>
            <dt>State</dt>
            <dd>
              <StatusPill tone={project.provisioningState === 'failed' ? 'danger' : project.provisioningState === 'provisioned' ? 'success' : 'neutral'}>
                {STATE_LABEL[project.provisioningState]}
              </StatusPill>
            </dd>
          </dl>
          <p className="ds-field__hint" role="status">
            {stateGuidance(project, record)}
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- run

/** States after which the run will not change on its own (`run-mode.service.ts`). */
const RUN_SETTLED = new Set(['reached_stop_point', 'failed', 'cancelled']);

/**
 * T1394 (`FR-LPW-042`, US4/AC3): a run is startable from the project screen
 * and its progress readable there. `POST /projects/:id/runs` existed since
 * EPIC-023 and nothing on the project screen called it.
 */
export function StartRun({ api, projectId, pollMs = 2000 }: { api: ApiClient; projectId: string; pollMs?: number }): ReactElement {
  const [mode, setMode] = useState('autopilot');
  const [stopRange, setStopRange] = useState('specify');
  const [run, setRun] = useState<Run | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(): Promise<void> {
    setError(null);
    setStarting(true);
    try {
      setRun(await api.startRun(projectId, { mode, stopRange }));
    } catch (err) {
      setError(message(err));
    } finally {
      setStarting(false);
    }
  }

  // Refresh the run from the project's list until it settles (there is no
  // single-run read on the contract; the list is the real entry point).
  useEffect(() => {
    if (run === null || RUN_SETTLED.has(run.state)) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async (): Promise<void> => {
        try {
          const latest = (await api.listRuns(projectId)).find((r) => r.id === run.id);
          if (!cancelled && latest !== undefined) setRun(latest);
        } catch {
          // transient — the next tick retries
        }
      })();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, projectId, run, pollMs]);

  return (
    <section className="ds-stack" aria-labelledby="start-run-heading">
      <h2 id="start-run-heading">Run</h2>
      <div className="ds-row">
        <FormField id="run-mode" label="Run mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="autopilot">autopilot</option>
            <option value="interactive">interactive</option>
          </Select>
        </FormField>
        <FormField id="run-stop-range" label="Stop after">
          <Select value={stopRange} onChange={(e) => setStopRange(e.target.value)}>
            <option value="specify">specify</option>
            <option value="plan">plan</option>
            <option value="tasks">tasks</option>
            <option value="implement">implement</option>
          </Select>
        </FormField>
        <Button type="button" disabled={starting} onClick={() => void start()}>
          Start run
        </Button>
      </div>
      {starting && <LoadingIndicator label="Starting run" />}
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
      {run === null && !starting && <p className="ds-field__hint">No run started yet from this screen.</p>}
      {run !== null && (
        <p role="status" aria-label="Run progress">
          Run {run.id}: {run.state}
          {run.stoppedAtSelectedRange && <> — stopped after {run.stopRange}, as asked</>}
          {run.outcomeReason !== null && <> — {run.outcomeReason}</>}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- generate

/**
 * EPIC-041 T1376 (`FR-LPW-041`, `FR-LPW-042`): the route
 * `POST /projects/:id/jobs/generate-specification` existed since EPIC-005 and
 * nothing on screen called it (`R-041-11`). This control does. The four
 * `FR-SHL-060` states of the requirement picker are distinct: loading, empty,
 * error, ready.
 */
export function GenerateSpecification({ api, projectId }: { api: ApiClient; projectId: string }): ReactElement {
  const [requirements, setRequirements] = useState<Requirement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const rows = await api.listRequirements(projectId, { status: 'active' });
        setRequirements(rows.filter((r) => r.status === 'active'));
      } catch (err) {
        setLoadError(message(err));
      }
    })();
  }, [api, projectId]);

  const toggle = (id: string): void => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  async function generate(): Promise<void> {
    setSubmitError(null);
    try {
      setJob(await api.generateSpecification(projectId, selected));
    } catch (err) {
      setSubmitError(message(err));
    }
  }

  return (
    <section className="ds-stack" aria-labelledby="generate-specification-heading">
      <h2 id="generate-specification-heading">Generate specification</h2>
      {loadError !== null && (
        <p className="ds-field__error" role="alert">
          {loadError}
        </p>
      )}
      {loadError === null && requirements === null && <LoadingIndicator label="Loading requirements" />}
      {requirements !== null && requirements.length === 0 && (
        <EmptyState
          title="No requirements to generate from."
          explanation="Add at least one active requirement below; a specification is generated from a selection of them."
        />
      )}
      {requirements !== null && requirements.length > 0 && (
        <ul className="ds-stack">
          {requirements.map((requirement) => (
            <li key={requirement.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(requirement.id)}
                  onChange={() => toggle(requirement.id)}
                />{' '}
                {requirement.reference} — {requirement.description}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="ds-row">
        <Button type="button" disabled={selected.length === 0} onClick={() => void generate()}>
          Generate specification
        </Button>
        {selected.length === 0 && <span className="ds-field__hint">Select at least one requirement to generate from.</span>}
      </div>
      {submitError !== null && (
        <p className="ds-field__error" role="alert">
          {submitError}
        </p>
      )}
      {job !== null && (
        <p>
          <JobProgress api={api} jobId={job.id} />
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- detail

export interface ProjectDetailProps {
  api: ApiClient;
  projectId: string;
  onBack: () => void;
  /** The register lives with its project; injected so this file stays a page. */
  children?: ReactElement | null;
  /** How often the run progress refreshes; tests shorten it. */
  pollMs?: number;
}

export function ProjectDetail({ api, projectId, onBack, children, pollMs }: ProjectDetailProps): ReactElement {
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const loaded = await api.getProject(projectId);
        setProject(loaded);
        setName(loaded.name);
      } catch (err) {
        setError(message(err));
      }
    })();
  }, [api, projectId]);

  async function rename(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      setProject(await api.updateProject(projectId, { name }));
    } catch (err) {
      setError(message(err));
    }
  }

  async function archive(): Promise<void> {
    setError(null);
    try {
      setProject(await api.archiveProject(projectId));
    } catch (err) {
      setError(message(err));
    }
  }

  if (project === null) {
    return (
      <main className="ds-page">
        {error !== null ? (
          <p className="ds-field__error" role="alert">
            {error}
          </p>
        ) : (
          <LoadingIndicator label="Loading…" />
        )}
      </main>
    );
  }

  return (
    <main className="ds-page">
      <div className="ds-row">
        <Button variant="ghost" onClick={onBack}>
          Back to projects
        </Button>
      </div>
      <PageHeader
        title={project.name}
        actions={
          project.status === 'active' ? (
            <Button variant="danger" onClick={() => void archive()}>
              Archive
            </Button>
          ) : null
        }
      />
      {project.status === 'archived' && (
        <p className="ds-field__hint">This project is archived. Its content is preserved.</p>
      )}
      {project.description !== null && <p>{project.description}</p>}
      <form className="ds-row" onSubmit={(e) => void rename(e)}>
        <FormField id="project-rename" label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <Button type="submit">Rename</Button>
      </form>
      {error !== null && (
        <p className="ds-field__error" role="alert">
          {error}
        </p>
      )}
      <ProvisioningPanel api={api} project={project} />
      <GenerateSpecification api={api} projectId={projectId} />
      <StartRun api={api} projectId={projectId} {...(pollMs !== undefined ? { pollMs } : {})} />
      {children}
    </main>
  );
}
