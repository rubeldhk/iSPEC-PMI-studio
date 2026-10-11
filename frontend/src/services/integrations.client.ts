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

/** Everything the screen may ask. Nothing here writes. */
export interface IntegrationsReadClient {
  listRegistry(projectId?: string): Promise<RegistryList>;
  entryDetail(entryId: string, projectId?: string): Promise<EntryDetail>;
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
  };
}
