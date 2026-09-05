/**
 * EPIC-042 `T1488` — the three governance stores, bound to Prisma under
 * `DATABASE_URL` and in-memory otherwise (`durable-stores.spec.ts`).
 *
 * A module of its own so that `ConnectorModule` (which classifies the digest a
 * workstation reports on `pmi.health`, `R-042-5`) and `GovernanceModule` (which
 * renders) can both reach the render store without importing each other.
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { InMemoryConstitutionRenderStore, PrismaConstitutionRenderStore, type ConstitutionRenderDelegate, type ConstitutionRenderStore } from './constitution-render.store.js';
import { InMemoryDecompositionPolicyStore, PrismaDecompositionPolicyStore, type DecompositionPolicyDelegate, type DecompositionPolicyStore } from './decomposition-policy.store.js';
import { InMemoryProjectConstraintStore, PrismaProjectConstraintStore, type ProjectConstraintDelegate, type ProjectConstraintStore } from './project-constraint.store.js';
import { CONSTITUTION_RENDER_STORE, DECOMPOSITION_POLICY_STORE, PROJECT_CONSTRAINT_STORE } from './governance.tokens.js';

@Module({
  providers: [
    {
      provide: PROJECT_CONSTRAINT_STORE,
      useFactory: (): ProjectConstraintStore =>
        process.env['DATABASE_URL'] ? new PrismaProjectConstraintStore(prismaClient().projectConstraint as unknown as ProjectConstraintDelegate) : new InMemoryProjectConstraintStore(),
    },
    {
      provide: DECOMPOSITION_POLICY_STORE,
      useFactory: (): DecompositionPolicyStore =>
        process.env['DATABASE_URL'] ? new PrismaDecompositionPolicyStore(prismaClient().decompositionPolicy as unknown as DecompositionPolicyDelegate) : new InMemoryDecompositionPolicyStore(),
    },
    {
      provide: CONSTITUTION_RENDER_STORE,
      useFactory: (): ConstitutionRenderStore =>
        process.env['DATABASE_URL'] ? new PrismaConstitutionRenderStore(prismaClient().constitutionRender as unknown as ConstitutionRenderDelegate) : new InMemoryConstitutionRenderStore(),
    },
  ],
  exports: [PROJECT_CONSTRAINT_STORE, DECOMPOSITION_POLICY_STORE, CONSTITUTION_RENDER_STORE],
})
export class GovernanceStoresModule {}
