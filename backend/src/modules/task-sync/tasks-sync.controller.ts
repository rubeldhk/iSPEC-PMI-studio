/**
 * `T1706` (EPIC-046, `contracts/tasks-api.md` §1) — the one connector route:
 * `POST /v1/projects/:projectId/tasks/sync`, behind `EPIC-043`'s guard with the
 * scope `tasks.sync`.
 *
 * The guard does the whole boundary: `Bearer pmi_ct_…` → the credential's
 * project; `:projectId` must be `me` or that project, or the answer is `404`
 * absence (`FR-KAN-070`). Nothing here re-implements any of it.
 *
 * PC-1: a transport over `TaskSyncService`. The only logic in this file is
 * argument shape, because a malformed body must be a refusal the extension can
 * read rather than a 500.
 *
 * **No idempotency key is accepted.** The shipped `runFinish` sends none, and
 * `FR-KAN-061` forbids editing it, so the platform derives the key from the
 * execution and the digest (`R-046-8`). Accepting one here would create a second
 * way to key a sync that no client uses and every test would have to cover.
 */
import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ValidationFailedError } from '../../core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequest } from '../connector/connector-auth.guard.js';
import { ConnectorScope } from '../connector/connector-scope.js';
import { TaskSyncService, type SyncAnswer } from './task-sync.service.js';

interface SyncBody {
  executionId?: unknown;
  tasksMarkdown?: unknown;
  contractVersion?: unknown;
  /** Tolerated and IGNORED — the Epic comes from the execution's binding (`FR-KAN-030`). */
  epicNumber?: unknown;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationFailedError(`${field} is required.`, { fields: [{ field, message: 'a non-empty string' }] });
  }
  return value;
}

@Controller('projects')
@UseGuards(ConnectorAuthGuard)
export class TasksSyncController {
  constructor(@Inject(TaskSyncService) private readonly sync: TaskSyncService) {}

  @Post(':projectId/tasks/sync')
  @ConnectorScope('tasks.sync')
  @HttpCode(201)
  async post(@Req() raw: ConnectorRequest, @Body() body: SyncBody | undefined): Promise<SyncAnswer> {
    const connector = raw.connector;
    // The guard always sets it; the check is here so the type is not asserted away.
    if (connector === undefined) throw new ValidationFailedError('No connector context.');
    // An EMPTY `tasks.md` is legitimate — a placeholder file, or one that is all
    // prose — so the content is checked for TYPE and not for length. That case
    // is the second empty state the board distinguishes (`US1` scenario 5).
    const tasksMarkdown = typeof body?.tasksMarkdown === 'string'
      ? body.tasksMarkdown
      : (() => {
          throw new ValidationFailedError('tasksMarkdown is required.', { fields: [{ field: 'tasksMarkdown', message: 'a string' }] });
        })();

    return this.sync.sync(
      { workspaceId: connector.workspaceId, projectId: connector.projectId, actorId: connector.credentialId },
      { executionId: requireString(body?.executionId, 'executionId'), tasksMarkdown },
    );
  }
}
