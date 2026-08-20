/**
 * T141 — the engine selection control (US8, FR-019).
 *
 * Selection is per PROJECT: the control saves through
 * `PATCH /projects/{id}` — the route the contract assigns to selection — and
 * offers "inherit default" as a real choice, because null selection is the
 * resolver's inherit contract (T035), not an unset field.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError, type ApiClient, type Engine, type Project } from '../services/api';

export interface EngineSelectorProps {
  api: ApiClient;
  projectId: string;
  /** The project's current selection; null = inherit the deployment default. */
  value: string | null;
  onSelected?: (project: Project) => void;
}

export function EngineSelector({ api, projectId, value, onSelected }: EngineSelectorProps): ReactElement {
  const [engines, setEngines] = useState<Engine[] | null>(null);
  const [selected, setSelected] = useState<string>(value ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setEngines(await api.listEngines());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the engine list.');
      }
    })();
  }, [api]);

  async function choose(name: string): Promise<void> {
    setError(null);
    setSelected(name);
    try {
      const project = await api.updateProject(projectId, {
        engineName: name === '' ? null : name,
      });
      onSelected?.(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the engine selection.');
    }
  }

  const current = engines?.find((engine) => engine.name === selected);

  return (
    <div>
      <label>
        Engine
        <select value={selected} onChange={(e) => void choose(e.target.value)}>
          <option value="">Inherit default</option>
          {(engines ?? []).map((engine) => (
            <option key={engine.name} value={engine.name}>
              {engine.name} {engine.version}
              {engine.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
      {/* What the chosen engine can do — capabilities, not only a name. */}
      {current && <p>Capabilities: {current.capabilities.join(', ')}</p>}
      {!current && engines !== null && engines.length > 0 && (
        <p>
          Capabilities:{' '}
          {(engines.find((engine) => engine.isDefault) ?? engines[0])!.capabilities.join(', ')}
        </p>
      )}
      {error !== null && <p role="alert">{error}</p>}
    </div>
  );
}
