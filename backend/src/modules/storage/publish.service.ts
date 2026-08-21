/**
 * T391 + T392 + T819 — the publish pipeline (FR-PUB-032, FR-PUB-033,
 * FR-PUB-034, FR-PUB-035, FR-PUB-040).
 *
 * A publish covers THE WHOLE PROJECT: this method's signature offers no
 * artifact-subset parameter, and that absence is the enforcement (T819) — a
 * deselected file must not be expressible, because it cannot be told apart
 * from a deleted one. The only artifacts omitted are those the publisher
 * cannot access (FR-PUB-033), and every one of those is reported with its
 * reason.
 *
 * Every publish writes a record naming what was published, when, by whom,
 * and where it landed — and the record SURVIVES a failed publish, stating
 * what did and did not land (FR-PUB-034).
 */
import type { StorageProvider } from '@pmi/storage-contract';
import { ConflictError, NotFoundError, ProviderUnavailableError, ValidationFailedError } from '../../core/errors.js';
import { publishFailureMessage, type PublishFailureReason } from './publish-failures.js';
import type { ConnectionService, ProviderRegistry } from './connection.service.js';
import type { PublishLock } from './publish-lock.js';
import type { AccessTokenResult } from './token-refresh.service.js';

export type PublishState = 'running' | 'succeeded' | 'partial' | 'failed';

export interface PublishableArtifact {
  artifactType: string;
  artifactId: string;
  name: string;
  content: string;
  version: string;
}

export interface PublishedArtifactEntry {
  artifactType: string;
  artifactId: string;
  name: string;
  landed: boolean;
  destinationLocation: string | null;
  /** Set when the file was skipped rather than written (S6). */
  skippedReason?: PublishFailureReason;
}

export interface ExcludedArtifactEntry {
  artifactType: string;
  artifactId: string;
  name: string;
  reason: string;
}

export interface PublishRecordRow {
  id: string;
  workspaceId: string;
  projectId: string;
  connectionId: string;
  initiatedById: string;
  artifactsIncluded: PublishedArtifactEntry[];
  artifactsExcluded: ExcludedArtifactEntry[];
  state: PublishState;
  failureReason: PublishFailureReason | null;
  failureMessage: string | null;
  destinationLocations: string[];
  publishedAt: Date;
}

export interface PublishedReferenceRow {
  id: string;
  workspaceId: string;
  artifactType: string;
  artifactId: string;
  connectionId: string;
  destinationLocation: string;
  publishedVersion: string;
  stale: boolean;
  noLongerTracked: boolean;
  publishedAt: Date;
}

export interface PublishStore {
  createRecord(record: Omit<PublishRecordRow, 'id'>): Promise<PublishRecordRow>;
  findRecord(workspaceId: string, id: string): Promise<PublishRecordRow | null>;
  listForProject(workspaceId: string, projectId: string): Promise<PublishRecordRow[]>;
  upsertReference(
    reference: Omit<PublishedReferenceRow, 'id' | 'stale' | 'noLongerTracked'>,
  ): Promise<PublishedReferenceRow>;
  listReferences(workspaceId: string, connectionId: string): Promise<PublishedReferenceRow[]>;
  markReferenceStale(workspaceId: string, referenceId: string): Promise<PublishedReferenceRow>;
  markAllUntracked(workspaceId: string, connectionId: string): Promise<number>;
}

/** The whole project's artifacts — the source offers no narrower read. */
export interface ProjectArtifactSource {
  listForProject(workspaceId: string, projectId: string): Promise<PublishableArtifact[]>;
}

/** FR-PUB-033 — wired to EPIC-024's enforcement at the composition root. */
export interface PublisherAccessPort {
  canRead(
    workspaceId: string,
    userId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<boolean>;
}

export interface AccessTokenSource {
  accessTokenFor(workspaceId: string, connectionId: string): Promise<AccessTokenResult>;
}

export class PublishService {
  constructor(
    private readonly connections: ConnectionService,
    private readonly registry: ProviderRegistry,
    private readonly tokens: AccessTokenSource,
    private readonly artifacts: ProjectArtifactSource,
    private readonly access: PublisherAccessPort,
    private readonly store: PublishStore,
    private readonly lock: PublishLock,
  ) {}

  /**
   * NOTE the signature: workspace, project, initiator, time. No artifact
   * list, no filter, no subset — FR-PUB-032 made structural (T819).
   */
  async publish(
    workspaceId: string,
    projectId: string,
    initiatedById: string,
    at?: Date,
  ): Promise<PublishRecordRow> {
    // FR-PUB-040 — prevented, not queued.
    if (!(await this.lock.acquire(projectId))) {
      throw new ConflictError('A publish of this project is already running — it was prevented, not queued.');
    }
    try {
      return await this.run(workspaceId, projectId, initiatedById, at ?? new Date());
    } finally {
      await this.lock.release(projectId);
    }
  }

  async getRecord(workspaceId: string, id: string): Promise<PublishRecordRow> {
    const record = await this.store.findRecord(workspaceId, id);
    if (!record) throw new NotFoundError('Not found.');
    return record;
  }

  async listRecords(workspaceId: string, projectId: string): Promise<PublishRecordRow[]> {
    return this.store.listForProject(workspaceId, projectId);
  }

  private async run(
    workspaceId: string,
    projectId: string,
    initiatedById: string,
    when: Date,
  ): Promise<PublishRecordRow> {
    const connection = await this.connections.activeConnection(workspaceId);
    if (!connection) {
      throw new ValidationFailedError('No storage connection exists for this workspace — connect a provider first.');
    }
    const provider = this.registry.get(connection.providerName);
    if (!provider) {
      throw new ValidationFailedError(`Provider "${connection.providerName}" is no longer registered.`);
    }
    const descriptor = { providerName: connection.providerName, destination: connection.destination };

    // FR-PUB-031 — unreachable is reported BEFORE anything is sent.
    const health = await provider.checkHealth(descriptor);
    if (!health.ok || health.value === 'unavailable') {
      throw new ProviderUnavailableError(publishFailureMessage('provider_unavailable'));
    }

    // FR-PUB-032 — the WHOLE project.
    const all = await this.artifacts.listForProject(workspaceId, projectId);
    const included: PublishableArtifact[] = [];
    const excluded: ExcludedArtifactEntry[] = [];
    for (const artifact of all) {
      if (await this.access.canRead(workspaceId, initiatedById, artifact)) {
        included.push(artifact);
      } else {
        // FR-PUB-033 — excluded AND reported, never silently dropped.
        excluded.push({
          artifactType: artifact.artifactType,
          artifactId: artifact.artifactId,
          name: artifact.name,
          reason: 'The publisher does not have access to this artifact.',
        });
      }
    }

    // Authorisation up front: a connection that cannot mint an access token
    // records a failed publish rather than a generic error (FR-PUB-034).
    const token = await this.tokens.accessTokenFor(workspaceId, connection.id);
    if (!token.ok) {
      return this.store.createRecord({
        workspaceId,
        projectId,
        connectionId: connection.id,
        initiatedById,
        artifactsIncluded: included.map((a) => ({
          artifactType: a.artifactType,
          artifactId: a.artifactId,
          name: a.name,
          landed: false,
          destinationLocation: null,
        })),
        artifactsExcluded: excluded,
        state: 'failed',
        failureReason: 'authorisation_expired',
        failureMessage: publishFailureMessage('authorisation_expired'),
        destinationLocations: [],
        publishedAt: when,
      });
    }

    const entries: PublishedArtifactEntry[] = [];
    const destinations: string[] = [];
    let failure: { reason: PublishFailureReason; message: string } | null = null;

    for (const artifact of included) {
      if (failure) {
        // The publish stopped: everything after the failure did not land,
        // and the record says so (FR-PUB-034).
        entries.push({
          artifactType: artifact.artifactType,
          artifactId: artifact.artifactId,
          name: artifact.name,
          landed: false,
          destinationLocation: null,
        });
        continue;
      }
      // FR-PUB-034 — per-project organisation at the destination.
      const outcome = await provider.putFile(
        descriptor,
        {
          name: `${projectId}/${artifact.name}`,
          content: artifact.content,
          sizeBytes: artifact.content.length,
        },
        token.accessToken,
      );
      if (!outcome.ok) {
        failure = { reason: outcome.failure.reason, message: outcome.failure.message };
        entries.push({
          artifactType: artifact.artifactType,
          artifactId: artifact.artifactId,
          name: artifact.name,
          landed: false,
          destinationLocation: null,
        });
        continue;
      }
      if (outcome.value.status === 'skipped') {
        // S6 — skipped and reported; the rest continue.
        entries.push({
          artifactType: artifact.artifactType,
          artifactId: artifact.artifactId,
          name: artifact.name,
          landed: false,
          destinationLocation: null,
          skippedReason: outcome.value.skippedReason ?? 'size_limit_exceeded',
        });
        continue;
      }
      const location = outcome.value.destinationLocation as string;
      entries.push({
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        name: artifact.name,
        landed: true,
        destinationLocation: location,
      });
      destinations.push(location);
      await this.store.upsertReference({
        workspaceId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        connectionId: connection.id,
        destinationLocation: location,
        publishedVersion: artifact.version,
        publishedAt: when,
      });
    }

    const landed = entries.filter((e) => e.landed).length;
    const state: PublishState = failure
      ? landed > 0
        ? 'partial'
        : 'failed'
      : 'succeeded';

    return this.store.createRecord({
      workspaceId,
      projectId,
      connectionId: connection.id,
      initiatedById,
      artifactsIncluded: entries,
      artifactsExcluded: excluded,
      state,
      failureReason: failure?.reason ?? null,
      failureMessage: failure ? publishFailureMessage(failure.reason) : null,
      destinationLocations: destinations,
      publishedAt: when,
    });
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryPublishStore implements PublishStore {
  private readonly records = new Map<string, PublishRecordRow>();
  private readonly references = new Map<string, PublishedReferenceRow>();
  private seq = 0;

  async createRecord(record: Omit<PublishRecordRow, 'id'>): Promise<PublishRecordRow> {
    const row: PublishRecordRow = { id: `pub_${++this.seq}`, ...record };
    this.records.set(row.id, row);
    return { ...row };
  }

  async findRecord(workspaceId: string, id: string): Promise<PublishRecordRow | null> {
    const row = this.records.get(id);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<PublishRecordRow[]> {
    return [...this.records.values()]
      .filter((r) => r.workspaceId === workspaceId && r.projectId === projectId)
      .map((r) => ({ ...r }));
  }

  async upsertReference(
    reference: Omit<PublishedReferenceRow, 'id' | 'stale' | 'noLongerTracked'>,
  ): Promise<PublishedReferenceRow> {
    for (const row of this.references.values()) {
      if (
        row.workspaceId === reference.workspaceId &&
        row.connectionId === reference.connectionId &&
        row.artifactType === reference.artifactType &&
        row.artifactId === reference.artifactId
      ) {
        const next: PublishedReferenceRow = { ...row, ...reference, stale: false };
        this.references.set(row.id, next);
        return { ...next };
      }
    }
    const created: PublishedReferenceRow = {
      id: `ref_${++this.seq}`,
      stale: false,
      noLongerTracked: false,
      ...reference,
    };
    this.references.set(created.id, created);
    return { ...created };
  }

  async listReferences(workspaceId: string, connectionId: string): Promise<PublishedReferenceRow[]> {
    return [...this.references.values()]
      .filter((r) => r.workspaceId === workspaceId && r.connectionId === connectionId)
      .map((r) => ({ ...r }));
  }

  async markReferenceStale(workspaceId: string, referenceId: string): Promise<PublishedReferenceRow> {
    const row = this.references.get(referenceId);
    if (!row || row.workspaceId !== workspaceId) throw new Error('No such reference.');
    const next = { ...row, stale: true };
    this.references.set(referenceId, next);
    return { ...next };
  }

  async markAllUntracked(workspaceId: string, connectionId: string): Promise<number> {
    let marked = 0;
    for (const [id, row] of this.references) {
      if (row.workspaceId === workspaceId && row.connectionId === connectionId && !row.noLongerTracked) {
        this.references.set(id, { ...row, noLongerTracked: true });
        marked += 1;
      }
    }
    return marked;
  }
}

/** Test/composition helper: a fixed artifact register per project. */
export class InMemoryProjectArtifacts implements ProjectArtifactSource {
  private readonly byProject = new Map<string, PublishableArtifact[]>();

  set(projectId: string, artifacts: PublishableArtifact[]): void {
    this.byProject.set(projectId, artifacts.map((a) => ({ ...a })));
  }

  async listForProject(_workspaceId: string, projectId: string): Promise<PublishableArtifact[]> {
    return (this.byProject.get(projectId) ?? []).map((a) => ({ ...a }));
  }
}

/** Everyone-can-read default; tests swap in a denying implementation. */
export class OpenPublisherAccess implements PublisherAccessPort {
  async canRead(): Promise<boolean> {
    return true;
  }
}
