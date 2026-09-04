/**
 * T1134, T1135 (EPIC-028, C3B) — registering non-human principals, and freezing
 * what they were at a moment in time.
 *
 * ## Why registration refuses so much
 *
 * A principal exists to make a machine's actions attributable to a person. Most
 * of the refusals below are the cases where that attribution would be hollow:
 * a sponsor who does not exist, a sponsor in another tenant, or an agent
 * nominated as its own sponsor. Each of those produces a registry row that
 * looks accountable and is not.
 *
 * ## Snapshots and revocation
 *
 * `capture` reads the principal *now* and writes an immutable row. Revoking the
 * principal afterwards does not touch that row, and must not: an execution
 * recorded last week was performed by an active agent, and an audit trail that
 * changes when somebody is deactivated is not an audit trail.
 *
 * What revocation does is stop the **next** `TrustedPrincipalFactory` call.
 */
import { randomUUID } from 'node:crypto';
import type {
  ConnectorRegistration,
  IdentitySnapshotPort,
  NonHumanPrincipal,
  PrincipalIdentitySnapshot,
  PrincipalRegistryPort,
  PrincipalState,
} from '@pmi/agent-contract';
import { ValidationFailedError } from '../../core/errors.js';

export class PrincipalRegistrationRefused extends ValidationFailedError {
  constructor(reason: string) {
    super(reason);
    this.name = 'PrincipalRegistrationRefused';
  }
}

/**
 * Narrow views of the Prisma delegates this service needs.
 *
 * `$transaction` is **required**, not optional (`Z2`). The current-state row and
 * its append-only evidence must commit together: a state change with no event
 * is an unexplained suspension, and an event with no state change is a record of
 * something that did not happen. Making the boundary optional would let a future
 * double forget it and pass.
 */
export interface PrincipalDelegates {
  $transaction<T>(fn: (tx: PrincipalDelegates) => Promise<T>): Promise<T>;
  principal: {
    create(args: { data: Record<string, unknown> }): Promise<PrincipalRow>;
    findFirst(args: { where: Record<string, unknown> }): Promise<PrincipalRow | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PrincipalRow>;
  };
  principalStateEvent: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  principalIdentitySnapshot: {
    create(args: { data: Record<string, unknown> }): Promise<SnapshotRow>;
    findUnique(args: { where: { id: string } }): Promise<SnapshotRow | null>;
  };
  connectorRegistration: {
    create(args: { data: Record<string, unknown> }): Promise<ConnectorRow>;
    findFirst(args: { where: Record<string, unknown> }): Promise<ConnectorRow | null>;
  };
  user: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; workspaceId: true };
    }): Promise<{ id: string; workspaceId: string } | null>;
  };
}

export interface PrincipalRow {
  id: string;
  workspaceId: string;
  kind: string;
  descriptorRef: string;
  sponsorUserId: string;
  registeredByUserId: string;
  state: string;
  identityVersion: number;
  connectorRegistrationId: string | null;
  correlationId: string;
  causationId: string;
  createdAt: Date | string;
}

export interface SnapshotRow {
  id: string;
  workspaceId: string;
  principalId: string;
  kind: string;
  sponsorUserId: string | null;
  identityVersion: number;
  connectorRegistrationId: string | null;
  capturedAt: Date | string;
}

export interface ConnectorRow {
  id: string;
  workspaceId: string;
  kind: string;
  registeredByUserId: string;
  state: string;
  createdAt: Date | string;
}

const iso = (v: Date | string): string => (v instanceof Date ? v.toISOString() : v);

function toPrincipal(row: PrincipalRow): NonHumanPrincipal {
  return {
    principalId: row.id,
    kind: row.kind as NonHumanPrincipal['kind'],
    workspaceId: row.workspaceId,
    descriptorRef: row.descriptorRef,
    sponsorUserId: row.sponsorUserId,
    registeredByUserId: row.registeredByUserId,
    state: row.state as PrincipalState,
    identityVersion: row.identityVersion,
    ...(row.connectorRegistrationId !== null
      ? { connectorRegistrationId: row.connectorRegistrationId }
      : {}),
    correlationId: row.correlationId,
    causationId: row.causationId,
    registeredAt: iso(row.createdAt),
  };
}

export interface RegisterPrincipalInput {
  workspaceId: string;
  kind: 'agent' | 'service' | 'connector';
  /** The capability this principal exercises. Metadata, never identity. */
  descriptorRef: string;
  sponsorUserId: string;
  registeredByUserId: string;
  connectorRegistrationId?: string;
  correlationId: string;
  causationId: string;
}

export class PrincipalRegistryService implements PrincipalRegistryPort {
  constructor(private readonly db: PrincipalDelegates) {}

  async register(input: RegisterPrincipalInput): Promise<NonHumanPrincipal> {
    // A sponsor who is not an authoritative member of this workspace makes the
    // accountability chain decorative.
    const sponsor = await this.db.user.findUnique({
      where: { id: input.sponsorUserId },
      select: { id: true, workspaceId: true },
    });
    if (sponsor === null) {
      throw new PrincipalRegistrationRefused(
        'The sponsoring human does not exist. A non-human principal requires a real person.',
      );
    }
    if (sponsor.workspaceId !== input.workspaceId) {
      throw new PrincipalRegistrationRefused(
        'The sponsoring human belongs to a different workspace.',
      );
    }
    // Self-sponsorship, named explicitly.
    //
    // The FK to `users` already makes it structurally impossible for a
    // principal id to appear here — principals and users are different
    // namespaces. It is checked anyway so the refusal states the RULE rather
    // than surfacing a foreign-key error, and so the rule survives a future
    // schema change that merges the namespaces.
    if (input.sponsorUserId === input.descriptorRef) {
      throw new PrincipalRegistrationRefused(
        'A principal may not sponsor itself. The sponsor is the human accountable for it.',
      );
    }

    if (input.connectorRegistrationId !== undefined) {
      const connector = await this.db.connectorRegistration.findFirst({
        where: { id: input.connectorRegistrationId, workspaceId: input.workspaceId },
      });
      if (connector === null) {
        throw new PrincipalRegistrationRefused(
          'The named connector is not registered in this workspace.',
        );
      }
    }

    const id = randomUUID();
    return this.db.$transaction(async (tx) => this.createWithEvidence(tx, id, input));
  }

  /** The principal and its `registered` evidence, in one commit. */
  private async createWithEvidence(
    tx: PrincipalDelegates,
    id: string,
    input: RegisterPrincipalInput,
  ): Promise<NonHumanPrincipal> {
    const row = await tx.principal.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        kind: input.kind,
        descriptorRef: input.descriptorRef,
        sponsorUserId: input.sponsorUserId,
        registeredByUserId: input.registeredByUserId,
        state: 'active',
        identityVersion: 1,
        connectorRegistrationId: input.connectorRegistrationId ?? null,
        correlationId: input.correlationId,
        causationId: input.causationId,
      },
    });
    await tx.principalStateEvent.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        principalId: id,
        fromState: null,
        toState: 'active',
        identityVersion: 1,
        actorUserId: input.registeredByUserId,
        reason: 'registered',
        correlationId: input.correlationId,
        causationId: input.causationId,
      },
    });
    return toPrincipal(row);
  }

  /**
   * Change state, bumping `identityVersion` and recording why.
   *
   * The version bump is what makes existing delegations stop applying: they
   * pin the version they were granted against, so a suspended-then-reactivated
   * principal does not silently regain yesterday's delegations.
   */
  async changeState(input: {
    workspaceId: string;
    principalId: string;
    toState: PrincipalState;
    actorUserId: string;
    reason: string;
    correlationId: string;
    causationId: string;
  }): Promise<NonHumanPrincipal> {
    // `Z2` — the read, the update and the evidence share one commit. Read
    // included: the version is derived from what was read, so a concurrent
    // change outside the boundary could hand two callers the same next version.
    return this.db.$transaction(async (tx) => {
    const current = await tx.principal.findFirst({
      where: { id: input.principalId, workspaceId: input.workspaceId },
    });
    if (current === null) {
      throw new PrincipalRegistrationRefused('No such principal in this workspace.');
    }
    const nextVersion = current.identityVersion + 1;
    const row = await tx.principal.update({
      where: { id: input.principalId },
      data: { state: input.toState, identityVersion: nextVersion },
    });
    await tx.principalStateEvent.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        principalId: input.principalId,
        fromState: current.state,
        toState: input.toState,
        identityVersion: nextVersion,
        actorUserId: input.actorUserId,
        reason: input.reason,
        correlationId: input.correlationId,
        causationId: input.causationId,
      },
    });
    return toPrincipal(row);
    });
  }

  async find(workspaceId: string, principalId: string): Promise<NonHumanPrincipal | null> {
    const row = await this.db.principal.findFirst({ where: { id: principalId, workspaceId } });
    return row === null ? null : toPrincipal(row);
  }

  async registerConnector(input: {
    workspaceId: string;
    kind: ConnectorRegistration['kind'];
    registeredByUserId: string;
  }): Promise<ConnectorRegistration> {
    const row = await this.db.connectorRegistration.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        kind: input.kind,
        registeredByUserId: input.registeredByUserId,
        state: 'active',
      },
    });
    return {
      connectorId: row.id,
      workspaceId: row.workspaceId,
      kind: row.kind as ConnectorRegistration['kind'],
      registeredByUserId: row.registeredByUserId,
      state: row.state as PrincipalState,
      registeredAt: iso(row.createdAt),
    };
  }

  async findConnector(
    workspaceId: string,
    connectorId: string,
  ): Promise<ConnectorRegistration | null> {
    const row = await this.db.connectorRegistration.findFirst({
      where: { id: connectorId, workspaceId },
    });
    return row === null
      ? null
      : {
          connectorId: row.id,
          workspaceId: row.workspaceId,
          kind: row.kind as ConnectorRegistration['kind'],
          registeredByUserId: row.registeredByUserId,
          state: row.state as PrincipalState,
          registeredAt: iso(row.createdAt),
        };
  }
}

/**
 * Mints frozen identities. **The service mints the id, never the caller.**
 *
 * `capture` takes a principal id and reads the registry, so a caller cannot
 * hand in a snapshot describing somebody else. `resolve` returns what was
 * frozen, which is how a later check verifies that a submitted snapshot id
 * really belongs to the principal and workspace it claims.
 */
export class IdentitySnapshotService implements IdentitySnapshotPort {
  constructor(private readonly db: PrincipalDelegates) {}

  async capture(workspaceId: string, principalId: string): Promise<PrincipalIdentitySnapshot> {
    const principal = await this.db.principal.findFirst({
      where: { id: principalId, workspaceId },
    });
    if (principal === null) {
      throw new PrincipalRegistrationRefused(
        'Cannot freeze an identity that is not registered in this workspace.',
      );
    }
    const row = await this.db.principalIdentitySnapshot.create({
      data: {
        id: randomUUID(),
        workspaceId,
        principalId,
        kind: principal.kind,
        sponsorUserId: principal.sponsorUserId,
        identityVersion: principal.identityVersion,
        connectorRegistrationId: principal.connectorRegistrationId,
      },
    });
    return toSnapshot(row);
  }

  async resolve(snapshotId: string): Promise<PrincipalIdentitySnapshot | null> {
    const row = await this.db.principalIdentitySnapshot.findUnique({ where: { id: snapshotId } });
    return row === null ? null : toSnapshot(row);
  }
}

function toSnapshot(row: SnapshotRow): PrincipalIdentitySnapshot {
  return {
    snapshotId: row.id,
    principalId: row.principalId,
    kind: row.kind as PrincipalIdentitySnapshot['kind'],
    workspaceId: row.workspaceId,
    sponsorUserId: row.sponsorUserId,
    identityVersion: row.identityVersion,
    connectorRegistrationId: row.connectorRegistrationId,
    capturedAt: iso(row.capturedAt),
  };
}
