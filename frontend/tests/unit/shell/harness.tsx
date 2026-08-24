/**
 * Shared harness for the shell's tests (EPIC-036).
 *
 * Not a `.spec.` file, so vitest never collects it.
 *
 * **The stub is typed against the real contract**, method by method, rather
 * than cast wholesale. `DEF-029-006` is a stub of the wrong shape laundered
 * through `as unknown as`: the component threw mid-render and the test went on
 * passing, because the cast is what hid it. Every method below is declared with
 * its real return type so the compiler checks the shape.
 */
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from '../../../src/main';
import type {
  ApiClient,
  Project,
  ReviewSession,
  Run,
  WhoAmI,
} from '../../../src/services/api';

export const WORKSPACE_ID = 'ws_a';

export const PROJECT: Project = {
  id: 'p1',
  workspaceId: WORKSPACE_ID,
  name: 'Payments',
  description: null,
  status: 'active',
  engineName: null,
  ownerUserId: 'u1',
  archivedAt: null,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
};

export const RUN: Run = {
  id: 'run_1',
  projectId: PROJECT.id,
  mode: 'full',
  stopRange: 'implement',
  state: 'awaiting_review',
  stoppedAtSelectedRange: true,
  outcomeReason: null,
  startedAt: '2026-08-23T10:00:00Z',
  endedAt: null,
};

export const REVIEW: ReviewSession = {
  id: 'rs_1',
  runId: RUN.id,
  state: 'open',
  openedAt: '2026-08-23T10:05:00Z',
  submittedAt: null,
  questions: [
    {
      id: 'q1',
      context: 'Which storage backend should the export use?',
      optionsConsidered: ['S3', 'Local disk'],
      suggestedAnswer: 'S3',
      restricted: false,
      answers: [],
    },
  ],
};

export interface StubOptions {
  /** Omit to be signed in; pass false for the signed-out shell. */
  signedIn?: boolean;
  runs?: Run[];
  projects?: Project[];
}

/**
 * An `ApiClient` that answers every call the delivered pages make on mount.
 *
 * A page that throws on mount renders nothing, and a reachability test over a
 * blank area would report the area unreachable for the wrong reason — so the
 * stub answers rather than rejects.
 */
export function stubApi({ signedIn = true, runs = [RUN], projects = [PROJECT] }: StubOptions = {}) {
  const identity: WhoAmI = {
    user: { id: 'u1', email: 'uat@pmi.test', displayName: 'UAT' },
    workspace: { id: WORKSPACE_ID },
  };
  return {
    me: vi.fn(
      async (): Promise<WhoAmI> => {
        if (!signedIn) throw new Error('no session');
        return identity;
      },
    ),
    listProjects: vi.fn(async (): Promise<Project[]> => projects),
    getProject: vi.fn(async (): Promise<Project> => PROJECT),
    updateProject: vi.fn(async (): Promise<Project> => PROJECT),
    listRequirements: vi.fn(async () => []),
    listEngines: vi.fn(async () => []),
    listSpecifications: vi.fn(async () => ({ items: [], total: 0 })),
    getSpecification: vi.fn(async () => ({ id: 's1', title: 'Spec', body: '', version: 1 })),
    listTasks: vi.fn(async () => []),
    getProjectProgress: vi.fn(async () => ({ total: 0, done: 0 })),
    listRuns: vi.fn(async (): Promise<Run[]> => runs),
    getRunReview: vi.fn(async (): Promise<ReviewSession> => REVIEW),
    listStorageConnections: vi.fn(async () => []),
    listPublishes: vi.fn(async () => []),
    getProjectCoverage: vi.fn(async () => ({
      uncoveredRequirementIds: [],
      specificationsWithoutTasks: [],
      requirementCount: 0,
      specificationCount: 0,
    })),
  } as unknown as ApiClient;
}

/** Render the REAL `App` at an address, through the real route tree. */
export function renderAt(path: string, api: ApiClient = stubApi()): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} />
    </MemoryRouter>,
  );
}
