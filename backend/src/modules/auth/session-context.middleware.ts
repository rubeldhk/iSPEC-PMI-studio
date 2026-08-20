/**
 * Session → request context (part of T025).
 *
 * Every downstream controller reads `@Req()` as a `WorkspaceContext` — the
 * audit controller has done so since T030, against a context nothing yet
 * populated. This is the population: resolve the session cookie and stamp
 * `workspaceId` / `userId` onto the request. FR-002's "every request resolves
 * a workspace from the session" happens exactly here.
 *
 * No session → no stamp. Whether that is fatal is each endpoint's decision
 * (`requireWorkspaceContext` throws the opaque 404; auth endpoints serve the
 * unauthenticated on purpose).
 */
import type { NestMiddleware } from '@nestjs/common';
import { readCookie, SESSION_COOKIE } from './auth.controller.js';
import type { SessionService } from './sessions.js';

interface ContextualRequest {
  headers: { cookie?: string };
  workspaceId?: string;
  userId?: string;
}

export class SessionContextMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionService) {}

  use(req: ContextualRequest, _res: unknown, next: () => void): void {
    const token = readCookie(req, SESSION_COOKIE);
    const session = token ? this.sessions.resolve(token) : null;
    if (session) {
      req.workspaceId = session.workspaceId;
      req.userId = session.userId;
    }
    next();
  }
}
