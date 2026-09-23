/**
 * T1139 (EPIC-024, C3B) — the Prisma-backed delegation store.
 *
 * Narrow delegate rather than an imported `PrismaClient`, following
 * `job.store.ts`: the service states the shape it needs and the real client
 * drops onto it. Reached through a thunk so `prismaClient()` is not constructed
 * while modules are merely being assembled.
 */
import { randomUUID } from 'node:crypto';
import type { DelegationRow, DelegationStore } from './principal-delegation.service.js';

export interface DelegationDelegate {
  principalDelegation: {
    findMany(args: { where: Record<string, unknown> }): Promise<DelegationRow[]>;
    create(args: { data: Record<string, unknown> }): Promise<DelegationRow>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<DelegationRow>;
  };
}

export class PrismaDelegationStore implements DelegationStore {
  constructor(private readonly db: () => DelegationDelegate) {}

  /**
   * Rows for this principal and artifact, **unfiltered by time or revocation**.
   *
   * Deliberate: the service applies those rules, and it must be able to see a
   * revoked or expired row in order to refuse for the right reason. Filtering
   * here would make "revoked" and "never existed" indistinguishable.
   */
  async activeFor(
    workspaceId: string,
    principalId: string,
    artifact: { artifactType: string; artifactId: string },
  ): Promise<DelegationRow[]> {
    return this.db().principalDelegation.findMany({
      where: {
        workspaceId,
        principalId,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
      },
    });
  }

  async create(data: Record<string, unknown>): Promise<DelegationRow> {
    return this.db().principalDelegation.create({ data: { id: randomUUID(), ...data } });
  }

  async revoke(
    _workspaceId: string,
    delegationId: string,
    revokedById: string,
  ): Promise<DelegationRow> {
    return this.db().principalDelegation.update({
      where: { id: delegationId },
      data: { revokedAt: new Date(), revokedById },
    });
  }
}
