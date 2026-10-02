/**
 * `T1638` (EPIC-045, `contracts/artifacts-api.md` §1) — the one connector
 * route: `POST /v1/projects/:projectId/artifacts/sync`, behind `EPIC-043`'s
 * guard with the scope `artifacts.sync`.
 *
 * The guard does the whole boundary: `Bearer pmi_ct_…` → the credential's
 * project; `:projectId` must be `me` or that project, or the answer is `404`
 * absence (`FR-LPW-025`). Nothing here re-implements any of it.
 *
 * PC-1: a transport over `ArtifactSyncService`. The only logic in this file is
 * argument shape, because a malformed body must be a refusal the extension can
 * read rather than a 500.
 */
import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ValidationFailedError } from '../../core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequest } from '../connector/connector-auth.guard.js';
import { ConnectorScope } from '../connector/connector-scope.js';
import { ArtifactSyncService, type SyncAnswer } from './artifact-sync.service.js';
import type { SyncedFile } from './artifact-validation.js';

interface SyncBody {
  executionId?: unknown;
  files?: unknown;
  idempotencyKey?: unknown;
  /** Tolerated and IGNORED — the Epic comes from the execution's binding (`R-045-2`). */
  epicNumber?: unknown;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationFailedError(`${field} is required.`, { fields: [{ field, message: 'a non-empty string' }] });
  }
  return value;
}

function files(value: unknown): SyncedFile[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationFailedError('files must be an array.', { fields: [{ field: 'files', message: 'an array of { path, digest, content }' }] });
  return value.map((raw, index) => {
    const file = raw as { path?: unknown; digest?: unknown; content?: unknown };
    return {
      path: requireString(file.path, `files[${index}].path`),
      digest: requireString(file.digest, `files[${index}].digest`),
      // An empty file is legitimate content, so `content` is checked for TYPE
      // and not for length — `requireString` would refuse an empty spec.md.
      content: typeof file.content === 'string' ? file.content : (() => {
        throw new ValidationFailedError(`files[${index}].content is required.`, { fields: [{ field: `files[${index}].content`, message: 'a string' }] });
      })(),
    };
  });
}

@Controller('projects')
@UseGuards(ConnectorAuthGuard)
export class ArtifactsSyncController {
  constructor(@Inject(ArtifactSyncService) private readonly sync: ArtifactSyncService) {}

  @Post(':projectId/artifacts/sync')
  @ConnectorScope('artifacts.sync')
  @HttpCode(201)
  async post(@Req() raw: ConnectorRequest, @Body() body: SyncBody | undefined): Promise<SyncAnswer> {
    const connector = raw.connector;
    // The guard always sets it; the check is here so the type is not asserted away.
    if (connector === undefined) throw new ValidationFailedError('No connector context.');
    const idempotencyKey = typeof body?.idempotencyKey === 'string' && body.idempotencyKey.length > 0 ? body.idempotencyKey : undefined;
    return this.sync.sync(
      { workspaceId: connector.workspaceId, projectId: connector.projectId, credentialId: connector.credentialId },
      { executionId: requireString(body?.executionId, 'executionId'), files: files(body?.files), idempotencyKey },
    );
  }
}
