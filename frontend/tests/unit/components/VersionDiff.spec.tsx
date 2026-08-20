/**
 * T114a — the version diff view (FR-014, US5).
 * Written to FAIL before T115 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VersionDiff } from '../../../src/components/VersionDiff';
import type { ApiClient, VersionDiffResult } from '../../../src/services/api';

function api(diff: VersionDiffResult): ApiClient {
  return { diffSpecificationVersions: vi.fn(async () => diff) } as unknown as ApiClient;
}

afterEach(cleanup);

describe('VersionDiff (FR-014)', () => {
  it('added and removed lines are rendered, each marked with its direction', async () => {
    render(
      <VersionDiff
        api={api({
          fromVersion: 1,
          toVersion: 2,
          added: ['The system MUST retry once.'],
          removed: ['The system MUST never retry.'],
          unchanged: 12,
          identical: false,
        })}
        specificationId="s1"
        fromVersion={1}
        toVersion={2}
      />,
    );
    const added = await screen.findByText('The system MUST retry once.');
    const removed = screen.getByText('The system MUST never retry.');
    // The direction must be machine-readable, not just a color (accessibility).
    expect(added.closest('[data-change="added"]')).not.toBeNull();
    expect(removed.closest('[data-change="removed"]')).not.toBeNull();
    expect(screen.getByText(/v1/)).toBeDefined();
    expect(screen.getByText(/v2/)).toBeDefined();
  });

  it('identical versions say so instead of rendering an empty diff', async () => {
    render(
      <VersionDiff
        api={api({ fromVersion: 2, toVersion: 3, added: [], removed: [], unchanged: 12, identical: true })}
        specificationId="s1"
        fromVersion={2}
        toVersion={3}
      />,
    );
    expect(await screen.findByText(/identical/i)).toBeDefined();
  });
});
