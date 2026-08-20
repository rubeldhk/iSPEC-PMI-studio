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

/** A registered engine, with what it can do (FR-019/FR-021 surface). */
export interface Engine {
  name: string;
  version: string;
  capabilities: string[];
  isDefault: boolean;
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
