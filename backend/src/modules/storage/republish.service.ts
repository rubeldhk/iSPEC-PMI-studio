/**
 * T394 — the republish preview (FR-PUB-036): what will be added, replaced,
 * or left alone, computed BEFORE any write. The whole method is reads — it
 * takes no lock, writes no record, and touches no provider state, which is
 * what "before changing anything" means in code.
 *
 * The comparison baseline is always the WHOLE project (FR-PUB-032): a
 * deselected file is not expressible, so the preview can never confuse one
 * with a deleted one.
 */
import { ProviderUnavailableError, ValidationFailedError } from '../../core/errors.js';
import type { ConnectionService, ProviderRegistry } from './connection.service.js';
import type { ProjectArtifactSource, PublishStore } from './publish.service.js';

export interface RepublishPreview {
  added: string[];
  replaced: string[];
  unchanged: string[];
}

export class RepublishService {
  constructor(
    private readonly connections: ConnectionService,
    private readonly registry: ProviderRegistry,
    private readonly artifacts: ProjectArtifactSource,
    private readonly store: PublishStore,
  ) {}

  async preview(workspaceId: string, projectId: string): Promise<RepublishPreview> {
    const connection = await this.connections.activeConnection(workspaceId);
    if (!connection) {
      throw new ValidationFailedError('No storage connection exists for this workspace — connect a provider first.');
    }
    const provider = this.registry.get(connection.providerName);
    if (!provider) {
      throw new ValidationFailedError(`Provider "${connection.providerName}" is no longer registered.`);
    }
    const descriptor = { providerName: connection.providerName, destination: connection.destination };

    // PRESENCE comes from the destination; VERSIONS come from the platform's
    // own references — the provider is never asked what a version means
    // (S4/SC-012: the platform does not read back).
    const listed = await provider.listDestination(descriptor);
    if (!listed.ok) {
      throw new ProviderUnavailableError(listed.failure.message);
    }
    const atDestination = new Set(listed.value.map((e) => e.name));
    const references = await this.store.listReferences(workspaceId, connection.id);
    const publishedVersions = new Map(
      references
        .filter((r) => !r.noLongerTracked)
        .map((r) => [`${r.artifactType}:${r.artifactId}`, r.publishedVersion]),
    );

    const preview: RepublishPreview = { added: [], replaced: [], unchanged: [] };
    for (const artifact of await this.artifacts.listForProject(workspaceId, projectId)) {
      const destinationName = `${projectId}/${artifact.name}`;
      if (!atDestination.has(destinationName)) {
        preview.added.push(artifact.name);
        continue;
      }
      const published = publishedVersions.get(`${artifact.artifactType}:${artifact.artifactId}`);
      if (published === artifact.version) {
        preview.unchanged.push(artifact.name);
      } else {
        preview.replaced.push(artifact.name);
      }
    }
    return preview;
  }
}
