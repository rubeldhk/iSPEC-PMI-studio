/**
 * T113a — the version history panel (FR-013, US5).
 * Written to FAIL before T114 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VersionHistory } from '../../../src/components/VersionHistory';
import type { ApiClient, SpecificationVersionInfo } from '../../../src/services/api';

const VERSIONS: SpecificationVersionInfo[] = [
  { id: 'sv1', versionNumber: 1, lifecycleStateAtCreation: 'draft', authoredById: 'u1', authoredAt: '2026-08-18T09:00:00Z' },
  { id: 'sv2', versionNumber: 2, lifecycleStateAtCreation: 'review', authoredById: 'u2', authoredAt: '2026-08-19T09:00:00Z' },
  { id: 'sv3', versionNumber: 3, lifecycleStateAtCreation: 'approved', authoredById: 'u1', authoredAt: '2026-08-20T09:00:00Z' },
];

function api(versions: SpecificationVersionInfo[] = VERSIONS): ApiClient {
  return { listSpecificationVersions: vi.fn(async () => versions) } as unknown as ApiClient;
}

afterEach(cleanup);

describe('VersionHistory (FR-013)', () => {
  it('renders every version with number, author, and date', async () => {
    render(<VersionHistory api={api()} specificationId="s1" />);
    expect(await screen.findByText('v3')).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getAllByText(/u1/).length).toBe(2);
    expect(screen.getByText(/2026-08-19/)).toBeDefined();
  });

  it('newest version first — history reads downward into the past', async () => {
    render(<VersionHistory api={api()} specificationId="s1" />);
    await screen.findByText('v3');
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('v3');
    expect(items[items.length - 1]?.textContent).toContain('v1');
  });

  it('a single-version specification renders without a diff prompt', async () => {
    render(<VersionHistory api={api(VERSIONS.slice(0, 1))} specificationId="s1" />);
    expect(await screen.findByText('v1')).toBeDefined();
    expect(screen.getAllByRole('listitem').length).toBe(1);
  });
});
