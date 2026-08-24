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
import { ApiError, type ApiClient, type Project } from '../services/api';
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
      {children}
    </main>
  );
}
