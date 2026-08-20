/**
 * T148 (EPIC-015) closing the gap EPIC-010's closure enumerated — the
 * AUTOMATED half of the WCAG 2.2 AA exit criterion: every EPIC-010/012
 * surface passes axe-core with zero violations, in CI on every commit.
 *
 * The manual keyboard and screen-reader pass remains human work and is NOT
 * claimed here — automation catches the machine-checkable failures (missing
 * labels, roles, contrast metadata), which is what "automated checks pass in
 * CI" asked for.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import axe from 'axe-core';
import { SpecificationList } from '../../../src/pages/SpecificationList';
import { SpecificationView } from '../../../src/pages/Specification';
import { TasksPage } from '../../../src/pages/Tasks';
import { JobProgress } from '../../../src/components/JobProgress';
import { VersionHistory } from '../../../src/components/VersionHistory';
import { VersionDiff } from '../../../src/components/VersionDiff';
import { LifecycleControls } from '../../../src/components/LifecycleControls';
import { ValidationFindings } from '../../../src/components/ValidationFindings';
import type { ApiClient, Specification } from '../../../src/services/api';

const SPEC: Specification = {
  id: 's1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  title: 'Payments spec',
  lifecycleState: 'review',
  currentVersionId: 'sv1',
  engineName: 'speckit',
  engineVersion: '1.2.0',
  generatedAt: '2026-08-20T10:00:00Z',
  isOutOfDate: true,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

const api = {
  listSpecifications: vi.fn(async () => ({ rows: [SPEC], total: 1, page: 1, pageSize: 20 })),
  getSpecification: vi.fn(async () => SPEC),
  listSpecificationVersions: vi.fn(async () => [
    { id: 'sv1', versionNumber: 1, lifecycleStateAtCreation: 'draft', authoredById: 'u1', authoredAt: '2026-08-20T10:00:00Z' },
  ]),
  diffSpecificationVersions: vi.fn(async () => ({
    fromVersion: 1, toVersion: 2, added: ['New line.'], removed: ['Old line.'], unchanged: 3, identical: false,
  })),
  getFindings: vi.fn(async () => [
    { id: 'f1', location: 'section:overview', severity: 'warning' as const, message: 'Short overview.' },
  ]),
  getJob: vi.fn(async () => ({
    id: 'job1', kind: 'generate_specification', state: 'running' as const, failureReason: null, startedAt: null, resultRef: null,
  })),
  listTasks: vi.fn(async () => [
    { id: 't1', specificationId: 's1', description: 'Do the thing', status: 'not_started' as const, engineName: 'speckit', engineVersion: '1.2.0' },
  ]),
  getProjectProgress: vi.fn(async () => ({ total: 1, done: 0, inProgress: 0, notStarted: 1, percentComplete: 0 })),
  transitionSpecification: vi.fn(async () => ({ lifecycleState: 'approved' })),
  updateTaskStatus: vi.fn(),
} as unknown as ApiClient;

/**
 * Components ship as fragments; the landmark (`<main>`) belongs to the page
 * that hosts them — exactly how `Specification.tsx` and `Tasks.tsx` (which
 * render their own `<main>` and pass bare) do it. The probe reproduces that
 * hosting so axe's `region` rule checks the real composition, not a fragment
 * floating outside any page.
 */
function host(children: ReactNode): ReactElement {
  return (
    <main>
      <h1>Probe page</h1>
      {children}
    </main>
  );
}

async function expectNoViolations(): Promise<void> {
  const results = await axe.run(document.body, {
    // Color-contrast needs a real rendering engine; jsdom computes no layout,
    // so axe skips it anyway — excluded EXPLICITLY so the claim is honest.
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`),
  ).toEqual([]);
}

afterEach(cleanup);

describe('WCAG 2.2 AA — automated checks (axe-core) over every EPIC-010/012 surface', () => {
  it('SpecificationList', async () => {
    render(host(<SpecificationList api={api} projectId="p1" onOpen={vi.fn()} />));
    await screen.findByText('Payments spec');
    await expectNoViolations();
  });

  it('SpecificationView', async () => {
    render(<SpecificationView api={api} specificationId="s1" />);
    await screen.findByText('Payments spec');
    await expectNoViolations();
  });

  it('JobProgress', async () => {
    render(host(<JobProgress api={api} jobId="job1" pollMs={60_000} />));
    await screen.findByText(/running/i);
    await expectNoViolations();
  });

  it('VersionHistory', async () => {
    render(host(<VersionHistory api={api} specificationId="s1" />));
    await screen.findByText('v1');
    await expectNoViolations();
  });

  it('VersionDiff', async () => {
    render(host(<VersionDiff api={api} specificationId="s1" fromVersion={1} toVersion={2} />));
    await screen.findByText('New line.');
    await expectNoViolations();
  });

  it('LifecycleControls', async () => {
    render(
      host(<LifecycleControls api={api} specificationId="s1" lifecycleState="review" onTransitioned={vi.fn()} />),
    );
    await screen.findByRole('button', { name: /approve/i });
    await expectNoViolations();
  });

  it('ValidationFindings', async () => {
    render(host(<ValidationFindings api={api} specificationId="s1" />));
    await screen.findByText('Short overview.');
    await expectNoViolations();
  });

  it('TasksPage', async () => {
    render(<TasksPage api={api} specificationId="s1" projectId="p1" />);
    await screen.findByText('Do the thing');
    await expectNoViolations();
  });
});
