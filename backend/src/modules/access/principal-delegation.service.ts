/**
 * T1139 (EPIC-024, C3B) — scoped delegation to a non-human principal.
 *
 * ## The problem this solves
 *
 * C2E made every specification arrive with a human owner grant. If a sponsored
 * agent simply inherited its sponsor's access, registering one agent would hand
 * it everything that human owns — every specification, in every project, for as
 * long as the agent exists. The sponsor would have delegated their whole
 * working life by clicking "register".
 *
 * So delegation is **explicit, scoped, versioned and expiring**, and it is
 * checked in addition to the grant, never instead of it.
 *
 * ## Why approval can never be delegated
 *
 * The four permitted actions are all *reporting* or *proposing*. The database
 * `CHECK` refuses anything else, so `transition.approve`, `transition.apply`,
 * `policy.configure` and grant administration cannot be written into a
 * delegation row at all — not by this service, not by a migration, not by a
 * console.
 *
 * That is deliberate and it is load-bearing. A sponsor who could delegate
 * approval to their own agent would have delegated away the separation of
 * duties EPIC-030 enforces, and every self-approval rule downstream would
 * become advisory.
 *
 * ## Why the identity version is pinned
 *
 * A delegation records the `identityVersion` it was granted against. Suspending
 * a principal bumps that version, so the delegation stops matching. Reactivating
 * bumps it again rather than restoring the old value — a principal that was
 * suspended does not silently recover yesterday's authority.
 */
import { ForbiddenError, ProviderUnavailableError } from '../../core/errors.js';

/** The only actions a non-human principal may hold through delegation. */
export const DELEGABLE_ACTIONS = Object.freeze([
  'execution.register',
  'execution.report',
  'execution.attach-evidence',
  'transition.propose',
] as const);

export type DelegableAction = (typeof DELEGABLE_ACTIONS)[number];

/**
 * Named so the refusal can say *why*, and so a test can assert that these are
 * refused rather than merely absent from the permitted list.
 */
export const NEVER_DELEGABLE = Object.freeze([
  'transition.approve',
  'transition.apply',
  'policy.configure',
  'grant.administer',
] as const);

export function isDelegableAction(value: string): value is DelegableAction {
  return (DELEGABLE_ACTIONS as readonly string[]).includes(value);
}

export interface DelegationRow {
  id: string;
  workspaceId: string;
  principalId: string;
  sponsorUserId: string;
  artifactType: string;
  artifactId: string;
  actions: string[];
  identityVersion: number;
  effectiveFrom: Date | string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}

export interface DelegationStore {
  activeFor(
    workspaceId: string,
    principalId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<DelegationRow[]>;
  create(data: Record<string, unknown>): Promise<DelegationRow>;
  revoke(workspaceId: string, delegationId: string, revokedById: string): Promise<DelegationRow>;
}

export class DelegationRefused extends ForbiddenError {
  constructor(
    readonly detail: string,
    message = 'Not found.',
  ) {
    super(message);
    this.name = 'DelegationRefused';
  }
}

export class DelegationStoreUnavailable extends ProviderUnavailableError {
  constructor(cause: string) {
    super(`Delegation store unavailable: ${cause}`);
    this.name = 'DelegationStoreUnavailable';
  }
}

const asDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));

export class PrincipalDelegationService {
  constructor(private readonly store: DelegationStore) {}

  /**
   * Refuse unless an active, unexpired, version-matched delegation carries this
   * action for this artifact.
   *
   * An unreadable store raises {@link DelegationStoreUnavailable} rather than
   * refusing: "you have no delegation" and "we could not look" are different
   * facts, and both must fail closed but distinguishably.
   */
  async requireDelegated(input: {
    workspaceId: string;
    principalId: string;
    identityVersion: number;
    artifact: { artifactType: string; artifactId: string };
    action: string;
    at?: Date;
  }): Promise<DelegationRow> {
    if (!isDelegableAction(input.action)) {
      // Reached only if a caller invents an action. Named, because "no
      // delegation covers this" would misdescribe a permanently forbidden one.
      throw new DelegationRefused(
        `"${input.action}" can never be delegated to a non-human principal`,
      );
    }

    let rows: DelegationRow[];
    try {
      rows = await this.store.activeFor(input.workspaceId, input.principalId, input.artifact);
    } catch (error) {
      throw new DelegationStoreUnavailable(
        error instanceof Error ? `${error.name}: ${error.message}` : 'unknown fault',
      );
    }

    const now = input.at ?? new Date();
    const usable = rows.find(
      (r) =>
        r.revokedAt === null &&
        asDate(r.effectiveFrom).getTime() <= now.getTime() &&
        (r.expiresAt === null || asDate(r.expiresAt).getTime() > now.getTime()) &&
        // The version pin. A suspension bumped it, so this no longer matches.
        r.identityVersion === input.identityVersion &&
        r.actions.includes(input.action),
    );

    if (usable === undefined) {
      throw new DelegationRefused(
        `no active delegation carries "${input.action}" for this artifact at this identity version`,
      );
    }
    return usable;
  }

  /** Grant a delegation. The action set is validated before it reaches the database. */
  async delegate(input: {
    workspaceId: string;
    principalId: string;
    sponsorUserId: string;
    artifact: { artifactType: string; artifactId: string };
    actions: readonly string[];
    identityVersion: number;
    expiresAt?: Date;
    correlationId: string;
  }): Promise<DelegationRow> {
    if (input.actions.length === 0) {
      throw new DelegationRefused('a delegation carrying no action grants nothing');
    }
    const forbidden = input.actions.filter((a) => !isDelegableAction(a));
    if (forbidden.length > 0) {
      // The database CHECK would refuse this too. Refusing here as well means
      // the message names the rule instead of surfacing a constraint violation.
      throw new DelegationRefused(
        `these actions can never be delegated: ${forbidden.join(', ')}`,
      );
    }
    return this.store.create({
      workspaceId: input.workspaceId,
      principalId: input.principalId,
      sponsorUserId: input.sponsorUserId,
      artifactType: input.artifact.artifactType,
      artifactId: input.artifact.artifactId,
      actions: [...input.actions],
      identityVersion: input.identityVersion,
      expiresAt: input.expiresAt ?? null,
      correlationId: input.correlationId,
    });
  }

  async revoke(
    workspaceId: string,
    delegationId: string,
    revokedById: string,
  ): Promise<DelegationRow> {
    return this.store.revoke(workspaceId, delegationId, revokedById);
  }
}
