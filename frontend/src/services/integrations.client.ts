/**
 * `T2207` (EPIC-039, API contract §1, §7) — the Integrations screen's client.
 *
 * **Read functions only** (`FR-HUB-074`, `R-039-16`): the registry list and
 * one entry's detail. Configuration and credentials are set through the API by
 * the project owner; this module has no function that could write either, and
 * `frontend/tests/unit/shell/areas.spec.ts` (`T2208`) asserts the page
 * imports none.
 *
 * Shapes mirror `backend/src/modules/integrations/registry.service.ts`. A field
 * is a value or a reason (`FR-HUB-023`) — never a blank.
 */
import { ApiError } from './api';

export type Fact<T> = { readonly applicable: true; readonly value: T } | { readonly applicable: false; readonly reason: string };

export interface EntryView {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly direction: 'outbound' | 'inbound';
  readonly status: 'active' | 'retired';
  readonly listedOrder: number;
  readonly provider: Fact<string>;
  readonly transport: Fact<string>;
  readonly version: Fact<string>;
  readonly compatibility: Fact<unknown>;
  readonly permissionScope: Fact<unknown>;
  readonly authorisation: Fact<string>;
  readonly configuration: Fact<{ state: 'configured' | 'not-configured'; setBy?: string; setAt?: string }>;
  readonly health: Fact<{ state: string; reason?: string; checkedAt?: string }>;
  readonly audit: { registeredBy: string; registeredAt: string; retiredBy?: string; retiredAt?: string; lastChangeAt: string };
}

export interface CandidateView {
  readonly entryKey: string;
  readonly ineligibleBecause: string | null;
  readonly detail: string | null;
}

export interface ResolutionView {
  readonly id: string;
  readonly capability: string;
  readonly caller: string;
  readonly outcome: 'resolved' | 'refused';
  readonly decidedAt: string;
  readonly adapterKey: string | null;
  readonly contractVersion: string | null;
  readonly eligibleBecause?: readonly string[];
  readonly refusal?: { readonly code: string; readonly message: string; readonly candidates: readonly CandidateView[] };
}

export interface EntryDetail {
  readonly entry: EntryView;
  readonly healthHistory: readonly { state: string; reason: string | null; checkedAt: string; source: string; retryAfterSeconds: number | null }[];
  readonly resolutions: readonly ResolutionView[];
}

export interface RegistryList {
  readonly entries: readonly EntryView[];
  readonly omitted: readonly { key: string; reason: string }[];
}

/**
 * `T2627` — one capability's configuration for a project, as API §2 reads it:
 * the adapters in preference order (each with its registry status), and the
 * `EPIC-031` policy status derived on read.
 */
export interface ConfigurationView {
  readonly capability: string;
  readonly adapters: readonly { readonly registryEntryId: string; readonly key: string | null; readonly preference: number; readonly status: 'active' | 'retired' | 'not-listed' }[];
  readonly permitDegraded: boolean;
  readonly permittedEnvironments: readonly string[];
  readonly onNotNarrowable: string;
  readonly healthIntervalSeconds: number;
  readonly configVersion: number;
  readonly decisionId: string | null;
  readonly policyStatus: 'permitted' | 'pending' | 'not-permitted' | 'policy-seam-unbound' | 'no-decision';
  readonly policyExplanation?: unknown;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

/** `T2627` — the deployment-scope binding (API §4a): set at boot, never through this screen. */
export interface DeploymentCapabilities {
  readonly capabilities: readonly {
    readonly capability: string;
    readonly scope: 'deployment';
    readonly setBy: string;
    readonly adapterKey: string | null;
    readonly notApplicable?: string;
    readonly eligible: boolean;
    readonly modelId: string | null;
    readonly dimension: number | null;
    readonly health: string;
    readonly reason: string | null;
    readonly explanation: string | null;
  }[];
}

/** Everything the screen may ask. Nothing here writes. */
export interface IntegrationsReadClient {
  listRegistry(projectId?: string): Promise<RegistryList>;
  entryDetail(entryId: string, projectId?: string): Promise<EntryDetail>;
  /** `GET /projects/:projectId/integrations/configuration` (`T2627`). */
  listConfiguration(projectId: string): Promise<readonly ConfigurationView[]>;
  /** `GET /integrations/deployment/capabilities` (`T2627`). */
  deploymentCapabilities(): Promise<DeploymentCapabilities>;
}

export interface IntegrationsClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export function createIntegrationsClient(options: IntegrationsClientOptions = {}): IntegrationsReadClient {
  const baseUrl = options.baseUrl ?? '/v1';
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const get = async <T,>(path: string): Promise<T> => {
    const response = await fetchImpl(`${baseUrl}${path}`, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
      try {
        body = (await response.json()) as typeof body;
      } catch {
        body = {};
      }
      throw new ApiError(body.error?.code ?? 'internal_error', body.error?.message ?? 'An unexpected error occurred.', response.status, body.error?.details);
    }
    return (await response.json()) as T;
  };
  const query = (projectId?: string): string => (projectId ? `?projectId=${encodeURIComponent(projectId)}` : '');
  return {
    listRegistry: (projectId) => get<RegistryList>(`/integrations/registry${query(projectId)}`),
    entryDetail: (entryId, projectId) => get<EntryDetail>(`/integrations/registry/${encodeURIComponent(entryId)}${query(projectId)}`),
    listConfiguration: (projectId) => get<readonly ConfigurationView[]>(`/projects/${encodeURIComponent(projectId)}/integrations/configuration`),
    deploymentCapabilities: () => get<DeploymentCapabilities>('/integrations/deployment/capabilities'),
  };
}
