/**
 * T840 — an unavailable engine is NAMED, never generic (F2, **US3 scenario 4**).
 *
 * Written to FAIL before T841 exists (Constitution V).
 *
 * Found by the `/speckit-converge EPIC-008` pass. `submit()` let
 * `NoDefaultEngineError` and `EngineSelectionUnavailableError` escape. Neither
 * is a `PlatformError`, so `toErrorBody` rendered them as `internal_error` with
 * the fixed text "An unexpected error occurred." — which is precisely what US3
 * scenario 4 forbids: *"they are told the engine is unavailable rather than
 * shown a generic error."*
 *
 * Status code: **422**, not 503. The contract's status table
 * (`contracts/platform-api.md`) lists no 5xx for a refusal, and 422 is defined
 * there as "well-formed but semantically refused" — which this is. Introducing
 * an undocumented status from an epic that does not own the contract is the
 * same mistake `DEF-008-001` records; the code carries the meaning, and the
 * status stays inside the published set.
 */
import { describe, expect, it } from 'vitest';
import { EngineUnavailableError, toErrorBody, toHttpStatus } from '../../../src/core/errors.js';
import { FAILURE_MESSAGES } from '../../../src/core/failure-taxonomy.js';
import { NoDefaultEngineError } from '../../../src/modules/engines/engine-registry.service.js';
import { EngineSelectionUnavailableError } from '../../../src/modules/engines/engine-resolver.service.js';
import { JobsService } from '../../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
} from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, PROJECT, StubEngine, WS, selection } from './helpers.js';

function service(resolve: () => Promise<never>): {
  service: GenerateSpecificationService;
  ledger: InMemoryGenerationJobLedger;
} {
  const ledger = new InMemoryGenerationJobLedger();
  return {
    ledger,
    service: new GenerateSpecificationService(
      { resolveForProject: resolve },
      new InMemorySpecificationStore(),
      {
        jobs: new JobsService(ledger),
        ledger,
        requirements: new InMemoryRequirementSelection(
          selection().map((r) => ({ id: r.id, workspaceId: WS, projectId: PROJECT })),
        ),
      },
    ),
  };
}

const IDS = selection().map((r) => r.id);

const CASES: [string, () => Promise<never>][] = [
  [
    'a deployment with no registered engine',
    async (): Promise<never> => {
      throw new NoDefaultEngineError();
    },
  ],
  [
    'a project selecting an engine that is not registered',
    async (): Promise<never> => {
      throw new EngineSelectionUnavailableError(PROJECT, 'ghost-engine', ['stub', 'fixture']);
    },
  ],
];

describe('submission against an unavailable engine (US3/AC4)', () => {
  it.each(CASES)('%s is refused as engine_unavailable', async (_label, resolve) => {
    const { service: svc } = service(resolve);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EngineUnavailableError);
    expect(toErrorBody(error).error.code).toBe('engine_unavailable');
  });

  it.each(CASES)('%s is NOT reported as a generic internal error', async (_label, resolve) => {
    const { service: svc } = service(resolve);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);
    const body = toErrorBody(error);

    expect(body.error.code).not.toBe('internal_error');
    expect(body.error.message).not.toBe('An unexpected error occurred.');
  });

  it('carries the taxonomy’s own user-facing wording', async () => {
    const { service: svc } = service(CASES[0]![1]);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);
    expect(toErrorBody(error).error.message).toBe(FAILURE_MESSAGES.engine_unavailable);
  });

  it('answers 422 — inside the contract’s published status set', async () => {
    const { service: svc } = service(CASES[0]![1]);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(422);
  });

  it('names the reason in details, so a client can branch on it', async () => {
    const { service: svc } = service(CASES[0]![1]);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);
    expect((toErrorBody(error).error.details as { reason: string }).reason).toBe(
      'engine_unavailable',
    );
  });

  it('never leaks which engines the deployment has registered (R-011, rule E9)', async () => {
    // `EngineSelectionUnavailableError` names the registered set in its own
    // message. That is operator-facing: a user learning the deployment's engine
    // inventory from a refusal is an information leak, not a helpful error.
    const { service: svc } = service(CASES[1]![1]);
    const error = await svc.submit(CTX, PROJECT, IDS).catch((e: unknown) => e);
    const body = JSON.stringify(toErrorBody(error));

    expect(body).not.toContain('ghost-engine');
    expect(body).not.toContain('fixture');
  });

  it.each(CASES)('%s creates NO job — nothing to poll, nothing to bill', async (_label, resolve) => {
    const { service: svc } = service(resolve);
    await svc.submit(CTX, PROJECT, IDS).catch(() => undefined);
    expect(await svc.jobsForProject(WS, PROJECT)).toEqual([]);
  });
});

describe('a resolvable engine is unaffected', () => {
  it('still submits and answers with a job', async () => {
    const ledger = new InMemoryGenerationJobLedger();
    const svc = new GenerateSpecificationService(
      { resolveForProject: async () => StubEngine.returning() },
      new InMemorySpecificationStore(),
      {
        jobs: new JobsService(ledger),
        ledger,
        requirements: new InMemoryRequirementSelection(
          selection().map((r) => ({ id: r.id, workspaceId: WS, projectId: PROJECT })),
        ),
      },
    );
    const submitted = await svc.submit(CTX, PROJECT, IDS);
    expect(submitted.job.state).toBe('queued');
  });
});
