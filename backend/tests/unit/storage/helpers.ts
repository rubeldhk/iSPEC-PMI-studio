/**
 * EPIC-025 test harness — the storage service graph over in-memory stores,
 * with the FIXTURE provider registered. The fixture is a devDependency and a
 * test concern only: `backend/src` never imports it (T432).
 */
import { FixtureStorageProvider } from '@pmi/storage-adapter-fixture';
import {
  ConnectionService,
  InMemoryConnectionStore,
  InMemoryProviderRegistry,
  MarkerTokenCipher,
} from '../../../src/modules/storage/connection.service.js';
import { InMemoryPublishLock } from '../../../src/modules/storage/publish-lock.js';
import {
  InMemoryProjectArtifacts,
  InMemoryPublishStore,
  PublishService,
  type PublishableArtifact,
  type PublisherAccessPort,
} from '../../../src/modules/storage/publish.service.js';
import { ProviderSwitchService } from '../../../src/modules/storage/provider-switch.service.js';
import { RepublishService } from '../../../src/modules/storage/republish.service.js';
import {
  InMemoryAuthorizationBroker,
  TokenRefreshService,
} from '../../../src/modules/storage/token-refresh.service.js';

export const WS = 'ws_a';
export const USER = 'u_publisher';
export const PROJECT = 'proj_1';
export const DESTINATION = 'team-folder';

export class DenyListAccess implements PublisherAccessPort {
  private readonly denied = new Set<string>();

  deny(artifactId: string): void {
    this.denied.add(artifactId);
  }

  async canRead(
    _ws: string,
    _userId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<boolean> {
    return !this.denied.has(artifact.artifactId);
  }
}

export interface StorageHarness {
  provider: FixtureStorageProvider;
  registry: InMemoryProviderRegistry;
  connections: InMemoryConnectionStore;
  store: InMemoryPublishStore;
  artifacts: InMemoryProjectArtifacts;
  access: DenyListAccess;
  broker: InMemoryAuthorizationBroker;
  cipher: MarkerTokenCipher;
  lock: InMemoryPublishLock;
  connectionService: ConnectionService;
  tokenRefresh: TokenRefreshService;
  publish: PublishService;
  republish: RepublishService;
  providerSwitch: ProviderSwitchService;
}

export function storageHarness(options: { maxFileSizeBytes?: number; putDelayMs?: number } = {}): StorageHarness {
  const provider = new FixtureStorageProvider(options);
  const registry = new InMemoryProviderRegistry();
  registry.register(provider);
  const connections = new InMemoryConnectionStore();
  const store = new InMemoryPublishStore();
  const artifacts = new InMemoryProjectArtifacts();
  const access = new DenyListAccess();
  const broker = new InMemoryAuthorizationBroker();
  const cipher = new MarkerTokenCipher();
  const lock = new InMemoryPublishLock();

  const connectionService = new ConnectionService(connections, registry, cipher, store);
  const tokenRefresh = new TokenRefreshService(connectionService, cipher, broker);
  const publish = new PublishService(
    connectionService,
    registry,
    tokenRefresh,
    artifacts,
    access,
    store,
    lock,
  );
  const republish = new RepublishService(connectionService, registry, artifacts, store);
  const providerSwitch = new ProviderSwitchService(connectionService, store);

  return {
    provider, registry, connections, store, artifacts, access, broker, cipher, lock,
    connectionService, tokenRefresh, publish, republish, providerSwitch,
  };
}

export function artifact(id: string, version = 'v1'): PublishableArtifact {
  return {
    artifactType: 'specification',
    artifactId: id,
    name: `${id}.md`,
    content: `# ${id}`,
    version,
  };
}

/** A connected harness with `count` artifacts in the project. */
export async function connected(
  h: StorageHarness,
  count = 2,
): Promise<{ connectionId: string; artifacts: PublishableArtifact[] }> {
  const view = await h.connectionService.connect(WS, {
    providerName: 'fixture',
    destination: DESTINATION,
    authorisedById: USER,
    refreshToken: 'refresh-secret-token',
  });
  const rows = Array.from({ length: count }, (_, i) => artifact(`spec_${i + 1}`));
  h.artifacts.set(PROJECT, rows);
  return { connectionId: view.id, artifacts: rows };
}
