/**
 * `T2302` (EPIC-048) — the session routes of governed learning.
 *
 * PC-1: a transport. Every capability lives in a service; this file decides only
 * what a caller may say and what the session decides for them. Identity fields
 * in a body (`workspaceId`, `actor`, `requestedBy`, `reviewerId`, `approvedBy`)
 * are stripped and taken from the session — `EPIC-031`'s `strip()` convention.
 */
import { Controller, Get, Req } from '@nestjs/common';
import { NotAvailableUntilError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';

export interface ActingUser {
  readonly workspaceId: string;
  readonly userId: string;
}

/** A product endpoint with no session is 401 — the local helper the siblings carry. */
export function requireSession(ctx: WorkspaceContext | undefined | null): ActingUser {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: ctx.workspaceId, userId: ctx.userId };
}

@Controller()
export class LearningController {
  /** `FR-LRN-073` — browse approved knowledge. The listing itself is `T2371`. */
  @Get('learning/knowledge')
  browse(@Req() ctx: WorkspaceContext | undefined): never {
    requireSession(ctx);
    throw new NotAvailableUntilError('EPIC-048 T2371', 'Browsing approved knowledge');
  }
}
