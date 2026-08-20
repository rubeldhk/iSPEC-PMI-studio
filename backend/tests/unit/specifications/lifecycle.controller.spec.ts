/**
 * T112a — the lifecycle and version endpoints with a mocked service.
 * Written to FAIL before T113 exists (Constitution V).
 *
 * PC-1: the controller is a transport. Everything asserted here is delegation
 * and shape. The RULES — which transitions exist, what approval surfaces
 * first — live in `lifecycle.machine.ts` and `approval.service.ts`, where the
 * worker and a Phase 3 MCP surface reach them without HTTP.
 */
import { describe, expect, it, vi } from 'vitest';
import { UnauthenticatedError } from '../../../src/core/errors.js';
import { SpecificationsController } from '../../../src/modules/specifications/specifications.controller.js';
import type { SpecificationLifecycleApi } from '../../../src/modules/specifications/lifecycle.service.js';
import type { GenerationJobApi } from '../../../src/modules/specifications/generate-specification.service.js';
import type { SpecificationSearchApi } from '../../../src/modules/specifications/specification-search.service.js';
import type {
  SpecificationReadApi,
  SpecificationRecord,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, PROJECT, WS } from './helpers.js';

const AT = new Date('2026-08-20T10:00:00.000Z');

const SPEC: SpecificationRecord = {
  id: 'spec_1',
  workspaceId: WS,
  projectId: PROJECT,
  title: 'Payments Specification',
  lifecycleState: 'review',
  currentVersionId: 'ver_1',
  engineName: 'stub',
  engineVersion: '1.0.0',
  generatedAt: AT,
  isOutOfDate: false,
  createdAt: AT,
  createdById: 'u1',
  updatedAt: AT,
  updatedById: 'u1',
};

const TRANSITION = {
  id: 't1',
  workspaceId: WS,
  specificationId: 'spec_1',
  fromState: 'review' as const,
  toState: 'approved' as const,
  actorId: 'u1',
  occurredAt: AT,
};

function build(): { c: SpecificationsController; lifecycle: SpecificationLifecycleApi } {
  const lifecycle = {
    move: vi.fn(async () => ({ specification: SPEC, transition: TRANSITION, outstandingFindings: [] })),
    versions: vi.fn(async () => []),
    diff: vi.fn(async () => ({
      fromVersion: 1,
      toVersion: 2,
      added: [],
      removed: [],
      unchanged: 0,
      identical: false,
    })),
    findings: vi.fn(async () => []),
  } as unknown as SpecificationLifecycleApi;

  return {
    lifecycle,
    c: new SpecificationsController(
      {} as unknown as GenerationJobApi,
      {} as unknown as SpecificationReadApi,
      {} as unknown as SpecificationSearchApi,
      lifecycle,
    ),
  };
}

describe('the six lifecycle transitions each delegate their own action (FR-011)', () => {
  it.each([
    ['submitForReview', 'submit-for-review'],
    ['reject', 'reject'],
    ['approve', 'approve'],
    ['baseline', 'baseline'],
    ['markImplemented', 'mark-implemented'],
    ['archive', 'archive'],
  ])('%s → %s', async (handler, action) => {
    const { c, lifecycle } = build();
    await (c[handler as keyof SpecificationsController] as (...a: unknown[]) => Promise<unknown>).call(
      c,
      CTX,
      'spec_1',
    );
    expect(lifecycle.move).toHaveBeenCalledWith(CTX, 'spec_1', action);
  });

  it('answers with the specification and the recorded transition (FR-014)', async () => {
    const { c } = build();
    const body = await c.approve(CTX, 'spec_1');
    expect(body.specification.id).toBe('spec_1');
    expect(body.transition).toMatchObject({ fromState: 'review', toState: 'approved', actorId: 'u1' });
  });

  it('surfaces outstanding findings on approval (US6 scenario 3)', async () => {
    const { c } = build();
    const body = await c.approve(CTX, 'spec_1');
    // Always present, possibly empty — a caller must not have to guess whether
    // the check ran.
    expect(body.outstandingFindings).toEqual([]);
  });
});

describe('version endpoints', () => {
  it('versions delegates under the session workspace', async () => {
    const { c, lifecycle } = build();
    await c.versions(CTX, 'spec_1');
    expect(lifecycle.versions).toHaveBeenCalledWith(WS, 'spec_1');
  });

  it('diff delegates both version numbers, as numbers', async () => {
    const { c, lifecycle } = build();
    await c.diff(CTX, 'spec_1', '1', '2');
    expect(lifecycle.diff).toHaveBeenCalledWith(WS, 'spec_1', 1, 2);
  });

  it('findings delegates under the session workspace (FR-023)', async () => {
    const { c, lifecycle } = build();
    await c.findings(CTX, 'spec_1');
    expect(lifecycle.findings).toHaveBeenCalledWith(WS, 'spec_1');
  });
});

describe('authentication', () => {
  it.each([
    ['submitForReview', (c: SpecificationsController) => c.submitForReview(undefined, 'spec_1')],
    ['approve', (c: SpecificationsController) => c.approve(undefined, 'spec_1')],
    ['archive', (c: SpecificationsController) => c.archive(undefined, 'spec_1')],
    ['versions', (c: SpecificationsController) => c.versions(undefined, 'spec_1')],
    ['diff', (c: SpecificationsController) => c.diff(undefined, 'spec_1', '1', '2')],
    ['findings', (c: SpecificationsController) => c.findings(undefined, 'spec_1')],
  ])('%s refuses a request with no session', async (_label, call) => {
    const { c } = build();
    await expect(call(c)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
