/**
 * T1137 (EPIC-028, C3B) — composing the non-human principal registry.
 *
 * What this module exports is deliberately narrow. `PrincipalRegistryService`
 * and `IdentitySnapshotService` are public — EPIC-024 resolves principals
 * through the first, and EPIC-030 reads frozen identities through the second.
 * Neither reads EPIC-028's tables, which is what keeps two epics from
 * disagreeing about who exists.
 *
 * `TrustedPrincipalFactory` is exported too, because backend composition is
 * where a trusted context is minted. The *class* it produces still cannot be
 * constructed anywhere but its own file, so exporting the factory grants the
 * ability to resolve an identity, not to assert one.
 */
import { Module } from '@nestjs/common';
import {
  IdentitySnapshotService,
  PrincipalRegistryService,
  type PrincipalDelegates,
} from './principal-registry.service.js';
import {
  TrustedPrincipalFactory,
  type AuthoritativePrincipalResolver,
} from './trusted-principal.js';
import { prismaClient } from '../../persistence/prisma.js';

export const PRINCIPAL_DELEGATES = Symbol('PRINCIPAL_DELEGATES');

@Module({
  providers: [
    {
      provide: PRINCIPAL_DELEGATES,
      // Lazily reached: `prismaClient()` reads DATABASE_URL when constructed,
      // so it must not run while modules are merely being assembled.
      useFactory: (): PrincipalDelegates => prismaClient() as unknown as PrincipalDelegates,
    },
    {
      provide: PrincipalRegistryService,
      inject: [PRINCIPAL_DELEGATES],
      useFactory: (db: PrincipalDelegates): PrincipalRegistryService =>
        new PrincipalRegistryService(db),
    },
    {
      provide: IdentitySnapshotService,
      inject: [PRINCIPAL_DELEGATES],
      useFactory: (db: PrincipalDelegates): IdentitySnapshotService =>
        new IdentitySnapshotService(db),
    },
    {
      provide: TrustedPrincipalFactory,
      inject: [PrincipalRegistryService, IdentitySnapshotService],
      useFactory: (
        registry: PrincipalRegistryService,
        snapshots: IdentitySnapshotService,
      ): TrustedPrincipalFactory => {
        // The resolver is the registry, narrowed to exactly what minting needs.
        // Handing the factory the whole registry would let it register, which
        // is not a thing resolution should be able to do.
        const resolver: AuthoritativePrincipalResolver = {
          resolve: async (workspaceId, principalId) => {
            const p = await registry.find(workspaceId, principalId);
            return p === null
              ? null
              : {
                  principalId: p.principalId,
                  kind: p.kind,
                  workspaceId: p.workspaceId,
                  sponsorUserId: p.sponsorUserId,
                  identityVersion: p.identityVersion,
                  connectorRegistrationId: p.connectorRegistrationId ?? null,
                  state: p.state,
                };
          },
        };
        return new TrustedPrincipalFactory(resolver, snapshots);
      },
    },
  ],
  exports: [PrincipalRegistryService, IdentitySnapshotService, TrustedPrincipalFactory],
})
export class AgentsModule {}
