/**
 * `T1321` (EPIC-041) — the API learns which engines exist from what the worker
 * recorded, and never runs one.
 *
 * `FR-LPW-042`, `R-041-6`. `EngineRegistryService` starts empty on the API side
 * — correct, since the API resolves and records engines and never runs them —
 * and nothing ever filled it, so `GenerateSpecificationService.submit` refused
 * every submission with `engine_unavailable` before it reached a queue
 * (PMI-DOC-004B §2.1, found while writing `T1383`). The worker already had a
 * store to `recordRegistrations()` into; the API had nothing to read them with.
 *
 * A `DescriptorOnlyEngine` carries a recorded descriptor and refuses every
 * operation with `engine_unavailable`, naming the worker as where the engine
 * runs. It is exactly what `submit()` needs — a descriptor to stamp on the job
 * (FR-022) — and exactly what `run()` must never be handed on the API side. The
 * refusal is the design: an API that could run an engine would be an API that
 * held one, which `ADR-0001` forbids.
 *
 * Framework-free (PC-1). Wired in `engines.module.ts` under `DATABASE_URL`.
 */
import type { PrismaClient } from '@prisma/client';
import {
  engineFail,
  type EngineCapability,
  type EngineDescriptor,
  type EngineResult,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import type { EngineRegistryService } from './engine-registry.service.js';

const RUNS_IN_WORKER =
  'This engine is recorded on the API side and runs only in the worker (ADR-0001). Submit a job; do not call the engine here.';

export class DescriptorOnlyEngine implements SpecificationEngine {
  constructor(readonly descriptor: EngineDescriptor) {}

  async generateSpecification(): Promise<EngineResult<never>> {
    return engineFail('engine_unavailable', RUNS_IN_WORKER);
  }

  async generateTasks(): Promise<EngineResult<never>> {
    return engineFail('engine_unavailable', RUNS_IN_WORKER);
  }

  async validateSpecification(): Promise<EngineResult<never>> {
    return engineFail('engine_unavailable', RUNS_IN_WORKER);
  }
}

type RegistrationDelegate = Pick<PrismaClient['engineRegistration'], 'findMany'>;

/**
 * Register every recorded engine as descriptor-only. All-or-nothing, through
 * `registerAll`, so an incomplete recording refuses the whole set the way an
 * incomplete adapter does (T139).
 *
 * Returns how many were registered, so a boot log can say "0" out loud rather
 * than the first submission discovering it.
 */
export async function loadRegisteredEngines(
  registry: EngineRegistryService,
  delegate: RegistrationDelegate,
): Promise<number> {
  const rows = await delegate.findMany({ orderBy: { name: 'asc' } });
  registry.registerAll(
    rows.map((row) => ({
      engine: new DescriptorOnlyEngine({
        name: row.name,
        version: row.version,
        capabilities: row.capabilities as EngineCapability[],
      }),
      ...(row.isDefault ? { isDefault: true } : {}),
    })),
  );
  return rows.length;
}
