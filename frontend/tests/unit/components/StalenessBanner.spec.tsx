/**
 * T268 (EPIC-020) — staleness renders ON THE SPECIFICATION ITSELF, not only
 * in a report, so no specification is silently stale (SC-ENH-006, with T263).
 *
 * Extends the test suite of the specification view EPIC-010 T084 built —
 * the deliberate cross-epic reference tasks.md records.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SpecificationView } from '../../../src/pages/Specification';
import type { ApiClient, Specification } from '../../../src/services/api';

const BASE: Specification = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Payments spec',
  lifecycleState: 'approved',
  currentVersionId: 'sv1',
  engineName: 'speckit',
  engineVersion: '1.2.0',
  generatedAt: '2026-08-20T10:00:00Z',
  isOutOfDate: false,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

function api(specification: Specification): ApiClient {
  return { getSpecification: vi.fn(async () => specification) } as unknown as ApiClient;
}

afterEach(cleanup);

describe('T268 · staleness on the specification itself (FR-ENH-006, SC-ENH-006)', () => {
  it('a stale specification shows a live banner NAMING what changed', async () => {
    render(
      <SpecificationView
        api={api({ ...BASE, currencyStatus: 'stale', staleReason: 'decision adr_1 changed' })}
        specificationId="s1"
      />,
    );
    const banner = await screen.findByRole('status');
    expect(banner.textContent).toMatch(/stale|not current/i);
    expect(banner.textContent).toMatch(/adr_1/);
  });

  it('a current specification carries NO staleness banner', async () => {
    render(<SpecificationView api={api({ ...BASE, currencyStatus: 'current' })} specificationId="s1" />);
    await screen.findByText('Payments spec');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the FR-032 out-of-date flag and the currency banner share ONE live region — flags never disagree on screen', async () => {
    render(
      <SpecificationView
        api={api({
          ...BASE,
          isOutOfDate: true,
          currencyStatus: 'stale',
          staleReason: 'requirement req_9 changed',
        })}
        specificationId="s1"
      />,
    );
    await screen.findByText('Payments spec');
    const banners = screen.getAllByRole('status');
    expect(banners.length).toBe(1);
    expect(banners[0]?.textContent).toMatch(/req_9/);
  });
});
