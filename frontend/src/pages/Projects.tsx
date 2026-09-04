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
import { ApiError, type ApiClient, type Job, type Project, type Requirement } from '../services/api';
import { JobProgress } from '../components/JobProgress';
import { Button } from '../design/components/Button';
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
      await api.createProject({ name });
      setName('');
      await refresh();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <main className="ds-page">
      <PageHeader title="Projects" />
      <form className="ds-row" onSubmit={(e) => void create(e)}>
        <FormField id="project-name" label="Project name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <Button type="submit">Create</Button>
      </form>
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
              <Button variant="ghost" onClick={() => onOpen(project.id)}>
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
}

export function ProjectDetail({ api, projectId, onBack, children }: ProjectDetailProps): ReactElement {
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
      <GenerateSpecification api={api} projectId={projectId} />
      {children}
    </main>
  );
}
