/**
 * T119 — contract tests for the validation endpoints against
 * `contracts/platform-api.md` (Jobs · US6, Specifications · US6).
 *
 * Written to FAIL before T123 exists (Constitution V).
 *
 * Driven through the controller against real services. Two contract claims:
 * validation is asynchronous like every other engine capability (202 with a
 * job), and every finding carries a location (FR-023).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { JobsService } from '../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
} from '../../src/modules/specifications/generate-specification.service.js';
import {
  InMemoryTransitionRecorder,
  LifecycleMachine,
} from '../../src/modules/specifications/lifecycle.machine.js';
import { SpecificationLifecycleService } from '../../src/modules/specifications/lifecycle.service.js';
import { SpecificationSearchService } from '../../src/modules/specifications/specification-search.service.js';
import { SpecificationsController } from '../../src/modules/specifications/specifications.controller.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
} from '../../src/modules/specifications/specifications-read.service.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = SpecificationsController.prototype[handler as keyof SpecificationsController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const OTHER = { workspaceId: 'ws_b', userId: 'u2' };
const SPEC_ID = 'spec_1';

const FINDINGS = [
  { id: 'f1', location: '§2 Scope', severity: 'error', message: 'Unresolved placeholder' },
  { id: 'f2', location: '§4 Interfaces', severity: 'warning', message: 'Untestable statement' },
];

async function world(findings = FINDINGS): Promise<SpecificationsController> {
  const store = new InMemorySpecificationStore();
  const ledger = new InMemoryGenerationJobLedger();
  const machine = new LifecycleMachine(new InMemoryTransitionRecorder());

  await store.commitGeneration({
    specification: {
      id: SPEC_ID,
      workspaceId: CTX.workspaceId,
      projectId: 'proj_1',
      title: 'Payments',
      lifecycleState: 'review',
      currentVersionId: 'ver_1',
      engineName: 'stub',
      engineVersion: '1.0.0',
      generatedAt: new Date('2026-08-20T10:00:00.000Z'),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: 'ver_1',
      workspaceId: CTX.workspaceId,
      specificationId: SPEC_ID,
      versionNumber: 1,
      contentRaw: '# Payments',
      contentParsed: { sections: ['a'] },
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [
      {
        workspaceId: CTX.workspaceId,
        sourceType: 'specification',
        sourceId: SPEC_ID,
        targetType: 'requirement',
        targetId: 'req_1',
        relationship: 'generated_from',
      },
    ],
    job: { id: 'job_seed', state: 'succeeded', resultRef: SPEC_ID },
  });

  const generation = new GenerateSpecificationService(
    { resolveForProject: async () => ({ descriptor: { name: 'stub', version: '1.0.0' } }) as never },
    store,
    {
      jobs: new JobsService(ledger),
      ledger,
      requirements: new InMemoryRequirementSelection([]),
    },
  );

  return new SpecificationsController(
    generation,
    new SpecificationsReadService(store),
    new SpecificationSearchService(store),
    new SpecificationLifecycleService(store, machine, {
      findings: { outstandingFor: async () => findings as never },
    }),
  );
}

describe('contract · validation route surface (US6)', () => {
  it.each([
    ['validate', 'specifications/:id/jobs/validate', RequestMethod.POST],
    ['findings', 'specifications/:id/findings', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('validation answers 202 — an engine capability is never synchronous', () => {
    expect(Reflect.getMetadata('__httpCode__', SpecificationsController.prototype.validate)).toBe(202);
  });
});

describe('contract · POST /specifications/{id}/jobs/validate', () => {
  it('answers a job of kind validate_specification', async () => {
    const c = await world();
    const body = await c.validate(CTX, SPEC_ID);
    expect(body.kind).toBe('validate_specification');
    expect(['queued', 'running']).toContain(body.state);
    expect(body.failureReason).toBeNull();
  });

  it('a duplicate request joins the live job rather than billing a second run', async () => {
    const c = await world();
    const first = await c.validate(CTX, SPEC_ID);
    const second = await c.validate(CTX, SPEC_ID);
    expect(second.id).toBe(first.id);
  });

  it('is 404 for a specification in another workspace', async () => {
    const c = await world();
    const error = await c.validate(OTHER, SPEC_ID).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
    expect(toErrorBody(error).error.message).toBe('Not found.');
  });

  it('is 404 for a specification that does not exist — indistinguishable', async () => {
    const c = await world();
    const error = await c.validate(CTX, 'spec_nowhere').catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
  });
});

describe('contract · GET /specifications/{id}/findings (FR-023)', () => {
  it('returns every finding with the location it concerns', async () => {
    const c = await world();
    const findings = await c.findings(CTX, SPEC_ID);
    expect(findings).toHaveLength(2);
    for (const finding of findings) {
      expect(finding.location).toBeTruthy();
    }
  });

  it('reports a clean specification as an empty list, not an error (US6 scenario 2)', async () => {
    // "Found nothing" is a PASS for review — the deliberate inversion of
    // generation's empty-output rule, recorded in EPIC-008's plan.
    const c = await world([]);
    expect(await c.findings(CTX, SPEC_ID)).toEqual([]);
  });

  it('is 404 across a workspace boundary', async () => {
    const c = await world();
    const error = await c.findings(OTHER, SPEC_ID).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
  });
});
