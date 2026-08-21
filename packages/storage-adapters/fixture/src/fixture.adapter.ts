/**
 * T396 — the fixture storage provider, mirroring the engine fixture pattern.
 *
 * Deliberately trivial, in-memory, with injectable failures for every reason
 * in the taxonomy. It exists for the same three reasons the fixture engine
 * does: it makes SC-011 testable (a second provider proves
 * interchangeability), it keeps the suite fast/deterministic/offline, and it
 * proves every downstream consumer correct BEFORE a real provider SDK is
 * integrated.
 *
 * Contract rules implemented here: S1 (returns, never throws), S5 (three
 * distinct health states), S6 (oversize skipped, not failed), S8 (invalid
 * names adapted and reported).
 */
import {
  storageFail,
  storageOk,
  type ConnectConfig,
  type ConnectionDescriptor,
  type DestinationEntry,
  type FileToPut,
  type HealthStatus,
  type PutOutcome,
  type StorageDescriptor,
  type StorageFailureReason,
  type StorageProvider,
  type StorageResult,
} from '@pmi/storage-contract';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

/**
 * Characters the fixture "destination" refuses in a name (S8). `/` is NOT
 * here: path separators are legitimate destination structure — publishing
 * organises per project as `{projectId}/{file}`.
 */
const INVALID_NAME = /[\\:*?"<>|]/g;

export interface FixtureStorageOptions {
  maxFileSizeBytes?: number;
  /** Milliseconds each putFile takes — for concurrency tests. */
  putDelayMs?: number;
}

interface StoredFile {
  name: string;
  content: string;
  publishedVersion: string | null;
}

export class FixtureStorageProvider implements StorageProvider {
  readonly descriptor: StorageDescriptor;

  private injected: StorageFailureReason | null = null;
  private expireAfterPuts: number | null = null;
  private puts = 0;
  private readonly destinations = new Map<string, Map<string, StoredFile>>();
  private readonly options: FixtureStorageOptions;

  constructor(options: FixtureStorageOptions = {}) {
    this.options = options;
    this.descriptor = {
      name: 'fixture',
      version: '1.0.0',
      capabilities: ['connect', 'checkHealth', 'putFile', 'listDestination'],
      maxFileSizeBytes: options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE,
    };
  }

  /** Inject the named failure into subsequent operations. */
  failWith(reason: StorageFailureReason): void {
    this.injected = reason;
  }

  clearFailure(): void {
    this.injected = null;
    this.expireAfterPuts = null;
  }

  /** Authorisation expires after `puts` further successful writes (SC-06). */
  expireAuthorisationAfter(puts: number): void {
    this.expireAfterPuts = this.puts + puts;
  }

  async connect(config: ConnectConfig): Promise<StorageResult<ConnectionDescriptor>> {
    if (this.injected) return this.injectedFailure();
    if (!config.destination || config.destination.trim() === '') {
      return storageFail('destination_missing', 'No destination was selected within the provider.');
    }
    if (!this.destinations.has(config.destination)) {
      this.destinations.set(config.destination, new Map());
    }
    return storageOk({ providerName: this.descriptor.name, destination: config.destination });
  }

  async checkHealth(_connection: ConnectionDescriptor): Promise<StorageResult<HealthStatus>> {
    // S5 — a status is an ANSWER, not an error: the result is ok with the
    // distinct state, and an unreachable provider is never 'healthy'.
    if (this.injected === 'provider_unavailable') return storageOk('unavailable' as HealthStatus);
    if (this.injected === 'authorisation_expired') {
      return storageOk('needs_reauthorisation' as HealthStatus);
    }
    return storageOk('healthy' as HealthStatus);
  }

  async putFile(
    connection: ConnectionDescriptor,
    file: FileToPut,
    _accessToken?: string,
  ): Promise<StorageResult<PutOutcome>> {
    if (this.options.putDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.putDelayMs));
    }
    if (this.injected) return this.injectedFailure();
    if (this.expireAfterPuts !== null && this.puts >= this.expireAfterPuts) {
      return storageFail('authorisation_expired', 'Authorisation expired mid-publish — re-authorise the connection.');
    }
    const folder = this.destinations.get(connection.destination);
    if (!folder) {
      return storageFail('destination_missing', `Destination "${connection.destination}" does not exist.`);
    }

    // S6 — oversize is a REPORTED SKIP, never a publish failure.
    const limit = this.descriptor.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
    if (file.sizeBytes > limit) {
      return storageOk({
        status: 'skipped',
        name: file.name,
        destinationLocation: null,
        skippedReason: 'size_limit_exceeded',
      } as PutOutcome);
    }

    // S8 — invalid names are adapted and the adaptation reported.
    const safeName = file.name.replace(INVALID_NAME, '_');
    const adapted = safeName !== file.name;
    const version = `v${this.puts + 1}`;
    folder.set(safeName, { name: safeName, content: file.content, publishedVersion: version });
    this.puts += 1;
    const outcome: PutOutcome = {
      status: 'written',
      name: safeName,
      destinationLocation: `${connection.destination}/${safeName}`,
      ...(adapted ? { adaptedFrom: file.name } : {}),
    };
    return storageOk(outcome);
  }

  async listDestination(
    connection: ConnectionDescriptor,
    _path?: string,
  ): Promise<StorageResult<DestinationEntry[]>> {
    if (this.injected) return this.injectedFailure();
    const folder = this.destinations.get(connection.destination);
    if (!folder) {
      return storageFail('destination_missing', `Destination "${connection.destination}" does not exist.`);
    }
    return storageOk(
      [...folder.values()].map((f) => ({ name: f.name, publishedVersion: f.publishedVersion })),
    );
  }

  /** Test hook — what the destination holds, content included. */
  destinationContents(destination: string): Map<string, StoredFile> {
    return new Map(this.destinations.get(destination) ?? []);
  }

  private injectedFailure<T>(): StorageResult<T> {
    const reason = this.injected as StorageFailureReason;
    return storageFail(reason, `Injected fixture failure: ${reason}.`);
  }
}
