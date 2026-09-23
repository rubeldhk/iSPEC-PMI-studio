/**
 * T1136 (EPIC-028, C3B) — the trusted principal context.
 *
 * Band A has no transport yet, and the C3B authorisation is explicit that this
 * step must **not** invent API keys, OAuth or connector credentials. So this is
 * not authentication. It is the thing authentication will later produce.
 *
 * ## What it is for
 *
 * Everything downstream — EPIC-024's boundary, EPIC-030's separation of duties,
 * EPIC-037's registration — needs to know *who is acting*. If that answer
 * arrives as a plain `{ principalId, workspaceId }` object, then any caller who
 * can build an object can claim to be anyone. The whole identity registry
 * becomes decoration.
 *
 * A `TrustedPrincipalContext` therefore cannot be constructed by anyone except
 * this module, and this module only produces one after resolving the principal
 * against the authoritative registry.
 *
 * ## How the forgery is prevented
 *
 * Two mechanisms, because either alone is weak:
 *
 * 1. **A module-private brand.** The class holds a property keyed by a `Symbol`
 *    that is never exported. A structurally identical object fails the
 *    {@link isTrustedPrincipal} check, so duck typing does not get you in.
 * 2. **A private constructor.** `new TrustedPrincipalContext(...)` does not
 *    compile outside this file. The only entrance is
 *    {@link TrustedPrincipalFactory}, which is a backend service.
 *
 * And structurally: `packages/*` cannot import `backend/src`. A connector or
 * SDK package physically cannot reach this file, which
 * `backend/tests/architecture/principal-identity-boundary.spec.ts` asserts
 * rather than assumes.
 *
 * When transport arrives it authenticates a credential and then mints **this
 * same** context. It must not need a different identity model — that is the
 * point of building it now rather than alongside a login form.
 */
import type {
  IdentitySnapshotPort,
  PrincipalIdentitySnapshot,
  PrincipalKind,
} from '@pmi/agent-contract';

/** Never exported. Reachable only by code in this file. */
const TRUSTED = Symbol('pmi.trusted-principal');

export class TrustedPrincipalContext {
  /** The brand. A look-alike object cannot have this key. */
  private readonly [TRUSTED] = true;

  private constructor(
    readonly principalId: string,
    readonly kind: PrincipalKind,
    readonly workspaceId: string,
    /** The sponsoring human. `null` only for a human principal. */
    readonly sponsorUserId: string | null,
    /** Pinned at resolution, so a later change cannot alter this context. */
    readonly identityVersion: number,
    readonly connectorRegistrationId: string | null,
  ) {}

  /**
   * The **only** way one comes into existence.
   *
   * Deliberately not exported: {@link TrustedPrincipalFactory} lives in this
   * module and calls it after an authoritative resolution. Exporting it would
   * make the private constructor pointless.
   */
  private static mint(input: {
    principalId: string;
    kind: PrincipalKind;
    workspaceId: string;
    sponsorUserId: string | null;
    identityVersion: number;
    connectorRegistrationId: string | null;
  }): TrustedPrincipalContext {
    return new TrustedPrincipalContext(
      input.principalId,
      input.kind,
      input.workspaceId,
      input.sponsorUserId,
      input.identityVersion,
      input.connectorRegistrationId,
    );
  }

  /** Internal seam so the factory below can reach `mint` without exporting it. */
  static readonly __mint = TrustedPrincipalContext.mint;
}

/**
 * Whether a value really came from this module.
 *
 * Checks the brand, not the shape. An object with every field copied across
 * still fails, which is the entire point.
 */
export function isTrustedPrincipal(value: unknown): value is TrustedPrincipalContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[TRUSTED] === true
  );
}

/** Resolves a principal authoritatively. Implemented over EPIC-028's registry. */
export interface AuthoritativePrincipalResolver {
  resolve(
    workspaceId: string,
    principalId: string,
  ): Promise<{
    principalId: string;
    kind: PrincipalKind;
    workspaceId: string;
    sponsorUserId: string | null;
    identityVersion: number;
    connectorRegistrationId: string | null;
    state: 'active' | 'suspended' | 'revoked';
  } | null>;
}

export class PrincipalNotActingError extends Error {
  constructor(
    readonly principalId: string,
    reason: string,
  ) {
    super(`Principal ${principalId} may not act: ${reason}.`);
    this.name = 'PrincipalNotActingError';
  }
}

/**
 * Turns an identifier into a trusted context, or refuses.
 *
 * The refusal cases are the security surface, so they are enumerated rather
 * than collapsed into "not permitted": an operator needs to know whether a
 * principal is unknown, foreign, suspended or revoked.
 */
export class TrustedPrincipalFactory {
  constructor(
    private readonly resolver: AuthoritativePrincipalResolver,
    private readonly snapshots: IdentitySnapshotPort,
  ) {}

  async forPrincipal(workspaceId: string, principalId: string): Promise<TrustedPrincipalContext> {
    const record = await this.resolver.resolve(workspaceId, principalId);
    if (record === null) {
      throw new PrincipalNotActingError(principalId, 'no authoritative principal with that identity');
    }
    // The workspace came from the caller; this is where it stops being a claim.
    if (record.workspaceId !== workspaceId) {
      throw new PrincipalNotActingError(principalId, 'principal belongs to a different workspace');
    }
    if (record.state !== 'active') {
      // Suspension and revocation stop NEW action. Neither touches history.
      throw new PrincipalNotActingError(principalId, `principal is ${record.state}`);
    }
    return TrustedPrincipalContext.__mint({
      principalId: record.principalId,
      kind: record.kind,
      workspaceId: record.workspaceId,
      sponsorUserId: record.sponsorUserId,
      identityVersion: record.identityVersion,
      connectorRegistrationId: record.connectorRegistrationId,
    });
  }

  /**
   * Freeze a trusted context into a durable snapshot.
   *
   * Takes a context rather than an id, so a snapshot can only be minted for a
   * principal that was already resolved authoritatively. A caller cannot ask
   * for a snapshot of somebody else.
   */
  async freeze(context: TrustedPrincipalContext): Promise<PrincipalIdentitySnapshot> {
    if (!isTrustedPrincipal(context)) {
      throw new PrincipalNotActingError(
        'unknown',
        'a forged principal context cannot be frozen — it did not come from an authoritative resolution',
      );
    }
    return this.snapshots.capture(context.workspaceId, context.principalId);
  }
}
