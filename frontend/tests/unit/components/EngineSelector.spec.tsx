/**
 * T140a — the engine selection control.
 * Written to FAIL before T141 exists (Constitution V).
 *
 * FR-019: selection is per project, not per workspace. Null selection means
 * "inherit the deployment default" — the resolver's contract since T035 —
 * so the control must offer that as a real choice, not hide it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineSelector } from '../../../src/components/EngineSelector';
import type { ApiClient, Engine, Project } from '../../../src/services/api';

const ENGINES: Engine[] = [
  {
    name: 'speckit',
    version: '1.2.0',
    capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'],
    isDefault: true,
  },
  {
    name: 'fixture',
    version: '0.1.0',
    capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'],
    isDefault: false,
  },
];

function api(overrides: Partial<Record<'listEngines' | 'updateProject', unknown>> = {}): ApiClient {
  return {
    listEngines: vi.fn(async () => ENGINES),
    updateProject: vi.fn(async () => ({ engineName: 'fixture' }) as Project),
    ...overrides,
  } as unknown as ApiClient;
}

afterEach(cleanup);

describe('EngineSelector · listing', () => {
  it('offers every registered engine, with the default marked', async () => {
    render(<EngineSelector api={api()} projectId="p1" value={null} onSelected={vi.fn()} />);
    const speckit = await screen.findByRole('option', { name: /speckit.*default/i });
    expect(speckit).toBeDefined();
    expect(screen.getByRole('option', { name: /fixture/i })).toBeDefined();
  });

  it('offers "inherit default" as a real choice, selected when value is null', async () => {
    render(<EngineSelector api={api()} projectId="p1" value={null} onSelected={vi.fn()} />);
    await screen.findByRole('option', { name: /speckit/i });
    const select = screen.getByLabelText(/engine/i) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: /inherit/i })).toBeDefined();
  });

  it('shows each engine\'s capabilities — what it can do, not only its name', async () => {
    render(<EngineSelector api={api()} projectId="p1" value={null} onSelected={vi.fn()} />);
    await screen.findByRole('option', { name: /speckit/i });
    expect(screen.getByText(/generate_specification/)).toBeDefined();
  });

  it('reflects an existing selection', async () => {
    render(<EngineSelector api={api()} projectId="p1" value="fixture" onSelected={vi.fn()} />);
    await screen.findByRole('option', { name: /fixture/i });
    expect((screen.getByLabelText(/engine/i) as HTMLSelectElement).value).toBe('fixture');
  });
});

describe('EngineSelector · selecting (FR-019, per project)', () => {
  it('PATCHes the PROJECT with the chosen engine and reports the saved record', async () => {
    const client = api();
    const onSelected = vi.fn();
    render(<EngineSelector api={client} projectId="p1" value={null} onSelected={onSelected} />);
    await screen.findByRole('option', { name: /fixture/i });

    fireEvent.change(screen.getByLabelText(/engine/i), { target: { value: 'fixture' } });

    await vi.waitFor(() => {
      expect(client.updateProject).toHaveBeenCalledWith('p1', { engineName: 'fixture' });
      expect(onSelected).toHaveBeenCalled();
    });
  });

  it('choosing "inherit default" clears the selection with engineName null', async () => {
    const client = api();
    render(<EngineSelector api={client} projectId="p1" value="fixture" onSelected={vi.fn()} />);
    await screen.findByRole('option', { name: /fixture/i });

    fireEvent.change(screen.getByLabelText(/engine/i), { target: { value: '' } });

    await vi.waitFor(() => {
      expect(client.updateProject).toHaveBeenCalledWith('p1', { engineName: null });
    });
  });

  it('a failed save is shown and the control stays usable', async () => {
    const client = api({
      updateProject: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    render(<EngineSelector api={client} projectId="p1" value={null} onSelected={vi.fn()} />);
    await screen.findByRole('option', { name: /fixture/i });

    fireEvent.change(screen.getByLabelText(/engine/i), { target: { value: 'fixture' } });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByLabelText(/engine/i)).toBeDefined();
  });
});
