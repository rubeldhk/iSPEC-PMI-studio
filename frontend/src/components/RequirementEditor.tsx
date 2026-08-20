/**
 * T072 — the requirement editor and version history view (US2, FR-007, FR-009).
 *
 * Two rules made visible:
 * - An empty description is refused NAMING the field — client-side first for
 *   immediacy, and the server's named-field refusal renders identically, so
 *   a bypassed client still reads the same message (FR-007).
 * - History is shown newest first and is read-only; prior text is retrievable,
 *   never editable (FR-009).
 */
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type Requirement,
  type RequirementVersion,
} from '../services/api';

export interface RequirementEditorProps {
  api: ApiClient;
  projectId: string;
  /** Present = edit this requirement; absent = create a new one. */
  requirement?: Requirement;
  onSaved: (saved: Requirement) => void;
}

const TYPES = ['business', 'functional', 'non_functional', 'constraint'];
const PRIORITIES = ['p1', 'p2', 'p3'];

export function RequirementEditor({
  api,
  projectId,
  requirement,
  onSaved,
}: RequirementEditorProps): ReactElement {
  const [description, setDescription] = useState(requirement?.description ?? '');
  const [type, setType] = useState<string>(requirement?.type ?? 'functional');
  const [priority, setPriority] = useState<string>(requirement?.priority ?? 'p2');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RequirementVersion[] | null>(null);

  useEffect(() => {
    if (!requirement) return;
    void (async (): Promise<void> => {
      try {
        setHistory(await api.listRequirementVersions(requirement.id));
      } catch {
        setHistory([]);
      }
    })();
  }, [api, requirement]);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    // FR-007, client half: refuse before the wire, naming the field.
    if (description.trim() === '') {
      setError('description is required.');
      return;
    }

    const input = { description, type, priority };
    try {
      const saved = requirement
        ? await api.updateRequirement(requirement.id, input)
        : await api.createRequirement(projectId, input);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors().length > 0) {
        // FR-007, server half: the same named-field message shape.
        setError(err.fieldErrors().map((f) => `${f.field} is ${f.reason}.`).join(' '));
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save the requirement.');
      }
    }
  }

  return (
    <section>
      <h3>{requirement ? `Edit ${requirement.reference}` : 'New requirement'}</h3>
      <form onSubmit={(e) => void save(e)}>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save</button>
      </form>
      {error !== null && <p role="alert">{error}</p>}

      {requirement && (
        <div>
          <h4>History</h4>
          {history !== null && history.length === 0 && <p>No earlier versions.</p>}
          {history !== null && history.length > 0 && (
            <ol>
              {history.map((version) => (
                <li key={version.id}>
                  <span>{version.description}</span>
                  {' — '}
                  {version.type}, {version.priority}, {version.authoredAt}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
