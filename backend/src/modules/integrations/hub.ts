/**
 * EPIC-039 — the Integration Hub's services, composed once.
 *
 * Framework-free (PC-1): the Nest module builds this from its providers, and
 * unit tests build it from in-memory parts, so both run the same wiring. Every
 * declared port arrives as a seam bound refusing (`R-039-13`).
 */
import type { AdapterCatalog } from './catalog.service.js';
import { ConfigurationService, type OwnerGatePort } from './configuration.service.js';
import { staticConnectorFacts, type ProjectConnectorFacts, type StaticConnectorFacts } from './connector-facts.js';
import { CredentialCipher } from './credentials/credential.cipher.js';
import { CredentialVault } from './credentials/credential.vault.js';
import { HealthService } from './health/health.service.js';
import type { AuditPort, CapabilityPolicySeam, Clock, CredentialKeyringSeam, EvidenceSinkSeam, ExecutionEventsPort } from './integrations.tokens.js';
import type { IntegrationsStore } from './integrations.store.js';
import { CapabilityRequests } from './requests/capability-requests.service.js';
import { RegistryService, type RegistryAccessPort, type WorkspaceDirectoryPort } from './registry.service.js';
import { ResolverService } from './resolver/resolver.service.js';

export interface HubDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly policy: CapabilityPolicySeam;
  readonly evidence: EvidenceSinkSeam;
  readonly keyring: CredentialKeyringSeam;
  readonly clock: Clock;
  readonly environment: string;
  readonly audit: AuditPort;
  readonly events: ExecutionEventsPort;
  readonly executions: { exists(workspaceId: string, executionId: string): Promise<boolean> };
  readonly projects: { exists(workspaceId: string, projectId: string): Promise<boolean> };
  readonly ownerGate: OwnerGatePort;
  readonly access: RegistryAccessPort;
  readonly workspaces: WorkspaceDirectoryPort;
  readonly projectConnectors: ProjectConnectorFacts;
  readonly connectors?: StaticConnectorFacts;
}

export interface Hub {
  readonly deps: HubDeps;
  readonly cipher: CredentialCipher;
  readonly vault: CredentialVault;
  readonly health: HealthService;
  readonly resolver: ResolverService;
  readonly configuration: ConfigurationService;
  readonly requests: CapabilityRequests;
  readonly registry: RegistryService;
}

export function createHub(deps: HubDeps): Hub {
  const cipher = new CredentialCipher(() => deps.keyring.port());
  const vault = new CredentialVault(deps.store.vaultPort(), cipher);
  const health = new HealthService({ store: deps.store, catalog: deps.catalog, vault, clock: deps.clock });
  const resolver = new ResolverService({ store: deps.store, catalog: deps.catalog, health, policy: deps.policy, clock: deps.clock, environment: deps.environment });
  const configuration = new ConfigurationService({ store: deps.store, catalog: deps.catalog, policy: deps.policy, audit: deps.audit, ownerGate: deps.ownerGate, clock: deps.clock });
  const requests = new CapabilityRequests({ store: deps.store, catalog: deps.catalog, resolver, vault, health, events: deps.events, executions: deps.executions, clock: deps.clock });
  const registry = new RegistryService({
    store: deps.store,
    catalog: deps.catalog,
    health,
    audit: deps.audit,
    access: deps.access,
    workspaces: deps.workspaces,
    connectors: deps.connectors ?? staticConnectorFacts(),
    projectConnectors: deps.projectConnectors,
    projects: deps.projects,
    clock: deps.clock,
  });
  return { deps, cipher, vault, health, resolver, configuration, requests, registry };
}
