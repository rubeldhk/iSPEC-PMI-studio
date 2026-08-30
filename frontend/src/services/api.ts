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

import type { LoopProgress } from '@pmi/loop-contract';
import type { Readiness } from '../rooms/regions/Blockers';

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

/**
 * T200d — a run, as `GET /projects/:projectId/runs` returns it.
 *
 * The backend has served this since `EPIC-023` and no frontend surface called
 * it, which is why `ReviewSession` had no parent and `DEF-010-001` counted it
 * among the five unreachable pages. Dates arrive as ISO strings over the wire;
 * the backend's `RunBody` types them as `Date` because that is what it holds
 * before serialisation.
 */
export interface Run {
  id: string;
  projectId: string;
  mode: string;
  stopRange: string;
  state: string;
  /** FR-RUN-008a — the run reports that it stopped where the user asked. */
  stoppedAtSelectedRange: boolean;
  outcomeReason: string | null;
  startedAt: string;
  endedAt: string | null;
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

/** One Room as the index renders it. Mirrors `EPIC-030`'s row. */
export interface RoomSummary {
  readonly id: string;
  readonly subjectId: string;
  readonly projectId: string;
  readonly currentStage: string;
  readonly createdAt: string;
}


import type { Epistemic } from '@pmi/room-contract';

/** `T1211` — an approved baseline as the wire carries it. */
export interface ApprovedBaseline {
  readonly id: string;
  readonly version: number;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly rationale: string;
  readonly setHash: string;
  readonly memberVersionIds: readonly string[];
  readonly supersededBy: number | null;
}

/** `T1193` — a decision as the wire carries it. */
export interface RecordedRoomDecision {
  readonly id: string;
  readonly roomObjectId: string;
  readonly decidedBy: string;
  readonly chosenOption: string;
  readonly declinedOptions: readonly string[];
  readonly rationale: string;
}

/** `T1185` — a Room candidate as the wire carries it. */
export interface RoomCandidate {
  readonly id: string;
  readonly roomObjectId: string;
  readonly sourceRef: string;
  readonly normalizedText: string;
  /** The contract's union, not a restatement — `EPISTEMIC_KINDS` is authoritative. */
  readonly epistemic: Epistemic;
  readonly promotedTo: string | null;
  readonly acceptanceCriteria: readonly string[] | null;
  readonly intendedForImplementation: boolean;
}

/** `T1187` — a clarification, answered or not. */
export interface RoomClarification {
  readonly id: string;
  readonly roomObjectId: string;
  readonly candidateId: string | null;
  readonly question: string;
  readonly answer: string | null;
  readonly answeredBy: string | null;
  readonly blocksBaseline: boolean;
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

  /**
   * T200d — the runs of a project.
   *
   * The endpoint predates this by an Epic; what was missing was any caller.
   * `RunsPage` is the only one, and it is what gives `ReviewSessionPage` a
   * `runId` to be opened with (`DEF-010-001`).
   */
  async listRuns(projectId: string): Promise<Run[]> {
    return this.request('GET', `/projects/${encodeURIComponent(projectId)}/runs`);
  }

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

  // ---- requirement room (EPIC-033 US6) ----

  /**
   * `T403n` — the two projections the Room renders.
   *
   * Both are **reads of somebody else's derivation**: loop progress is
   * `EPIC-030`'s, readiness is the Requirement Room backend's. The client adds
   * no shaping, so a Room cannot end up displaying a fourth status or a
   * differently-computed `ready` (`FR-RQR-074`).
   *
   * `workspaceId` is deliberately not a parameter — since `T1148` the server
   * takes it from the session, and passing one would be a caller naming its own
   * tenant.
   */
  async loopProgress(roomObjectId: string): Promise<LoopProgress[]> {
    return this.request('GET', `/loop/objects/${encodeURIComponent(roomObjectId)}/progress`);
  }

  /**
   * `T1169` — open a Requirement Room and take its first intent in one call.
   *
   * `workspaceId` is deliberately not a parameter, for the reason `loopProgress`
   * gives: since `T1148` the server takes it from the session, and passing one
   * would be a caller naming its own tenant.
   */
  /**
   * `T1185` — the candidates a Room holds, with their epistemic labels.
   *
   * `RoomCandidate` deliberately has no `description`, `type` or `priority`:
   * `FR-RQR-002` and `D-33` keep requirement text in `EPIC-007`'s register, and
   * a client type carrying those fields is how a local cache starts.
   */
  async roomCandidates(roomObjectId: string): Promise<RoomCandidate[]> {
    return this.request('GET', `/rooms/requirement/${encodeURIComponent(roomObjectId)}/candidates`);
  }

  /** `T1185` — `FR-RQR-030`. `null` clears, and clearing blocks baseline again. */
  async setCandidateCriteria(
    roomObjectId: string,
    candidateId: string,
    input: { acceptanceCriteria: readonly string[] | null; intendedForImplementation: boolean },
  ): Promise<RoomCandidate> {
    return this.request(
      'POST',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/candidates/${encodeURIComponent(candidateId)}/criteria`,
      input,
    );
  }

  /**
   * `T1193` — record a decision. Options and the choice travel together.
   *
   * `FR-RQR-023` keeps the options **not** chosen, and the service derives them
   * from the difference — so all of them are sent, not just the winner.
   */
  async decideRoom(
    roomObjectId: string,
    input: {
      options: readonly unknown[];
      chosenOptionId: string;
      rationale: string;
      objectVersion?: number;
    },
  ): Promise<RecordedRoomDecision> {
    return this.request(
      'POST',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/decide`,
      input,
    );
  }

  /** `T1211` — the baselines approved for a project, superseded ones included. */
  async roomBaselines(roomObjectId: string, projectId: string): Promise<ApprovedBaseline[]> {
    const query = new URLSearchParams({ projectId }).toString();
    return this.request(
      'GET',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/baselines?${query}`,
    );
  }

  /** `T1193` — the decisions recorded for a Room. */
  async roomDecisions(roomObjectId: string): Promise<RecordedRoomDecision[]> {
    return this.request('GET', `/rooms/requirement/${encodeURIComponent(roomObjectId)}/decisions`);
  }

  /**
   * `T1193` — approve the set.
   *
   * Refuses until `EPIC-032` binds an `EvidenceContractSource` (`FR-RQR-053`),
   * and the refusal is surfaced rather than swallowed.
   */
  async approveBaseline(
    roomObjectId: string,
    input: {
      projectId: string;
      rationale: string;
      decisionId: string;
      members: readonly { requirementVersionId: string; contentHash: string; candidateId: string }[];
      evidenceContractRef: string;
      /** `T1212` — the version this baseline declares it replaces. */
      supersedes?: number;
    },
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/baseline`,
      input,
    );
  }

  /**
   * `T1207` — promote a candidate into `EPIC-007`'s register and freeze it.
   *
   * Returns the frozen version and its hash, which is exactly what a baseline
   * member is made of.
   */
  async promoteCandidate(
    roomObjectId: string,
    candidateId: string,
  ): Promise<{ requirementId: string; requirementVersionId: string; contentHash: string }> {
    return this.request(
      'POST',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/candidates/${encodeURIComponent(candidateId)}/promote`,
      {},
    );
  }

  /** `T1187` — the questions raised for a Room, answered or not. */
  async roomClarifications(roomObjectId: string): Promise<RoomClarification[]> {
    return this.request(
      'GET',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/clarifications`,
    );
  }

  /** `T1187` — answered in place. Who answered comes from the session. */
  async answerClarification(
    roomObjectId: string,
    clarificationId: string,
    answer: string,
  ): Promise<RoomClarification> {
    return this.request(
      'POST',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/clarifications/${encodeURIComponent(clarificationId)}/answer`,
      { answer },
    );
  }

  async openRequirementRoom(input: {
    projectId: string;
    text: string;
    sourceRef?: string;
  }): Promise<{ roomObjectId: string }> {
    return this.request('POST', '/rooms/requirement', input);
  }

  /**
   * `T1171` — the workspace's Requirement Rooms, for the index.
   *
   * No `workspaceId` parameter, for the same reason as `openRequirementRoom`
   * above: `EPIC-030` resolves it from the principal (`T1177`), so a caller
   * cannot ask for another workspace's Rooms even by mistake.
   */
  async listRequirementRooms(): Promise<readonly RoomSummary[]> {
    return this.request('GET', '/rooms/requirement');
  }

  async roomReadiness(
    roomObjectId: string,
    projectId: string,
    evidenceContractRef?: string,
  ): Promise<Readiness> {
    // `T1207` — the Contract ref travels with the question. Without it the
    // server cannot evaluate the Contract and answers "unevaluated", so the Room
    // showed a blocker the API did not have. The UI and the API must be asking
    // the same question or one of them is lying.
    const query = new URLSearchParams({
      projectId,
      ...(evidenceContractRef === undefined ? {} : { evidenceContractRef }),
    }).toString();
    return this.request(
      'GET',
      `/rooms/requirement/${encodeURIComponent(roomObjectId)}/readiness?${query}`,
    );
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
