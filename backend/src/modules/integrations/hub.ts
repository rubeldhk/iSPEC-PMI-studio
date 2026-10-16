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
import { CredentialService } from './credentials/credential.service.js';
import { CredentialVault } from './credentials/credential.vault.js';
import { DeploymentBindingService } from './embedding/deployment-binding.service.js';
import { HubEmbeddingPort } from './embedding/hub-embedding-port.js';
import { EvidenceIntakeService } from './evidence/evidence-intake.service.js';
import { NotificationService } from './notifications/notification.service.js';
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
  /** Deployment configuration (`PMI_EMBED_ADAPTER`, `PMI_EMBED_BINDING`), read at boot. */
  readonly env?: Readonly<Record<string, string | undefined>>;
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
  readonly credentials: CredentialService;
  readonly intake: EvidenceIntakeService;
  readonly notifications: NotificationService;
  readonly deployment: DeploymentBindingService;
  /** `EPIC-038`'s `EmbeddingPort`, filled (`R-039-18`). */
  readonly embedding: HubEmbeddingPort;
}

export function createHub(deps: HubDeps): Hub {
  const cipher = new CredentialCipher(() => deps.keyring.port());
  const vault = new CredentialVault(deps.store.vaultPort(), cipher);
  const health = new HealthService({ store: deps.store, catalog: deps.catalog, vault, clock: deps.clock });
  const resolver = new ResolverService({ store: deps.store, catalog: deps.catalog, health, policy: deps.policy, clock: deps.clock, environment: deps.environment, vault });
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
  const credentials = new CredentialService({ store: deps.store, catalog: deps.catalog, vault, health, ownerGate: deps.ownerGate, audit: deps.audit, clock: deps.clock });
  const intake = new EvidenceIntakeService({ store: deps.store, requests, evidence: deps.evidence, clock: deps.clock });
  const notifications = new NotificationService({ store: deps.store, requests });
  const deployment = new DeploymentBindingService({ store: deps.store, catalog: deps.catalog, clock: deps.clock, env: deps.env ?? {}, access: deps.access, ensureSeeded: (workspaceId) => registry.ensureSeeded(workspaceId) });
  const embedding = new HubEmbeddingPort({ deployment, catalog: deps.catalog, store: deps.store, clock: deps.clock });
  return { deps, cipher, vault, health, resolver, configuration, requests, registry, credentials, intake, notifications, deployment, embedding };
}
