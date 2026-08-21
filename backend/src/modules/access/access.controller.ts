/**
 * T420 — `/artifacts/{type}/{id}/grants` and `/access-attempts` per
 * `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Access grants · FR-ACC-021 to FR-ACC-028). Closes gap G-02.4.
 *
 * The artifact rule, everywhere: a caller who cannot EDIT the artifact gets
 * ABSENCE — 404, never 403. Revoking the last `edit` grant is 409, enforced
 * in the revoke transaction (FR-ACC-027).
 */
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { AccessEnforcementService } from './access-enforcement.service.js';
import type { AccessAttempt } from './access-enforcement.service.js';
import { AccessGrantService } from './access-grant.service.js';
import type { AccessGrantRecord } from './access-grant.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

export interface GrantBody {
  id: string;
  artifactType: string;
  artifactId: string;
  userId: string;
  level: string;
  grantedById: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

function toGrantBody(grant: AccessGrantRecord): GrantBody {
  return {
    id: grant.id,
    artifactType: grant.artifactType,
    artifactId: grant.artifactId,
    userId: grant.userId,
    level: grant.level,
    grantedById: grant.grantedById,
    grantedAt: grant.grantedAt,
    revokedAt: grant.revokedAt,
  };
}

@Controller()
export class AccessController {
  constructor(
    @Inject(AccessGrantService) private readonly grants: AccessGrantService,
    @Inject(AccessEnforcementService) private readonly enforcement: AccessEnforcementService,
  ) {}

  /** Requires `edit` on the artifact — otherwise the artifact is absent. */
  @Get('artifacts/:type/:id/grants')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') artifactType: string,
    @Param('id') artifactId: string,
  ): Promise<GrantBody[]> {
    const session = requireAuth(ctx);
    const artifact = { artifactType, artifactId };
    await this.enforcement.requireEditable(session.workspaceId, session.userId, artifact, 'list_grants');
    const rows = await this.grants.activeGrants(session.workspaceId, artifact);
    return rows.map(toGrantBody);
  }

  /** FR-ACC-021 — `userId` and `level` required. */
  @Post('artifacts/:type/:id/grants')
  @HttpCode(201)
  async grant(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') artifactType: string,
    @Param('id') artifactId: string,
    @Body() body: { userId?: string; level?: string },
  ): Promise<GrantBody> {
    const session = requireAuth(ctx);
    const artifact = { artifactType, artifactId };
    // Granting on an artifact the caller cannot edit → 404, absence.
    await this.enforcement.requireEditable(session.workspaceId, session.userId, artifact, 'grant');
    const created = await this.grants.grant(session.workspaceId, artifact, {
      userId: body?.userId ?? '',
      level: body?.level,
      grantedById: session.userId,
    });
    return toGrantBody(created);
  }

  /** FR-ACC-022 — revoke; 409 when it would strand the artifact (FR-ACC-027). */
  @Delete('artifacts/:type/:id/grants/:grantId')
  async revoke(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') artifactType: string,
    @Param('id') artifactId: string,
    @Param('grantId') grantId: string,
  ): Promise<GrantBody> {
    const session = requireAuth(ctx);
    const artifact = { artifactType, artifactId };
    await this.enforcement.requireEditable(session.workspaceId, session.userId, artifact, 'revoke');
    const revoked = await this.grants.revoke(session.workspaceId, grantId, session.userId);
    return toGrantBody(revoked);
  }

  /** FR-ACC-023 / SC-013 — the refused attempts, for those who may see them. */
  @Get('artifacts/:type/:id/access-attempts')
  async attempts(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') artifactType: string,
    @Param('id') artifactId: string,
  ): Promise<AccessAttempt[]> {
    const session = requireAuth(ctx);
    const artifact = { artifactType, artifactId };
    await this.enforcement.requireEditable(session.workspaceId, session.userId, artifact, 'list_attempts');
    return this.enforcement.attemptsFor(session.workspaceId, artifact);
  }
}
