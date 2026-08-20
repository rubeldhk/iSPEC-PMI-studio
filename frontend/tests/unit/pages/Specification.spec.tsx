/**
 * T083e — the specification detail view.
 * Written to FAIL before T084 exists (Constitution V).
 *
 * FR-022: engine and engine version are provenance, always shown. FR-032:
 * out-of-date is a visible state a human acts on, never auto-corrected.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SpecificationView } from '../../../src/pages/Specification';
import type { ApiClient, Specification } from '../../../src/services/api';

const SPEC: Specification = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Payments spec',
  lifecycleState: 'review',
  currentVersionId: 'sv2',
  engineName: 'speckit',
  engineVersion: '1.2.0+claude-fable-5',
  generatedAt: '2026-08-20T10:00:00Z',
  isOutOfDate: true,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

function api(specification: Specification = SPEC): ApiClient {
  return { getSpecification: vi.fn(async () => specification) } as unknown as ApiClient;
}

afterEach(cleanup);

describe('SpecificationView', () => {
  it('shows the engine AND its version — provenance, not trivia (FR-022)', async () => {
    render(<SpecificationView api={api()} specificationId="s1" />);
    expect(await screen.findByText(/speckit/)).toBeDefined();
    expect(screen.getByText(/1\.2\.0\+claude-fable-5/)).toBeDefined();
  });

  it('shows the lifecycle state and generation time', async () => {
    render(<SpecificationView api={api()} specificationId="s1" />);
    expect(await screen.findByText('review')).toBeDefined();
    expect(screen.getByText(/2026-08-20/)).toBeDefined();
  });

  it('an out-of-date specification is flagged prominently (FR-032)', async () => {
    render(<SpecificationView api={api()} specificationId="s1" />);
    const flag = await screen.findByRole('status');
    expect(flag.textContent).toMatch(/out of date/i);
  });

  it('an up-to-date specification carries NO stale flag', async () => {
    render(<SpecificationView api={api({ ...SPEC, isOutOfDate: false })} specificationId="s1" />);
    await screen.findByText('Payments spec');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
