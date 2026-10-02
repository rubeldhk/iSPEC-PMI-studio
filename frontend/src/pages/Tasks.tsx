/**
 * T104 — the task list and progress view (EPIC-012 US4).
 *
 * Progress is read from the server aggregate, never recomputed client-side —
 * the same number every member sees (US4 scenario 3).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type ProjectProgress, type Task } from '../services/api';

const STATUS_LABELS: ReadonlyArray<{ value: Task['status']; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export interface TasksPageProps {
  api: ApiClient;
  specificationId: string;
  projectId: string;
}

export function TasksPage({ api, specificationId, projectId }: TasksPageProps): ReactElement {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [taskRows, projectProgress] = await Promise.all([
        api.listTasks(specificationId),
        api.getProjectProgress(projectId),
      ]);
      setTasks(taskRows);
      setProgress(projectProgress);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, [api, specificationId, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatus(taskId: string, status: Task['status']): Promise<void> {
    setError(null);
    try {
      await api.updateTaskStatus(taskId, status);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (error !== null && tasks === null) {
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (tasks === null || progress === null) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Tasks</h1>
      <section aria-label="Project progress">
        <p>
          <strong>{progress.percentComplete}%</strong> complete
        </p>
        <p>
          <span>{progress.done} done</span> · <span>{progress.inProgress} in progress</span> ·{' '}
          <span>{progress.notStarted} not started</span>
          {progress.blocked > 0 && (
            <>
              {' '}
              · <span>{progress.blocked} blocked</span>
            </>
          )}
        </p>
        {/*
          `EPIC-046` `T1780`/`T1786`. This figure and the one on Plan &amp; Tasks are
          the SAME derivation, and a denominator that silently drops rows is worse
          than one that explains itself (`FR-KAN-058`).
        */}
        <p className="ds-field__hint" data-testid="progress-basis">
          The same figure as Plan &amp; Tasks, from one derivation. It counts every task of the project&apos;s Epics plus
          any generated for a specification, and excludes tasks the latest <code>tasks.md</code> parse no longer contains.
        </p>
      </section>
      {tasks.length === 0 ? (
        <p>No tasks yet — generate them from an approved specification.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.description}</span>{' '}
              <label>
                Status
                <select
                  value={task.status}
                  onChange={(e) => void setStatus(task.id, e.target.value as Task['status'])}
                >
                  {STATUS_LABELS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error !== null && <p role="alert">{error}</p>}
    </main>
  );
}
