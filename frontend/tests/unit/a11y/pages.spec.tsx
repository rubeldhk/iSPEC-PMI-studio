/**
 * T883 (EPIC-029) — the harness over every delivered page (FR-DS-030,
 * FR-DS-031, SC-DS-001). Harness: ./axe.ts (T880), meta-test: T881.
 *
 * Each page renders as the application hosts it: SignIn and Projects carry
 * their own `<main>`; Requirements and Traceability are composed under a host
 * landmark by the shell, reproduced here the way components-axe.spec.tsx
 * (T148) does. These render page components directly — the app-root
 * composition is T899a's subject, not this file's.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { expectNoViolations } from './axe';
import { SignIn } from '../../../src/pages/SignIn';
import { ProjectsPage } from '../../../src/pages/Projects';
import { RequirementsPage } from '../../../src/pages/Requirements';
import { TraceabilityPage } from '../../../src/pages/Traceability';
import type { ApiClient, Project, Requirement } from '../../../src/services/api';

const project: Project = {
  id: 'p1',
  workspaceId: 'ws_a',
  name: 'Platform',
  description: null,
  status: 'active',
  engineName: null,
  ownerUserId: 'u1',
  archivedAt: null,
  rootPath: null,
  agentIntegration: null,
  scriptType: null,
  provisioningState: 'not_provisioned',
  provisionedAt: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
} as Project;

const requirement: Requirement = {
  id: 'r1',
  workspaceId: 'ws_a',
  projectId: 'p1',
  reference: 'REQ-001',
  description: 'The system shall sign users in.',
  type: 'functional',
  priority: 'p1',
  status: 'active',
  contentHash: 'h',
  retiredAt: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
} as Requirement;

function host(children: ReactNode): ReactElement {
  return (
    <main>
      <h1>Probe page</h1>
      {children}
    </main>
  );
}

afterEach(cleanup);

describe('T883 · every delivered page passes the WCAG 2.2 AA harness', () => {
  it('SignIn', async () => {
    render(<SignIn api={{} as ApiClient} onSignedIn={vi.fn()} />);
    await screen.findByRole('button', { name: /sign in/i });
    await expectNoViolations();
  });

  it('Projects', async () => {
    const api = { listProjects: vi.fn(async () => [project]) } as unknown as ApiClient;
    render(<ProjectsPage api={api} onOpen={vi.fn()} />);
    await screen.findByText('Platform');
    await expectNoViolations();
  });

  it('Requirements', async () => {
    const api = { listRequirements: vi.fn(async () => [requirement]) } as unknown as ApiClient;
    render(host(<RequirementsPage api={api} projectId="p1" />));
    await screen.findByText('REQ-001');
    await expectNoViolations();
  });

  it('Traceability', async () => {
    const api = {
      getRequirementTrace: vi.fn(async () => ({ requirement, specifications: [] })),
      getTaskTrace: vi.fn(async () => ({ task: null, requirements: [] })),
      // T926 (DEF-029-006) — this mock returned a coverage object of a shape
      // `CoverageReport` has never had, so TraceabilityPage threw on
      // `uncoveredRequirementIds.length` while rendering its coverage
      // section: the section never mounted and axe never saw it, while this
      // test went on passing. The cast to ApiClient is what hid it from the
      // compiler too. The shape below is the real contract (services/api.ts).
      getProjectCoverage: vi.fn(async () => ({
        uncoveredRequirementIds: ['REQ-002'],
        specificationsWithoutTasks: ['SPEC-001'],
        requirementCount: 2,
        specificationCount: 1,
      })),
    } as unknown as ApiClient;
    render(host(<TraceabilityPage api={api} projectId="p1" />));
    await screen.findByLabelText(/requirement id/i);
    await expectNoViolations();
  });
});
