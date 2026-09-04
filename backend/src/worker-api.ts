/**
 * `@pmi/backend/worker-api` — `T1321` (EPIC-041, `R-041-6`).
 *
 * **The one permitted edge from the worker into the backend**, and it is three
 * exports wide. `eslint.config.js` forbids every other `worker → backend` path,
 * `tests/governance/eslint-boundaries.spec.ts` (T1322) asserts the rule, and
 * `backend/package.json` exposes nothing else through `exports`.
 *
 * ## Why the worker reaches in here
 *
 * `worker/src/main.ts` carried a `persistence()` whose `transaction()` threw
 * *"Generation persistence is not connected"* — a hold PMI-DOC-004 discharged on
 * 2026-08-20 that nobody returned for (PMI-DOC-004B §2.1). The commit it needed
 * already existed on the API side: `GenerateSpecificationService.run()` claims
 * the job, runs the engine, stamps provenance, and commits specification,
 * version, links, job state and the owner grant in **one** transaction through
 * `PrismaSpecificationStore` — with the ownership bootstrap `T1128` made
 * mandatory, which the worker's own payload could never have supplied.
 * Duplicating that in the worker would be the two-copies problem `R-038-1`
 * rejected; so the worker runs the API's code, against the API's stores, on the
 * job the API enqueued.
 *
 * ## What the worker gets
 *
 * - `prismaClient()` — the one client, lazily constructed from `DATABASE_URL`.
 * - `createGenerationRunner()` — given a way to resolve a concrete engine (the
 *   worker's composition root supplies one; this file names none), returns
 *   `run(jobId)`: hydrate the order from `generation_jobs`, the project and the
 *   selected requirements, then `GenerateSpecificationService.run()`.
 * - `recordEngineRegistrations()` — what the worker composed, written to
 *   `engine_registrations`, so the API can resolve a descriptor for a
 *   submission (`registered-engines.ts`).
 *
 * The payload the worker receives is what `BullJobQueue.enqueue` sends —
 * `{ jobId, correlationId }` — so the runner is keyed by job id and reads the
 * rest from the database. That is also what closes the payload mismatch between
 * the API's producer and the worker's consumer that `T1383` found.
 *
 * **This file names no engine** (`engine-independence.spec.ts` scans it).
 */
import type { EngineCapability, SpecificationEngine } from '@pmi/engine-contract';
import { PrismaEngineRegistrationStore } from './modules/engines/engine-registration.store.js';
import {
  GenerateSpecificationService,
  PrismaRequirementSelection,
  type GenerationOutcome,
  type RequirementSelection,
  type RequirementScopeDelegate,
} from './modules/specifications/generate-specification.service.js';
import { PrismaGenerationJobLedger } from './modules/specifications/generation-job.ledger.prisma.js';
import {
  PrismaSpecificationStore,
  type SpecificationDelegates,
} from './modules/specifications/specifications-read.service.js';
import { prismaClient } from './persistence/prisma.js';

export { prismaClient };

export interface GenerationRunnerDeps {
  /**
   * The worker's answer to "which engine". `engineName` is the project's
   * selection (FR-019), or null to mean the registry's default. Supplied by the
   * worker's composition root; this file never names one.
   */
  resolveEngine(engineName: string | null): SpecificationEngine;
}

export interface RunOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface GenerationRunResult {
  readonly state: GenerationOutcome['state'];
  readonly failureReason?: GenerationOutcome['failureReason'];
}

export interface GenerationRunner {
  run(jobId: string, options: RunOptions): Promise<GenerationRunResult>;
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Generation job "${jobId}" does not exist. The queue named a job the database does not hold.`);
    this.name = 'JobNotFoundError';
  }
}

export function createGenerationRunner(deps: GenerationRunnerDeps): GenerationRunner {
  return {
    async run(jobId, options) {
      const db = prismaClient();

      const job = await db.generationJob.findUnique({ where: { id: jobId } });
      if (job === null) throw new JobNotFoundError(jobId);

      const project = await db.project.findUnique({ where: { id: job.projectId } });
      if (project === null) throw new JobNotFoundError(jobId);

      const requirementIds = ((job.inputRefs as { requirementIds?: string[] } | null)?.requirementIds ?? []).slice();
      const rows =
        requirementIds.length === 0
          ? []
          : await db.requirement.findMany({
              where: { id: { in: requirementIds }, workspaceId: job.workspaceId, projectId: job.projectId },
            });
      // In the selection's order, so the rendered input is stable across runs.
      const byId = new Map(rows.map((r) => [r.id, r]));
      const requirements: RequirementSelection[] = requirementIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((r) => ({
          id: r.id,
          reference: r.reference,
          description: r.description,
          type: r.type as RequirementSelection['type'],
          priority: r.priority as RequirementSelection['priority'],
        }));

      const store = new PrismaSpecificationStore(db as unknown as SpecificationDelegates, (fn) =>
        db.$transaction((tx) => fn(tx as unknown as SpecificationDelegates)),
      );
      const service = new GenerateSpecificationService(
        { resolveForProject: async () => deps.resolveEngine(project.engineName ?? null) },
        store,
        {
          ledger: new PrismaGenerationJobLedger(db.generationJob),
          requirements: new PrismaRequirementSelection(db.requirement as unknown as RequirementScopeDelegate),
        },
      );

      const outcome = await service.run({
        jobId: job.id,
        workspaceId: job.workspaceId,
        projectId: job.projectId,
        requestedById: job.requestedById,
        correlationId: job.correlationId,
        projectName: project.name,
        requirements,
        timeoutMs: options.timeoutMs,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      return outcome.failureReason !== undefined
        ? { state: outcome.state, failureReason: outcome.failureReason }
        : { state: outcome.state };
    },
  };
}

export interface EngineRegistrationEntry {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly EngineCapability[];
  readonly isDefault: boolean;
}

/** What the worker composed, written where the API can read it. */
export async function recordEngineRegistrations(entries: readonly EngineRegistrationEntry[]): Promise<void> {
  const store = new PrismaEngineRegistrationStore(prismaClient().engineRegistration);
  for (const entry of entries) {
    await store.record({
      name: entry.name,
      version: entry.version,
      capabilities: [...entry.capabilities],
      isDefault: entry.isDefault,
    });
  }
}
