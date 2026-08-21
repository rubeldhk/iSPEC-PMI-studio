/**
 * T390 + T450 — connection lifecycle, health reporting, and credential
 * handling (FR-PUB-029, FR-PUB-029b, FR-PUB-031, SC-014).
 *
 * Authorisation is delegated OAuth-style: the platform stores a REFRESH
 * TOKEN encrypted at rest and never accepts a provider account password.
 * The token is never returned by any endpoint — `ConnectionView`, the only
 * shape this service hands outward, has no field to carry it — and it is
 * DISCARDED on disconnection. Key management for the cipher itself is a
 * deployment concern.
 *
 * Disconnection touches no platform artifact: it is a timestamp, a token
 * discard, and a marking pass over the published-file references.
 */
import {
  missingRequiredCapabilities,
  type HealthStatus,
  type StorageProvider,
} from '@pmi/storage-contract';
import { NotFoundError, ProviderUnavailableError, ValidationFailedError } from '../../core/errors.js';

const OPAQUE = 'Not found.';

export interface StorageConnectionRecord {
  id: string;
  workspaceId: string;
  providerName: string;
  destination: string;
  status: HealthStatus;
  authorisedById: string;
  /** Encrypted at rest. NEVER copied into a view. */
  refreshTokenEncrypted: string | null;
  lastCheckedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
}

/** The ONLY outward shape — deliberately no token field (FR-PUB-029b). */
export interface ConnectionView {
  id: string;
  providerName: string;
  destination: string;
  status: HealthStatus;
  authorisedById: string;
  lastCheckedAt: Date | null;
  disconnectedAt: Date | null;
}

export function toConnectionView(record: StorageConnectionRecord): ConnectionView {
  return {
    id: record.id,
    providerName: record.providerName,
    destination: record.destination,
    status: record.status,
    authorisedById: record.authorisedById,
    lastCheckedAt: record.lastCheckedAt,
    disconnectedAt: record.disconnectedAt,
  };
}

export interface ConnectionStore {
  create(record: Omit<StorageConnectionRecord, 'id'>): Promise<StorageConnectionRecord>;
  find(workspaceId: string, id: string): Promise<StorageConnectionRecord | null>;
  listForWorkspace(workspaceId: string): Promise<StorageConnectionRecord[]>;
  update(
    workspaceId: string,
    id: string,
    patch: Partial<StorageConnectionRecord>,
  ): Promise<StorageConnectionRecord>;
}

/** The deployment's registered providers — the engine-registry pattern. */
export interface ProviderRegistry {
  get(name: string): StorageProvider | null;
}

/** Encryption at rest; key management belongs to the deployment. */
export interface TokenCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

/** Marks references when a connection goes away — never deletes them. */
export interface ReferenceUntracker {
  markAllUntracked(workspaceId: string, connectionId: string): Promise<number>;
}

export interface ConnectInput {
  providerName?: string;
  destination?: string;
  authorisedById: string;
  refreshToken?: string;
  /** Present at all → refused. The platform never accepts one (FR-PUB-029b). */
  password?: string;
}

export class ConnectionService {
  constructor(
    private readonly connections: ConnectionStore,
    private readonly registry: ProviderRegistry,
    private readonly cipher: TokenCipher,
    private readonly references: ReferenceUntracker,
  ) {}

  async connect(workspaceId: string, input: ConnectInput, at?: Date): Promise<ConnectionView> {
    if (input.password !== undefined) {
      throw new ValidationFailedError(
        'The platform never accepts a provider account password — authorisation is delegated.',
        { fields: [{ field: 'password', reason: 'Never accepted (FR-PUB-029b).' }] },
      );
    }
    if (!input.providerName) {
      throw new ValidationFailedError('A connection requires a provider type.', {
        fields: [{ field: 'providerType', reason: 'Required.' }],
      });
    }
    if (!input.destination || input.destination.trim() === '') {
      throw new ValidationFailedError('A connection requires a destination selected within the provider.', {
        fields: [{ field: 'destination', reason: 'Required (FR-PUB-029).' }],
      });
    }
    const provider = this.registry.get(input.providerName);
    if (!provider) {
      throw new ValidationFailedError(`No storage provider named "${input.providerName}" is registered.`, {
        fields: [{ field: 'providerType', reason: 'Unknown provider.' }],
      });
    }
    // FR-PUB-039 — refused at connection time, NAMING the missing capability.
    const missing = missingRequiredCapabilities(provider.descriptor);
    if (missing.length > 0) {
      throw new ValidationFailedError(
        `Provider "${input.providerName}" is missing required capabilities: ${missing.join(', ')}.`,
        { missingCapabilities: missing },
      );
    }

    const connected = await provider.connect({ destination: input.destination });
    if (!connected.ok) {
      if (connected.failure.reason === 'provider_unavailable') {
        throw new ProviderUnavailableError(connected.failure.message);
      }
      throw new ValidationFailedError(connected.failure.message, {
        reason: connected.failure.reason,
      });
    }

    const record = await this.connections.create({
      workspaceId,
      providerName: input.providerName,
      destination: input.destination,
      status: 'healthy',
      authorisedById: input.authorisedById,
      refreshTokenEncrypted:
        input.refreshToken !== undefined ? this.cipher.encrypt(input.refreshToken) : null,
      lastCheckedAt: null,
      disconnectedAt: null,
      createdAt: at ?? new Date(),
    });
    return toConnectionView(record);
  }

  async list(workspaceId: string): Promise<ConnectionView[]> {
    const rows = await this.connections.listForWorkspace(workspaceId);
    return rows.map(toConnectionView);
  }

  async get(workspaceId: string, id: string): Promise<StorageConnectionRecord> {
    const record = await this.connections.find(workspaceId, id);
    if (!record) throw new NotFoundError(OPAQUE);
    return record;
  }

  /** The workspace's live connection — at most one is active at a time. */
  async activeConnection(workspaceId: string): Promise<StorageConnectionRecord | null> {
    const rows = await this.connections.listForWorkspace(workspaceId);
    return rows.find((c) => c.disconnectedAt === null) ?? null;
  }

  /**
   * FR-PUB-031 — three distinct states, and an unreachable provider reports
   * `unavailable`, NEVER `healthy`.
   */
  async health(workspaceId: string, id: string, at?: Date): Promise<HealthStatus> {
    const record = await this.get(workspaceId, id);
    const provider = this.registry.get(record.providerName);
    if (!provider) return 'unavailable';
    const result = await provider.checkHealth({
      providerName: record.providerName,
      destination: record.destination,
    });
    const status: HealthStatus = result.ok
      ? result.value
      : result.failure.reason === 'authorisation_expired'
        ? 'needs_reauthorisation'
        : 'unavailable';
    await this.connections.update(workspaceId, id, { status, lastCheckedAt: at ?? new Date() });
    return status;
  }

  async markNeedsReauthorisation(workspaceId: string, id: string): Promise<void> {
    await this.connections.update(workspaceId, id, { status: 'needs_reauthorisation' });
  }

  /**
   * FR-PUB-037/038 + SC-014 — disconnection: the token is DISCARDED, the
   * references are marked no longer tracked, and nothing at the provider or
   * on the platform is deleted.
   */
  async disconnect(workspaceId: string, id: string, at?: Date): Promise<ConnectionView> {
    const record = await this.get(workspaceId, id);
    const updated = await this.connections.update(workspaceId, record.id, {
      disconnectedAt: at ?? new Date(),
      refreshTokenEncrypted: null,
    });
    await this.references.markAllUntracked(workspaceId, record.id);
    return toConnectionView(updated);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryConnectionStore implements ConnectionStore {
  private readonly rows = new Map<string, StorageConnectionRecord>();
  private seq = 0;

  async create(record: Omit<StorageConnectionRecord, 'id'>): Promise<StorageConnectionRecord> {
    const row: StorageConnectionRecord = { id: `conn_${++this.seq}`, ...record };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async find(workspaceId: string, id: string): Promise<StorageConnectionRecord | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async listForWorkspace(workspaceId: string): Promise<StorageConnectionRecord[]> {
    return [...this.rows.values()]
      .filter((c) => c.workspaceId === workspaceId)
      .map((c) => ({ ...c }));
  }

  async update(
    workspaceId: string,
    id: string,
    patch: Partial<StorageConnectionRecord>,
  ): Promise<StorageConnectionRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const next = { ...row, ...patch };
    this.rows.set(id, next);
    return { ...next };
  }
}

export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<string, StorageProvider>();

  register(provider: StorageProvider): void {
    this.providers.set(provider.descriptor.name, provider);
  }

  get(name: string): StorageProvider | null {
    return this.providers.get(name) ?? null;
  }
}

/**
 * Reversible marker cipher for tests and DB-less boots. At-rest form is
 * visibly NOT the plaintext; a real deployment supplies a key-managed AES
 * implementation on the same token.
 */
export class MarkerTokenCipher implements TokenCipher {
  encrypt(plaintext: string): string {
    return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith('enc:')) throw new Error('Not an at-rest token.');
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8');
  }
}
