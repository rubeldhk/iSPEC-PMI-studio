/**
 * T429 — FR-PUB-040 against a REAL PostgreSQL: two concurrent publishes of
 * one project are PREVENTED by an advisory lock on the project id, not
 * queued. Two separate database sessions contend on
 * `pg_try_advisory_lock(hashtext(project))` — the in-memory lock cannot
 * prove cross-process prevention; this does.
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { FixtureStorageProvider } from '@pmi/storage-adapter-fixture';
import { ConflictError } from '../../src/core/errors.js';
import { AdvisoryPublishLock } from '../../src/modules/storage/publish-lock.js';
import { PublishService, InMemoryPublishStore, InMemoryProjectArtifacts, OpenPublisherAccess } from '../../src/modules/storage/publish.service.js';
import {
  ConnectionService,
  InMemoryConnectionStore,
  InMemoryProviderRegistry,
  MarkerTokenCipher,
} from '../../src/modules/storage/connection.service.js';
import {
  InMemoryAuthorizationBroker,
  TokenRefreshService,
} from '../../src/modules/storage/token-refresh.service.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_lock';
const PROJECT = 'proj_locked';

function sqlExecutor(client: Client) {
  return {
    async query(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>> {
      const result = await client.query(sql, params as never[]);
      return result.rows as Array<Record<string, unknown>>;
    },
  };
}

suite('T429 · FR-PUB-040 — the advisory lock on project_id', () => {
  let container: StartedPostgreSqlContainer;
  let sessionA: Client;
  let sessionB: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    sessionA = new Client({ connectionString: container.getConnectionUri() });
    sessionB = new Client({ connectionString: container.getConnectionUri() });
    await sessionA.connect();
    await sessionB.connect();
  }, 180_000);

  afterAll(async () => {
    await sessionA?.end();
    await sessionB?.end();
    await container?.stop();
  });

  function buildPublish(lock: AdvisoryPublishLock, shared: {
    provider: FixtureStorageProvider;
    registry: InMemoryProviderRegistry;
    connections: InMemoryConnectionStore;
    store: InMemoryPublishStore;
    artifacts: InMemoryProjectArtifacts;
    cipher: MarkerTokenCipher;
  }): PublishService {
    const connectionService = new ConnectionService(
      shared.connections,
      shared.registry,
      shared.cipher,
      shared.store,
    );
    const tokens = new TokenRefreshService(connectionService, shared.cipher, new InMemoryAuthorizationBroker());
    return new PublishService(
      connectionService,
      shared.registry,
      tokens,
      shared.artifacts,
      new OpenPublisherAccess(),
      shared.store,
      lock,
    );
  }

  it('two API sessions publishing one project: exactly one runs, the other is 409', async () => {
    // Shared platform state (one deployment), two database SESSIONS — the
    // shape of two API processes over one PostgreSQL.
    const provider = new FixtureStorageProvider({ putDelayMs: 50 });
    const registry = new InMemoryProviderRegistry();
    registry.register(provider);
    const shared = {
      provider,
      registry,
      connections: new InMemoryConnectionStore(),
      store: new InMemoryPublishStore(),
      artifacts: new InMemoryProjectArtifacts(),
      cipher: new MarkerTokenCipher(),
    };
    const serviceA = buildPublish(new AdvisoryPublishLock(sqlExecutor(sessionA)), shared);
    const serviceB = buildPublish(new AdvisoryPublishLock(sqlExecutor(sessionB)), shared);

    const connectionService = new ConnectionService(shared.connections, registry, shared.cipher, shared.store);
    await connectionService.connect(WS, {
      providerName: 'fixture',
      destination: 'folder',
      authorisedById: 'u1',
      refreshToken: 'tok',
    });
    shared.artifacts.set(PROJECT, Array.from({ length: 5 }, (_, i) => ({
      artifactType: 'specification',
      artifactId: `spec_${i}`,
      name: `spec_${i}.md`,
      content: `# ${i}`,
      version: 'v1',
    })));

    const [a, b] = await Promise.allSettled([
      serviceA.publish(WS, PROJECT, 'u1'),
      serviceB.publish(WS, PROJECT, 'u2'),
    ]);

    const outcomes = [a, b].map((r) => r.status).sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
    const rejected = [a, b].find((r) => r.status === 'rejected') as PromiseRejectedResult;
    // Prevented — a 409 refusal, not a queued second run.
    expect(rejected.reason).toBeInstanceOf(ConflictError);

    // Exactly ONE publish record exists.
    expect(await shared.store.listForProject(WS, PROJECT)).toHaveLength(1);
  }, 60_000);

  it('the lock releases after the publish — a later publish proceeds', async () => {
    const rows = await sessionB.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [PROJECT]);
    expect(rows.rows[0].locked).toBe(true);
    await sessionB.query('SELECT pg_advisory_unlock(hashtext($1))', [PROJECT]);
  });
});
