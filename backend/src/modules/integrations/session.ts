/**
 * EPIC-039 — who is calling an Integration Hub route.
 *
 * Every route is a **session** route: a person in the browser, acting for a
 * platform caller. A connector principal (the developer's local agent,
 * `pmi-studio`, any `pmi_ct_` credential) arrives with a bearer token and no
 * session, and is refused `surface_not_accepted` before anything else is read
 * (`FR-HUB-004`, `US1` AS5).
 */
import { SurfaceNotAcceptedError, UnauthenticatedError } from '../../core/errors.js';

export interface HubRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly workspaceId?: string;
  readonly userId?: string;
}

export function refuseConnector(req: HubRequest): void {
  const auth = req.headers['authorization'];
  const value = Array.isArray(auth) ? auth[0] : auth;
  if (typeof value === 'string' && /^Bearer\s+/i.test(value)) throw new SurfaceNotAcceptedError('Authorization');
}

export function requireSession(req: HubRequest): { workspaceId: string; userId: string } {
  refuseConnector(req);
  if (!req.workspaceId || !req.userId) throw new UnauthenticatedError('No valid session.');
  return { workspaceId: req.workspaceId, userId: req.userId };
}
