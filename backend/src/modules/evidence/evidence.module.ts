/**
 * `T857a` — the evidence module. Registered in `app.module.ts` (`T857b`), which
 * is the wiring `evidence-reachability.spec.ts` exists to prove: a module built,
 * tested and registered nowhere is the defect this repository has recorded six
 * times (`DEF-005-001`, `T1178`).
 *
 * ## The three ports, bound
 *
 * - `EvidenceStorage` → `EPIC-025`'s provider registry (`T856m`).
 * - `AccessPolicy` → `EPIC-024`'s `AccessInheritanceService` (`T859j`).
 * - `AttestationSource` → **unbound**. The `EPIC-013` / `U-13` adapter
 *   registry (`BR-0125`) does not exist yet, so external tools are refused
 *   (`FR-EVS-040`) while the platform's own producers — `pmi:` sources, such as
 *   `EPIC-015`'s QA suite — contribute in-process. Bound to `null`, not to a
 *   permissive stand-in: the port's declared absent-behaviour is refuse.
 *
 * Persistence is Prisma where `DATABASE_URL` is set and in-memory otherwise,
 * the pattern every Room module follows.
 */
import { Logger, Module } from '@nestjs/common';
import type { AccessPolicy, AttestationSource, EvidenceStorage } from '@pmi/evidence-contract';
import { AccessModule } from '../access/access.module.js';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { StorageModule, PROVIDER_REGISTRY } from '../storage/storage.module.js';
import type { ProviderRegistry } from '../storage/connection.service.js';
import { prismaClient } from '../../persistence/prisma.js';
import { AccessControlEvidencePolicy } from './access.adapter.js';
import { CompletionGate } from './completion.gate.js';
import { loadCatalog, type ContractCatalog } from './contract.loader.js';
import { EvidenceController } from './evidence.controller.js';
import {
  InMemoryEvidenceRepository,
  PrismaEvidenceRepository,
  type EvidenceRepository,
} from './evidence.repository.js';
import { EvidenceService } from './evidence.service.js';
import {
  EVIDENCE_ACCESS_POLICY,
  EVIDENCE_ATTESTATION_SOURCE,
  EVIDENCE_CATALOG,
  EVIDENCE_REPOSITORY,
  EVIDENCE_STORAGE,
} from './evidence.tokens.js';
import { StorageProviderEvidenceStorage } from './storage.adapter.js';

@Module({
  imports: [AccessModule, StorageModule],
  controllers: [EvidenceController],
  providers: [
    {
      provide: EVIDENCE_REPOSITORY,
      useFactory: (): EvidenceRepository =>
        process.env['DATABASE_URL'] ? new PrismaEvidenceRepository(prismaClient()) : new InMemoryEvidenceRepository(),
    },
    {
      // Loaded once, at startup. A malformed definition throws here, so a bad
      // Contract fails the boot rather than the first completion (R-032-4).
      // FR-EVS-024: a version weakening one that work is in flight under is
      // refused, not loaded, and the refusal is logged (T1994) — see loadCatalog.
      provide: EVIDENCE_CATALOG,
      inject: [EVIDENCE_REPOSITORY],
      useFactory: (repository: EvidenceRepository): Promise<ContractCatalog> =>
        loadCatalog(repository, { report: (message) => new Logger('EvidenceModule').warn(message) }),
    },
    {
      provide: EVIDENCE_STORAGE,
      inject: [PROVIDER_REGISTRY],
      useFactory: (providers: ProviderRegistry): EvidenceStorage => new StorageProviderEvidenceStorage(providers),
    },
    {
      provide: EVIDENCE_ACCESS_POLICY,
      inject: [AccessInheritanceService],
      useFactory: (access: AccessInheritanceService): AccessPolicy => new AccessControlEvidencePolicy(access),
    },
    { provide: EVIDENCE_ATTESTATION_SOURCE, useFactory: (): AttestationSource | null => null },
    {
      provide: CompletionGate,
      inject: [EVIDENCE_REPOSITORY, EVIDENCE_CATALOG, EVIDENCE_STORAGE],
      useFactory: (repository: EvidenceRepository, catalog: ContractCatalog, storage: EvidenceStorage) =>
        new CompletionGate(repository, catalog, storage),
    },
    {
      provide: EvidenceService,
      inject: [
        EVIDENCE_REPOSITORY,
        EVIDENCE_CATALOG,
        CompletionGate,
        EVIDENCE_ACCESS_POLICY,
        EVIDENCE_ATTESTATION_SOURCE,
      ],
      useFactory: (
        repository: EvidenceRepository,
        catalog: ContractCatalog,
        gate: CompletionGate,
        access: AccessPolicy | null,
        sources: AttestationSource | null,
      ) => new EvidenceService(repository, catalog, gate, access, sources),
    },
  ],
  exports: [EvidenceService, CompletionGate, EVIDENCE_CATALOG],
})
export class EvidenceModule {}
