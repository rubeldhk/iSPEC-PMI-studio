/**
 * T071a — the requirement editor: empty-description refusal and history
 * rendering. Written to FAIL before T072 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RequirementEditor } from '../../../src/components/RequirementEditor';
import { ApiError, type ApiClient, type Requirement, type RequirementVersion } from '../../../src/services/api';

const EXISTING: Requirement = {
  id: 'r1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  reference: 'REQ-001',
  description: 'Current text.',
  type: 'functional',
  priority: 'p1',
  status: 'active',
  contentHash: 'h',
  retiredAt: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
};

const HISTORY: RequirementVersion[] = [
  {
    id: 'v2',
    workspaceId: 'ws_a',
    requirementId: 'r1',
    description: 'Second text.',
    type: 'functional',
    priority: 'p1',
    authoredById: 'u1',
    authoredAt: '2026-08-19T12:00:00Z',
  },
  {
    id: 'v1',
    workspaceId: 'ws_a',
    requirementId: 'r1',
    description: 'Original text.',
    type: 'functional',
    priority: 'p2',
    authoredById: 'u1',
    authoredAt: '2026-08-18T12:00:00Z',
  },
];

afterEach(cleanup);

describe('RequirementEditor · empty-description refusal (FR-007)', () => {
  it('refuses to submit an empty description, NAMING the field — the API is never called', async () => {
    const createRequirement = vi.fn();
    const api = { createRequirement } as unknown as ApiClient;
    render(<RequirementEditor api={api} projectId="p1" onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/description is required/i)).toBeDefined();
    expect(createRequirement).not.toHaveBeenCalled();
  });

  it('surfaces the server\'s named-field refusal the same way', async () => {
    const api = {
      createRequirement: vi.fn(async () => {
        throw new ApiError('validation_failed', 'Requirement cannot be saved.', 400, {
          fields: [{ field: 'description', reason: 'required' }],
        });
      }),
    } as unknown as ApiClient;
    render(<RequirementEditor api={api} projectId="p1" onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/description is required/i)).toBeDefined();
  });

  it('saves a valid new requirement and reports it', async () => {
    const created = { ...EXISTING, id: 'r9', reference: 'REQ-009', description: 'New requirement.' };
    const createRequirement = vi.fn(async () => created);
    const onSaved = vi.fn();
    const api = { createRequirement } as unknown as ApiClient;
    render(<RequirementEditor api={api} projectId="p1" onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New requirement.' } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'functional' } });
    fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await vi.waitFor(() => {
      expect(createRequirement).toHaveBeenCalledWith('p1', {
        description: 'New requirement.',
        type: 'functional',
        priority: 'p1',
      });
      expect(onSaved).toHaveBeenCalledWith(created);
    });
  });
});

describe('RequirementEditor · history rendering (FR-009)', () => {
  it('renders the version history for an existing requirement, newest first', async () => {
    const api = {
      updateRequirement: vi.fn(),
      listRequirementVersions: vi.fn(async () => HISTORY),
    } as unknown as ApiClient;
    render(
      <RequirementEditor api={api} projectId="p1" requirement={EXISTING} onSaved={vi.fn()} />,
    );

    expect(await screen.findByText('Second text.')).toBeDefined();
    expect(screen.getByText('Original text.')).toBeDefined();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items.findIndex((t) => t.includes('Second text.'))).toBeLessThan(
      items.findIndex((t) => t.includes('Original text.')),
    );
  });

  it('shows "no earlier versions" for an unedited requirement', async () => {
    const api = {
      updateRequirement: vi.fn(),
      listRequirementVersions: vi.fn(async () => []),
    } as unknown as ApiClient;
    render(
      <RequirementEditor api={api} projectId="p1" requirement={EXISTING} onSaved={vi.fn()} />,
    );
    expect(await screen.findByText(/no earlier versions/i)).toBeDefined();
  });

  it('editing an existing requirement PATCHes rather than creates', async () => {
    const updated = { ...EXISTING, description: 'Amended text.' };
    const updateRequirement = vi.fn(async () => updated);
    const api = {
      updateRequirement,
      listRequirementVersions: vi.fn(async () => []),
    } as unknown as ApiClient;
    render(
      <RequirementEditor api={api} projectId="p1" requirement={EXISTING} onSaved={vi.fn()} />,
    );
    await screen.findByText(/no earlier versions/i);

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Amended text.' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await vi.waitFor(() => {
      expect(updateRequirement).toHaveBeenCalledWith('r1', {
        description: 'Amended text.',
        type: 'functional',
        priority: 'p1',
      });
    });
  });
});
