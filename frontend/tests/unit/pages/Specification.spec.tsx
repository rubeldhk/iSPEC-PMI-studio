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

/**
 * `T1660` (EPIC-045, `FR-ART-019`) — the specification detail renders its
 * current version through the SAME `MarkdownViewer` the Epic detail uses.
 *
 * One renderer, two hosts: a second rendering path would be a second thing to
 * keep safe, and the one most likely to be forgotten (`FR-ART-061`, `R-045-13`).
 */
describe('SpecificationView · the current version, rendered (T1660)', () => {
  const SYNCED: Specification = {
    ...SPEC,
    isOutOfDate: false,
    sourcePath: 'specs/003-reports/spec.md',
    currentVersion: { id: 'sv2', versionNumber: 2, contentRaw: '# Reports\n\nA <b>bold</b> claim.\n', authoredById: 'exec_1', authoredAt: '2026-09-05T10:00:00Z' },
  };

  it('renders the content as markdown — a heading is a heading element', async () => {
    render(<SpecificationView api={api(SYNCED)} specificationId="s1" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Reports' })).toBeDefined();
  });

  it('escapes raw HTML in the content as text, exactly as the Epic detail does', async () => {
    render(<SpecificationView api={api(SYNCED)} specificationId="s1" />);
    await screen.findByRole('heading', { level: 1, name: 'Reports' });
    const content = screen.getByRole('region', { name: 'Specification content' });
    expect(content.querySelector('b'), 'raw HTML became an element').toBeNull();
    expect(content.textContent).toContain('<b>bold</b>');
  });

  it('says where a synced specification came from', async () => {
    render(<SpecificationView api={api(SYNCED)} specificationId="s1" />);
    await screen.findByRole('heading', { level: 1, name: 'Reports' });
    expect(screen.getByText(/Synced from/).textContent).toContain('specs/003-reports/spec.md');
    expect(screen.getByText(/Synced from/).textContent).toContain('exec_1');
  });

  it('says nothing about a source for a specification created another way', async () => {
    render(<SpecificationView api={api(SPEC)} specificationId="s1" />);
    await screen.findByText(/speckit/);
    expect(screen.queryByText(/Synced from/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Specification content' })).toBeNull();
  });
});
