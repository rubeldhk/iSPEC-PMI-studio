/**
 * T119 — contract tests for the validation endpoints against
 * `contracts/platform-api.md` (US6).
 *
 * `POST /specifications/{id}/jobs/validate` is 202 — generation and validation
 * are ALWAYS asynchronous (R-001). `GET /specifications/{id}/findings` returns
 * findings that each carry a location (FR-023).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { SpecificationLifecycleController } from '../../src/modules/specifications/specifications.controller.js';
import {
  InMemoryFindingStore,
  SpecificationLifecycleService,
} from '../../src/modules/specifications/lifecycle-api.service.js';
import { InMemoryTransitionRecorder } from '../../src/modules/specifications/lifecycle.machine.js';
import { InMemorySpecificationStore } from '../../src/modules/specifications/specifications-read.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';
const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = SpecificationLifecycleController.prototype[
    handler as keyof SpecificationLifecycleController
  ] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

describe('contract · validation route surface (US6)', () => {
  it('POST /specifications/{id}/jobs/validate — 202, a job, never a synchronous result', () => {
    expect(route('validate')).toEqual({
      path: 'specifications/:id/jobs/validate',
      method: RequestMethod.POST,
    });
    expect(
      Reflect.getMetadata('__httpCode__', SpecificationLifecycleController.prototype.validate),
    ).toBe(202);
  });

  it('GET /specifications/{id}/findings', () => {
    expect(route('findings')).toEqual({
      path: 'specifications/:id/findings',
      method: RequestMethod.GET,
    });
  });
});

describe('contract · findings behaviour (FR-023)', () => {
  async function build(): Promise<{
    controller: SpecificationLifecycleController;
    findings: InMemoryFindingStore;
    specificationId: string;
    versionId: string;
  }> {
    const store = new InMemorySpecificationStore();
    const committed = await store.commitGeneration({
      specification: {
        id: 's_val',
        workspaceId: 'ws_a',
        projectId: 'p1',
        title: 'Probe',
        lifecycleState: 'draft',
        currentVersionId: 'sv_val',
        engineName: 'fixture',
        engineVersion: '0.1.0',
        generatedAt: new Date(),
        isOutOfDate: false,
        createdById: 'u1',
        updatedById: 'u1',
      },
      version: {
        id: 'sv_val',
        workspaceId: 'ws_a',
        specificationId: 's_val',
        versionNumber: 1,
        contentRaw: '# v1\n',
        contentParsed: {},
        lifecycleStateAtCreation: 'draft',
        authoredById: 'u1',
      },
      links: [],
      job: { id: 'job_val', state: 'succeeded', resultRef: 'spec:s_val' },
    });
    const findings = new InMemoryFindingStore();
    const service = new SpecificationLifecycleService(
      store,
      new InMemoryTransitionRecorder(),
      findings,
    );
    return {
      controller: new SpecificationLifecycleController(service),
      findings,
      specificationId: committed.id,
      versionId: committed.currentVersionId as string,
    };
  }

  it('returns each finding WITH its location', async () => {
    const { controller, findings, specificationId, versionId } = await build();
    await findings.appendAll([
      {
        id: 'f1',
        workspaceId: 'ws_a',
        specificationId,
        specificationVersionId: versionId,
        location: 'acceptance criteria',
        severity: 'error',
        message: 'no measurable outcome',
      },
    ]);
    const out = await controller.findings(CTX, specificationId);
    expect(out).toHaveLength(1);
    expect(out[0]?.location).toBe('acceptance criteria');
  });

  it('findings are workspace-scoped — another workspace reads the opaque 404', async () => {
    const { controller, specificationId } = await build();
    const err = await controller
      .findings({ workspaceId: 'ws_b', userId: 'u9' }, specificationId)
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
    expect(toErrorBody(err).error.code).toBe('not_found');
  });
});
