/**
 * `T1360` (EPIC-041) — `ConnectorAuthGuard` (`R-041-3`).
 *
 * `Authorization: Bearer pmi_ct_<token>` → prefix lookup → digest comparison
 * in constant time → `revokedAt IS NULL` → a `TrustedPrincipalContext` for
 * the credential's `Principal`, produced through `TrustedPrincipalFactory`
 * and never constructed here — scoped to its project.
 *
 * Refusals (contracts/provisioning-api.md):
 * - unknown, wrong digest, or revoked → ONE identical `401`; a distinguishable
 *   refusal would leak which;
 * - valid, but the resource belongs to another project → `404`
 *   (`FR-LPW-025`: existence is not disclosed);
 * - valid, but the route declares no registered scope → `403` (scope, not
 *   identity — checked after the credential, so an unscoped route still
 *   answers `401` to a bad token).
 *
 * The core is `authenticate(request, scope)`, framework-free so it is unit
 * tested without an `ExecutionContext`; `canActivate` is the Nest adapter.
 */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, NotFoundError, UnauthenticatedError } from '../../core/errors.js';
import { TrustedPrincipalFactory } from '../agents/trusted-principal.js';
import type { TrustedPrincipalContext } from '../agents/trusted-principal.js';
import { CONNECTOR_CREDENTIAL_STORE } from './connector.tokens.js';
import type { ConnectorCredentialStore } from './connector-credential.store.js';
import { CONNECTOR_SCOPE_KEY, isRegisteredConnectorScope } from './connector-scope.js';
import { bearerToken, lookupPrefix, verifyToken } from './credential-token.js';

/** What a route behind the guard receives on `request.connector`. */
export interface ConnectorRequestContext {
  readonly credentialId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly principal: TrustedPrincipalContext;
}

export interface ConnectorRequest {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  workspaceId?: string;
  connector?: ConnectorRequestContext;
}

/** `TrustedPrincipalFactory.forPrincipal`, by shape. */
export interface PrincipalContextFactory {
  forPrincipal(workspaceId: string, principalId: string): Promise<TrustedPrincipalContext>;
}

@Injectable()
export class ConnectorAuthGuard implements CanActivate {
  /** One message for every credential failure. Compared verbatim by the tests. */
  static readonly REFUSAL_MESSAGE = 'Invalid connector credential.';

  private readonly now: () => Date;

  constructor(
    @Inject(CONNECTOR_CREDENTIAL_STORE) private readonly credentials: ConnectorCredentialStore,
    @Inject(TrustedPrincipalFactory) private readonly principals: PrincipalContextFactory,
    private readonly options: { now?: () => Date; reflector?: Reflector } = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reflector = this.options.reflector ?? new Reflector();
    const scope = reflector.getAllAndOverride<string | undefined>(CONNECTOR_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    await this.authenticate(context.switchToHttp().getRequest<ConnectorRequest>(), scope);
    return true;
  }

  async authenticate(request: ConnectorRequest, scope: string | undefined): Promise<ConnectorRequestContext> {
    const header = request.headers['authorization'];
    const token = bearerToken(Array.isArray(header) ? header[0] : header);
    const prefix = token === null ? null : lookupPrefix(token);
    if (token === null || prefix === null) throw this.refuse();

    const candidates = await this.credentials.findByPrefix(prefix);
    const credential = candidates.find((c) => verifyToken(token, c.tokenHash));
    if (credential === undefined || credential.revokedAt !== null) throw this.refuse();

    // Scope after identity: a bad token on an unscoped route is still 401.
    if (!isRegisteredConnectorScope(scope)) {
      throw new ForbiddenError(
        scope === undefined
          ? 'This route accepts no connector credential.'
          : `The scope "${scope}" is not one a connector credential authorises.`,
      );
    }

    // FR-LPW-025 — a resource of another project is absent, not forbidden.
    const requested = request.params?.['projectId'];
    if (requested !== undefined && requested !== credential.projectId) throw new NotFoundError('Not found.');

    const principal = await this.principals.forPrincipal(credential.workspaceId, credential.principalId);
    const ctx: ConnectorRequestContext = {
      credentialId: credential.id,
      workspaceId: credential.workspaceId,
      projectId: credential.projectId,
      principal,
    };
    request.workspaceId = credential.workspaceId;
    request.connector = ctx;
    await this.credentials.touchLastUsed(credential.id, this.now());
    return ctx;
  }

  private refuse(): UnauthenticatedError {
    return new UnauthenticatedError(ConnectorAuthGuard.REFUSAL_MESSAGE);
  }
}
