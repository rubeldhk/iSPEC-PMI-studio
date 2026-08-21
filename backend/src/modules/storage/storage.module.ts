/**
 * EPIC-025 — storage module wiring (F-02.6).
 *
 * Note what is absent: any import of `packages/storage-adapters/*` or a
 * provider SDK. Providers are supplied on the PROVIDER_REGISTRY token at the
 * composition root, exactly as engines are supplied at the worker's —
 * enforced by the architecture test (T432). The publisher-access port is
 * wired to EPIC-024's enforcement so FR-PUB-033 reads the live grant table.
 */
import { Module } from '@nestjs/common';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { AccessModule } from '../access/access.module.js';
import {
  ConnectionService,
  InMemoryConnectionStore,
  InMemoryProviderRegistry,
  MarkerTokenCipher,
  type ConnectionStore,
  type ProviderRegistry,
  type TokenCipher,
} from './connection.service.js';
import { ConnectionsController } from './connections.controller.js';
import { InMemoryPublishLock, type PublishLock } from './publish-lock.js';
import { PublishController } from './publish.controller.js';
import {
  InMemoryProjectArtifacts,
  InMemoryPublishStore,
  PublishService,
  type ProjectArtifactSource,
  type PublisherAccessPort,
  type PublishStore,
} from './publish.service.js';
import { ProviderSwitchService } from './provider-switch.service.js';
import { RepublishService } from './republish.service.js';
import {
  InMemoryAuthorizationBroker,
  TokenRefreshService,
  type AuthorizationBroker,
} from './token-refresh.service.js';

export const CONNECTION_STORE = Symbol('CONNECTION_STORE');
export const PROVIDER_REGISTRY = Symbol('PROVIDER_REGISTRY');
export const TOKEN_CIPHER = Symbol('TOKEN_CIPHER');
export const AUTHORIZATION_BROKER = Symbol('AUTHORIZATION_BROKER');
export const PUBLISH_STORE = Symbol('PUBLISH_STORE');
export const PROJECT_ARTIFACT_SOURCE = Symbol('PROJECT_ARTIFACT_SOURCE');
export const PUBLISH_LOCK = Symbol('PUBLISH_LOCK');
export const PUBLISHER_ACCESS = Symbol('PUBLISHER_ACCESS');

@Module({
  imports: [AccessModule],
  controllers: [ConnectionsController, PublishController],
  providers: [
    { provide: CONNECTION_STORE, useFactory: (): ConnectionStore => new InMemoryConnectionStore() },
    { provide: PROVIDER_REGISTRY, useFactory: (): ProviderRegistry => new InMemoryProviderRegistry() },
    { provide: TOKEN_CIPHER, useFactory: (): TokenCipher => new MarkerTokenCipher() },
    { provide: AUTHORIZATION_BROKER, useFactory: (): AuthorizationBroker => new InMemoryAuthorizationBroker() },
    { provide: PUBLISH_STORE, useFactory: (): PublishStore => new InMemoryPublishStore() },
    {
      provide: PROJECT_ARTIFACT_SOURCE,
      useFactory: (): ProjectArtifactSource => new InMemoryProjectArtifacts(),
    },
    { provide: PUBLISH_LOCK, useFactory: (): PublishLock => new InMemoryPublishLock() },
    {
      // FR-PUB-033 — the live seam to EPIC-024: publish exclusion follows the
      // same effective-readability rule listings follow.
      provide: PUBLISHER_ACCESS,
      inject: [AccessInheritanceService],
      useFactory: (inheritance: AccessInheritanceService): PublisherAccessPort => ({
        canRead: (workspaceId, userId, artifact) =>
          inheritance.effectivelyReadable(workspaceId, userId, artifact),
      }),
    },
    {
      provide: ConnectionService,
      inject: [CONNECTION_STORE, PROVIDER_REGISTRY, TOKEN_CIPHER, PUBLISH_STORE],
      useFactory: (
        connections: ConnectionStore,
        registry: ProviderRegistry,
        cipher: TokenCipher,
        store: PublishStore,
      ): ConnectionService => new ConnectionService(connections, registry, cipher, store),
    },
    {
      provide: TokenRefreshService,
      inject: [ConnectionService, TOKEN_CIPHER, AUTHORIZATION_BROKER],
      useFactory: (
        connections: ConnectionService,
        cipher: TokenCipher,
        broker: AuthorizationBroker,
      ): TokenRefreshService => new TokenRefreshService(connections, cipher, broker),
    },
    {
      provide: PublishService,
      inject: [
        ConnectionService,
        PROVIDER_REGISTRY,
        TokenRefreshService,
        PROJECT_ARTIFACT_SOURCE,
        PUBLISHER_ACCESS,
        PUBLISH_STORE,
        PUBLISH_LOCK,
      ],
      useFactory: (
        connections: ConnectionService,
        registry: ProviderRegistry,
        tokens: TokenRefreshService,
        artifacts: ProjectArtifactSource,
        access: PublisherAccessPort,
        store: PublishStore,
        lock: PublishLock,
      ): PublishService =>
        new PublishService(connections, registry, tokens, artifacts, access, store, lock),
    },
    {
      provide: RepublishService,
      inject: [ConnectionService, PROVIDER_REGISTRY, PROJECT_ARTIFACT_SOURCE, PUBLISH_STORE],
      useFactory: (
        connections: ConnectionService,
        registry: ProviderRegistry,
        artifacts: ProjectArtifactSource,
        store: PublishStore,
      ): RepublishService => new RepublishService(connections, registry, artifacts, store),
    },
    {
      provide: ProviderSwitchService,
      inject: [ConnectionService, PUBLISH_STORE],
      useFactory: (connections: ConnectionService, store: PublishStore): ProviderSwitchService =>
        new ProviderSwitchService(connections, store),
    },
  ],
  exports: [
    ConnectionService,
    TokenRefreshService,
    PublishService,
    RepublishService,
    ProviderSwitchService,
    CONNECTION_STORE,
    PROVIDER_REGISTRY,
    TOKEN_CIPHER,
    PUBLISH_STORE,
    PROJECT_ARTIFACT_SOURCE,
    PUBLISH_LOCK,
  ],
})
export class StorageModule {}
