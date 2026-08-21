/**
 * T058 — the API client for auth and projects, extended with the requirement
 * register (EPIC-007 T071/T072).
 *
 * Every later frontend epic consumes this client, so its two hard parts are
 * foundational rather than incidental (plan.md):
 *
 * - **Error-shape parsing** — the contract's error envelope becomes a typed
 *   `ApiError` carrying code, status, and named fields; a body that is not the
 *   envelope (a proxy's HTML 502, say) still becomes a typed error.
 * - **Session expiry** — any 401 invokes `onSessionExpired` once per response,
 *   so the shell can route to sign-in from one place instead of every caller
 *   checking.
 *
 * The session itself lives in an HTTP-only cookie: `credentials: 'include'`
 * carries it; nothing here can read it, which is the point.
 */

export interface WhoAmI {
  user: { id: string; email: string; displayName: string };
  workspace: { id: string };
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  engineName: string | null;
  ownerUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Requirement {
  id: string;
  workspaceId: string;
  projectId: string;
  reference: string;
  description: string;
  type: 'business' | 'functional' | 'non_functional' | 'constraint';
  priority: 'p1' | 'p2' | 'p3';
  status: 'active' | 'retired';
  contentHash: string;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementVersion {
  id: string;
  workspaceId: string;
  requirementId: string;
  description: string;
  type: Requirement['type'];
  priority: Requirement['priority'];
  authoredById: string;
  authoredAt: string;
}

export interface RequirementFilters {
  type?: string;
  priority?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

/** Forward trace: everything derived from a requirement (FR-030). */
export interface ForwardTrace {
  requirementId: string;
  specifications: { specificationId: string; retired?: boolean; taskIds: string[] }[];
}

/** Reverse trace: a task back to its originating requirements (FR-030). */
export interface ReverseTrace {
  taskId: string;
  specifications: {
    specificationId: string;
    requirements: { requirementId: string; retired: boolean }[];
  }[];
}

export interface SpecificationTrace {
  specificationId: string;
  requirementIds: string[];
  taskIds: string[];
}

/** Coverage gaps, derived from absence (FR-031). */
export interface CoverageReport {
  uncoveredRequirementIds: string[];
  specificationsWithoutTasks: string[];
  requirementCount: number;
  specificationCount: number;
}

/** A generated specification (FR-010, FR-022, FR-032 surface). */
export interface Specification {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  lifecycleState: 'draft' | 'review' | 'approved' | 'baselined' | 'implemented' | 'archived';
  currentVersionId: string | null;
  engineName: string;
  engineVersion: string;
  generatedAt: string;
  isOutOfDate: boolean;
  /** EPIC-020 (FR-ENH-006): one field, wider trigger than isOutOfDate. */
  currencyStatus?: 'current' | 'stale';
  staleReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecificationPage {
  rows: Specification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SpecificationVersionInfo {
  id: string;
  versionNumber: number;
  lifecycleStateAtCreation: string;
  authoredById: string;
  authoredAt: string;
}

export interface VersionDiffResult {
  fromVersion: number;
  toVersion: number;
  added: string[];
  removed: string[];
  unchanged: number;
  identical: boolean;
}

export interface Finding {
  id: string;
  location: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface Job {
  id: string;
  kind: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  failureReason: string | null;
  startedAt: string | null;
  resultRef: string | null;
}

export interface Task {
  id: string;
  specificationId: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'done';
  engineName: string;
  engineVersion: string;
}

export interface ProjectProgress {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  percentComplete: number;
}

/** A registered engine, with what it can do (FR-019/FR-021 surface). */
export interface Engine {
  name: string;
  version: string;
  capabilities: string[];
  isDefault: boolean;
}

/** A recorded answer in a review session (EPIC-023, SC-006 attribution). */
export interface ReviewAnswer {
  id: string;
  questionId: string;
  value: string;
  authorId: string;
  recordedAt: string;
  note: string | null;
  state: 'draft' | 'committed';
  conflict: boolean;
  selectedAsWinner: boolean;
}

/** A deferred question: context, options, suggestion (FR-RUN-003/007). */
export interface ReviewQuestion {
  id: string;
  context: string;
  optionsConsidered: string[];
  suggestedAnswer: string;
  restricted: boolean;
  answers: ReviewAnswer[];
}

export interface ReviewSession {
  id: string;
  runId: string;
  state: 'open' | 'submitted';
  openedAt: string;
  submittedAt: string | null;
  questions: ReviewQuestion[];
}

/** An access grant on an artifact (EPIC-024, FR-ACC-021). */
export interface AccessGrant {
  id: string;
  artifactType: string;
  artifactId: string;
  userId: string;
  level: 'read' | 'edit';
  grantedById: string;
  grantedAt: string;
  revokedAt: string | null;
}

export interface AccessAttempt {
  id: string;
  userId: string;
  artifactType: string;
  artifactId: string;
  action: string;
  reason: string;
  attemptedAt: string;
}

/** A storage connection (EPIC-025). The token never appears here. */
export interface StorageConnection {
  id: string;
  providerName: string;
  destination: string;
  status: 'healthy' | 'needs_reauthorisation' | 'unavailable';
  authorisedById: string;
  lastCheckedAt: string | null;
  disconnectedAt: string | null;
}

export interface PublishRecord {
  id: string;
  projectId: string;
  connectionId: string;
  initiatedById: string;
  state: 'running' | 'succeeded' | 'partial' | 'failed';
  failureReason: string | null;
  failureMessage: string | null;
  artifactsIncluded: { artifactId: string; name: string; landed: boolean }[];
  artifactsExcluded: { artifactId: string; name: string; reason: string }[];
  destinationLocations: string[];
  publishedAt: string;
}

export interface RepublishPreview {
  added: string[];
  replaced: string[];
  unchanged: string[];
}

export interface FieldError {
  field: string;
  reason: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The named fields of a validation refusal (FR-007), or []. */
  fieldErrors(): FieldError[] {
    const details = this.details as { fields?: FieldError[] } | undefined;
    return Array.isArray(details?.fields) ? details.fields : [];
  }

  isSessionExpiry(): boolean {
    return this.status === 401;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Called once per 401 — the shell's cue to return to sign-in. */
  onSessionExpired?: () => void;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onSessionExpired: (() => void) | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/v1';
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.onSessionExpired = options.onSessionExpired;
  }

  // ---- auth (contracts/platform-api.md · Authentication) ----

  async signIn(email: string, password: string): Promise<WhoAmI> {
    return this.request('POST', '/auth/sign-in', { email, password });
  }

  async signOut(): Promise<void> {
    await this.request('POST', '/auth/sign-out');
  }

  async me(): Promise<WhoAmI> {
    return this.request('GET', '/auth/me');
  }

  // ---- projects (US1) ----

  async listProjects(): Promise<Project[]> {
    return this.request('GET', '/projects');
  }

  async createProject(input: { name?: string; description?: string }): Promise<Project> {
    return this.request('POST', '/projects', input);
  }

  async getProject(id: string): Promise<Project> {
    return this.request('GET', `/projects/${encodeURIComponent(id)}`);
  }

  async updateProject(
    id: string,
    patch: { name?: string; description?: string | null; engineName?: string | null },
  ): Promise<Project> {
    return this.request('PATCH', `/projects/${encodeURIComponent(id)}`, patch);
  }

  async archiveProject(id: string): Promise<Project> {
    return this.request('POST', `/projects/${encodeURIComponent(id)}/archive`);
  }

  // ---- requirements (US2) ----

  async listRequirements(projectId: string, filters: RequirementFilters = {}): Promise<Requirement[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, value);
    }
    const query = params.toString();
    return this.request(
      'GET',
      `/projects/${encodeURIComponent(projectId)}/requirements${query ? `?${query}` : ''}`,
    );
  }

  async createRequirement(
    projectId: string,
    input: { description?: string; type?: string; priority?: string; reference?: string },
  ): Promise<Requirement> {
    return this.request('POST', `/projects/${encodeURIComponent(projectId)}/requirements`, input);
  }

  async getRequirement(id: string): Promise<Requirement> {
    return this.request('GET', `/requirements/${encodeURIComponent(id)}`);
  }

  async updateRequirement(
    id: string,
    patch: { description?: string; type?: string; priority?: string },
  ): Promise<Requirement> {
    return this.request('PATCH', `/requirements/${encodeURIComponent(id)}`, patch);
  }

  async retireRequirement(id: string): Promise<Requirement> {
    return this.request('POST', `/requirements/${encodeURIComponent(id)}/retire`);
  }

  async listRequirementVersions(id: string): Promise<RequirementVersion[]> {
    return this.request('GET', `/requirements/${encodeURIComponent(id)}/versions`);
  }

  // ---- specifications (US3, US5, US6) ----

  async listSpecifications(projectId: string): Promise<SpecificationPage> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/specifications`);
  }

  async getSpecification(id: string): Promise<Specification> {
    return this.request('GET', `/specifications/${encodeURIComponent(id)}`);
  }

  async listSpecificationVersions(id: string): Promise<SpecificationVersionInfo[]> {
    return this.request('GET', `/specifications/${encodeURIComponent(id)}/versions`);
  }

  async diffSpecificationVersions(id: string, a: number, b: number): Promise<VersionDiffResult> {
    return this.request('GET', `/specifications/${encodeURIComponent(id)}/versions/${a}/diff/${b}`);
  }

  /** The six lifecycle transitions (FR-011). */
  async transitionSpecification(
    id: string,
    action: 'submit-for-review' | 'reject' | 'approve' | 'baseline' | 'mark-implemented' | 'archive',
  ): Promise<{ lifecycleState?: string; specification?: Specification; outstandingFindings?: Finding[] }> {
    return this.request('POST', `/specifications/${encodeURIComponent(id)}/${action}`);
  }

  async getFindings(id: string): Promise<Finding[]> {
    return this.request('GET', `/specifications/${encodeURIComponent(id)}/findings`);
  }

  async validateSpecification(id: string): Promise<Job> {
    return this.request('POST', `/specifications/${encodeURIComponent(id)}/jobs/validate`);
  }

  // ---- jobs (US3) ----

  async getJob(id: string): Promise<Job> {
    return this.request('GET', `/jobs/${encodeURIComponent(id)}`);
  }

  // ---- tasks (US4) ----

  async generateTasks(specificationId: string): Promise<Job> {
    return this.request(
      'POST',
      `/specifications/${encodeURIComponent(specificationId)}/jobs/generate-tasks`,
    );
  }

  async listTasks(specificationId: string): Promise<Task[]> {
    return this.request('GET', `/specifications/${encodeURIComponent(specificationId)}/tasks`);
  }

  async updateTaskStatus(id: string, status: Task['status']): Promise<Task> {
    return this.request('PATCH', `/tasks/${encodeURIComponent(id)}`, { status });
  }

  async getProjectProgress(projectId: string): Promise<ProjectProgress> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/progress`);
  }

  // ---- traceability (US7) ----

  async getRequirementTrace(id: string): Promise<ForwardTrace> {
    return this.request('GET', `/requirements/${encodeURIComponent(id)}/trace`);
  }

  async getTaskTrace(id: string): Promise<ReverseTrace> {
    return this.request('GET', `/tasks/${encodeURIComponent(id)}/trace`);
  }

  async getSpecificationTrace(id: string): Promise<SpecificationTrace> {
    return this.request('GET', `/specifications/${encodeURIComponent(id)}/trace`);
  }

  async getProjectCoverage(projectId: string): Promise<CoverageReport> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/coverage`);
  }

  // ---- review sessions (EPIC-023) ----

  async getRunReview(runId: string): Promise<ReviewSession> {
    return this.request('GET', `/runs/${encodeURIComponent(runId)}/review`);
  }

  async getReviewSession(id: string): Promise<ReviewSession> {
    return this.request('GET', `/review/${encodeURIComponent(id)}`);
  }

  /** Saves a DRAFT — commits nothing (FR-RUN-011). */
  async saveDraftAnswer(
    sessionId: string,
    questionId: string,
    input: { value?: string; takeSuggested?: boolean; note?: string },
  ): Promise<ReviewAnswer> {
    return this.request(
      'PUT',
      `/review/${encodeURIComponent(sessionId)}/answers/${encodeURIComponent(questionId)}`,
      input,
    );
  }

  /** Atomic batch commit (FR-RUN-015). */
  async submitReviewSession(id: string): Promise<ReviewSession> {
    return this.request('POST', `/review/${encodeURIComponent(id)}/submit`);
  }

  async resolveReviewConflict(
    sessionId: string,
    questionId: string,
    winnerAnswerId: string,
  ): Promise<ReviewAnswer[]> {
    return this.request(
      'POST',
      `/review/${encodeURIComponent(sessionId)}/conflicts/${encodeURIComponent(questionId)}/resolve`,
      { winnerAnswerId },
    );
  }

  // ---- access grants (EPIC-024) ----

  async listGrants(artifactType: string, artifactId: string): Promise<AccessGrant[]> {
    return this.request(
      'GET',
      `/artifacts/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}/grants`,
    );
  }

  async createGrant(
    artifactType: string,
    artifactId: string,
    input: { userId: string; level: 'read' | 'edit' },
  ): Promise<AccessGrant> {
    return this.request(
      'POST',
      `/artifacts/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}/grants`,
      input,
    );
  }

  async revokeGrant(artifactType: string, artifactId: string, grantId: string): Promise<AccessGrant> {
    return this.request(
      'DELETE',
      `/artifacts/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}/grants/${encodeURIComponent(grantId)}`,
    );
  }

  async listAccessAttempts(artifactType: string, artifactId: string): Promise<AccessAttempt[]> {
    return this.request(
      'GET',
      `/artifacts/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}/access-attempts`,
    );
  }

  // ---- storage connections and publishing (EPIC-025) ----

  async listStorageConnections(workspaceId: string): Promise<StorageConnection[]> {
    return this.request('GET', `/workspaces/${encodeURIComponent(workspaceId)}/storage-connections`);
  }

  async createStorageConnection(
    workspaceId: string,
    input: { providerType: string; destination: string },
  ): Promise<StorageConnection> {
    return this.request(
      'POST',
      `/workspaces/${encodeURIComponent(workspaceId)}/storage-connections`,
      input,
    );
  }

  async getConnectionHealth(id: string): Promise<{ status: StorageConnection['status'] }> {
    return this.request('GET', `/storage-connections/${encodeURIComponent(id)}/health`);
  }

  async disconnectStorageConnection(id: string): Promise<StorageConnection> {
    return this.request('DELETE', `/storage-connections/${encodeURIComponent(id)}`);
  }

  /** Whole-project publish — deliberately no artifact selection (FR-PUB-032). */
  async publishProject(projectId: string): Promise<PublishRecord> {
    return this.request('POST', `/projects/${encodeURIComponent(projectId)}/publishes`);
  }

  async listPublishes(projectId: string): Promise<PublishRecord[]> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/publishes`);
  }

  async getPublishPreview(projectId: string): Promise<RepublishPreview> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/publishes/preview`);
  }

  // ---- engines (US8) ----

  async listEngines(): Promise<Engine[]> {
    return this.request('GET', '/engines');
  }

  // ---- transport ----

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) throw await this.toError(response);
    // 200 with an empty body (sign-out) parses to undefined, not a crash.
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async toError(response: Response): Promise<ApiError> {
    let error: ApiError;
    try {
      const parsed = (await response.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      error = new ApiError(
        parsed.error?.code ?? 'internal_error',
        parsed.error?.message ?? 'An unexpected error occurred.',
        response.status,
        parsed.error?.details,
      );
    } catch {
      // Not the contract envelope — a gateway page, an empty body. Still typed.
      error = new ApiError('internal_error', 'An unexpected error occurred.', response.status);
    }
    if (error.isSessionExpiry()) this.onSessionExpired?.();
    return error;
  }
}
