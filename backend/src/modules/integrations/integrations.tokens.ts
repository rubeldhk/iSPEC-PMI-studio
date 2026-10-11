/**
 * `T2134` (EPIC-039, `R-039-13`) — the Integration Hub's injection tokens and
 * the ports it declares, each bound **refusing** until its owner fills it.
 *
 * | Port | Filled by | Absent |
 * |---|---|---|
 * | `CapabilityPolicy` | `EPIC-031` (`T2212`, bound in `integrations.module.ts`) | configuration `PUT` and every project resolution answer 503 naming it |
 * | `EvidenceSink` | `EPIC-032` (`T2215`, blocked) | intake records `refused / evidence-seam-unbound` |
 * | `CredentialKeyring` | `PMI_INTEGRATION_KEYS` | credential writes answer 503 naming it; required credentials read as missing |
 *
 * A seam is a holder with a refusing default and a visible `bind()`. That is
 * how the merge-time adapter attaches, and how a route test binds a recording
 * policy **in the test**, never through a permissive default here.
 */
import { GovernanceSeamUnboundError } from '../../core/errors.js';

export const INTEGRATIONS_STORE = Symbol('INTEGRATIONS_STORE');
export const ADAPTER_CATALOG = Symbol('ADAPTER_CATALOG');
export const INTEGRATIONS_CLOCK = Symbol('INTEGRATIONS_CLOCK');
export const INTEGRATIONS_TICKER = Symbol('INTEGRATIONS_TICKER');
export const PLATFORM_ENVIRONMENT = Symbol('PLATFORM_ENVIRONMENT');
export const INTEGRATIONS_AUDIT = Symbol('INTEGRATIONS_AUDIT');
export const REGISTRY_ACCESS = Symbol('REGISTRY_ACCESS');
export const CONNECTOR_FACTS = Symbol('CONNECTOR_FACTS');
export const EXECUTION_EVENTS = Symbol('EXECUTION_EVENTS');
export const WORKSPACE_DIRECTORY = Symbol('WORKSPACE_DIRECTORY');

export type Clock = () => Date;

/** `AuditService.record`, by shape. */
export interface AuditPort {
  record(input: { workspaceId: string; actorId: string | null; action: 'create' | 'update' | 'lifecycle_transition' | 'access_refused'; targetType: string; targetId?: string; outcome: 'success' | 'refused' | 'failed'; detail?: Record<string, unknown> }): Promise<void>;
}

/** `ExecutionEventService.append`, narrowed to what the Hub writes (`FR-HUB-038`). */
export interface ExecutionEventsPort {
  appendCapabilityResolved(input: { workspaceId: string; executionId: string; emittedBy: string; resolutionId: string; payload: Record<string, unknown> }): Promise<void>;
}

// ---------------------------------------------------------------- CapabilityPolicy

export interface PolicyDecisionRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly actorId: string;
  readonly capability: string;
  readonly configurationId: string;
  readonly configVersion: number;
}

export interface PolicyStatusView {
  readonly status: 'permitted' | 'pending' | 'not-permitted';
  /** `EPIC-031`'s `Explanation`, embedded verbatim (`BR-0174`). */
  readonly explanation?: unknown;
}

export interface CapabilityPolicy {
  /** Called when a project configures an adapter (`R-039-7`) — one decision per configuration version. */
  requestDecision(request: PolicyDecisionRequest): Promise<{ decisionId: string }>;
  /** Read at every resolution — derived, never cached. */
  statusOf(workspaceId: string, decisionId: string): Promise<PolicyStatusView>;
}

// ---------------------------------------------------------------- EvidenceSink

export interface EvidenceContribution {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly principalId: string;
  readonly workRef: Readonly<Record<string, unknown>>;
  readonly contractItemId: string;
  readonly attestedArtifact: Readonly<Record<string, unknown>> | null;
  /** An in-toto Statement, the predicate carried inline (`R-039-11`). */
  readonly attestation: Readonly<Record<string, unknown>>;
  readonly source: { readonly uri: string; readonly version: string };
}

export interface EvidenceSink {
  /** `CompletionGate.evaluate` first: is there a binding that would read this evidence? */
  bindingExists(workspaceId: string, workRef: Readonly<Record<string, unknown>>, contractItemId: string): Promise<boolean>;
  contribute(contribution: EvidenceContribution): Promise<{ attestationId: string }>;
}

// ---------------------------------------------------------------- CredentialKeyring

export interface CredentialKeyring {
  activeKey(): { keyId: string; key: Buffer };
  key(keyId: string): Buffer | null;
}

function unbound(port: string, what: string): GovernanceSeamUnboundError {
  return new GovernanceSeamUnboundError(`${port} is not bound: ${what} (EPIC-039 R-039-13). Refusing rather than answering permissively.`, { seam: port });
}

class Seam<T> {
  private bound: T | null = null;
  constructor(private readonly refusing: T) {}
  bind(port: T): void {
    this.bound = port;
  }
  isBound(): boolean {
    return this.bound !== null;
  }
  port(): T {
    return this.bound ?? this.refusing;
  }
}

export class CapabilityPolicySeam extends Seam<CapabilityPolicy> {
  constructor() {
    super({
      requestDecision: async () => {
        throw unbound('CapabilityPolicy', 'EPIC-031 decides whether a project may use an adapter, and it has not merged');
      },
      statusOf: async () => {
        throw unbound('CapabilityPolicy', 'no policy decision can be read until EPIC-031 merges');
      },
    });
  }
}

export class EvidenceSinkSeam extends Seam<EvidenceSink> {
  constructor() {
    super({
      bindingExists: async () => {
        throw unbound('EvidenceSink', "EPIC-032's evidence store is not on this branch");
      },
      contribute: async () => {
        throw unbound('EvidenceSink', "EPIC-032's evidence store is not on this branch");
      },
    });
  }
}

export class CredentialKeyringSeam extends Seam<CredentialKeyring> {
  constructor() {
    super({
      activeKey: () => {
        throw unbound('CredentialKeyring', 'no platform key is configured (PMI_INTEGRATION_KEYS); a credential is never stored in clear');
      },
      key: () => null,
    });
  }
}

export { envKeyring } from './credentials/keyring.js';
