/**
 * T056 — project list and detail pages (US1, FR-001).
 *
 * Archive is a visible state, never a disappearance: an archived project stays
 * on screen with its content — the same rule the service enforces.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Project } from '../services/api';

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
    <main>
      <h1>Projects</h1>
      <form onSubmit={(e) => void create(e)}>
        <label>
          Project name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit">Create</button>
      </form>
      {error !== null && <p role="alert">{error}</p>}
      {projects !== null && projects.length === 0 && <p>No projects yet.</p>}
      {projects !== null && projects.length > 0 && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onOpen(project.id)}>
                {project.name}
              </button>
              {project.status === 'archived' && <em> (archived)</em>}
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
      <main>
        {error !== null ? <p role="alert">{error}</p> : <p>Loading…</p>}
      </main>
    );
  }

  return (
    <main>
      <button type="button" onClick={onBack}>
        Back to projects
      </button>
      <h1>{project.name}</h1>
      {project.status === 'archived' && <p>This project is archived. Its content is preserved.</p>}
      {project.description !== null && <p>{project.description}</p>}
      <form onSubmit={(e) => void rename(e)}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit">Rename</button>
      </form>
      {project.status === 'active' && (
        <button type="button" onClick={() => void archive()}>
          Archive
        </button>
      )}
      {error !== null && <p role="alert">{error}</p>}
      {children}
    </main>
  );
}
