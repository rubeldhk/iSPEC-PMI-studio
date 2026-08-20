/**
 * T842 — the submitted selection is checked against project and workspace
 * (F3, **FR-002**, **SC-004**, US3 scenario 1).
 *
 * Written to FAIL before T843 exists (Constitution V).
 *
 * Found by the `/speckit-converge EPIC-008` pass. `submit()` de-duplicated the
 * ids, bounded their count, and passed them into `inputRefs` unchecked — it
 * never asked whether those requirements exist, belong to the project, or
 * belong to the acting workspace. FR-002's universal rule ("every request
 * resolves a workspace from the session; every query is workspace-filtered")
 * was not applied to the one input this endpoint takes.
 *
 * The refusal for a foreign requirement and for a non-existent one must be
 * IDENTICAL (SC-004). A caller who can tell them apart has an oracle for
 * "does this id exist in some other workspace".
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { JobsService } from '../../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
  LookupRequirementSelection,
} from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, OTHER_WS, PROJECT, StubEngine, WS } from './helpers.js';

const OTHER_PROJECT = 'proj_2';

const REGISTER = [
  { id: 'req_ours', workspaceId: WS, projectId: PROJECT },
  { id: 'req_other_project', workspaceId: WS, projectId: OTHER_PROJECT },
  { id: 'req_other_workspace', workspaceId: OTHER_WS, projectId: PROJECT },
];

function service(): {
  service: GenerateSpecificationService;
  ledger: InMemoryGenerationJobLedger;
  engine: StubEngine;
  resolved: { count: number };
} {
  const ledger = new InMemoryGenerationJobLedger();
  const engine = StubEngine.returning();
  const resolved = { count: 0 };
  return {
    ledger,
    engine,
    resolved,
    service: new GenerateSpecificationService(
      {
        resolveForProject: async () => {
          resolved.count += 1;
          return engine;
        },
      },
      new InMemorySpecificationStore(),
      {
        jobs: new JobsService(ledger),
        ledger,
        requirements: new InMemoryRequirementSelection(REGISTER),
      },
    ),
  };
}

describe('a selection inside the project and workspace is accepted', () => {
  it('submits and answers with a job', async () => {
    const { service: svc } = service();
    const submitted = await svc.submit(CTX, PROJECT, ['req_ours']);
    expect(submitted.job.state).toBe('queued');
  });
});

describe('a selection reaching outside the scope is refused (FR-002)', () => {
  it.each([
    ['a requirement from another project', ['req_ours', 'req_other_project']],
    ['a requirement from another workspace', ['req_ours', 'req_other_workspace']],
    ['a requirement that does not exist', ['req_ours', 'req_nowhere']],
    ['only out-of-scope requirements', ['req_other_workspace']],
  ])('%s is refused', async (_label, ids) => {
    const { service: svc } = service();
    const error = await svc.submit(CTX, PROJECT, ids).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    const details = (error as ValidationFailedError).details as { fields: { field: string }[] };
    expect(details.fields.some((f) => f.field === 'requirementIds')).toBe(true);
  });

  it.each([
    ['another project', ['req_other_project']],
    ['another workspace', ['req_other_workspace']],
    ['nowhere at all', ['req_nowhere']],
  ])('creates NO job when the selection names %s', async (_label, ids) => {
    const { service: svc } = service();
    await svc.submit(CTX, PROJECT, ids).catch(() => undefined);
    expect(await svc.jobsForProject(WS, PROJECT)).toEqual([]);
  });

  it('never resolves an engine for an invalid selection — no wasted lookup', async () => {
    const { service: svc, resolved } = service();
    await svc.submit(CTX, PROJECT, ['req_nowhere']).catch(() => undefined);
    expect(resolved.count).toBe(0);
  });
});

describe('a foreign requirement is indistinguishable from an absent one (SC-004)', () => {
  it('produces byte-identical refusals for the two cases', async () => {
    const { service: svc } = service();
    const foreign = (await svc
      .submit(CTX, PROJECT, ['req_other_workspace'])
      .catch((e: unknown) => e)) as ValidationFailedError;
    const absent = (await svc
      .submit(CTX, PROJECT, ['req_other_workspace_or_not'])
      .catch((e: unknown) => e)) as ValidationFailedError;

    // Compare the SHAPE, with the caller's own ids normalised away: what must
    // not differ is anything the platform contributes.
    const shape = (e: ValidationFailedError): string =>
      JSON.stringify({
        code: e.code,
        message: e.message,
        fields: (e.details as { fields: { field: string; reason: string }[] }).fields.map((f) => ({
          field: f.field,
          reason: f.reason,
        })),
      });

    expect(shape(foreign)).toBe(shape(absent));
  });

  it('echoes only ids the caller already supplied', async () => {
    const { service: svc } = service();
    const error = (await svc
      .submit(CTX, PROJECT, ['req_ours', 'req_other_workspace'])
      .catch((e: unknown) => e)) as ValidationFailedError;
    const body = JSON.stringify(error.details);

    // `req_ours` is valid and must not be reported; `req_other_workspace` came
    // from the caller, so repeating it discloses nothing they did not send.
    expect(body).toContain('req_other_workspace');
    expect(body).not.toContain('req_ours');
  });
});

describe('the check runs after the cheap refusals (rule E7)', () => {
  it('an empty selection is still `empty_selection`, not a scope failure', async () => {
    const { service: svc } = service();
    const error = await svc.submit(CTX, PROJECT, []).catch((e: unknown) => e);
    expect((error as ValidationFailedError).details).toMatchObject({ reason: 'empty_selection' });
  });
});

describe('LookupRequirementSelection — the source a running deployment uses', () => {
  const register = new Map(REGISTER.map((r) => [r.id, r]));
  const lookup = new LookupRequirementSelection({
    findById: async (id: string) => register.get(id) ?? null,
  });

  it('accepts an id that matches BOTH scopes', async () => {
    expect(await lookup.findSelectable(WS, PROJECT, ['req_ours'])).toEqual(['req_ours']);
  });

  it.each([
    ['the wrong project', 'req_other_project'],
    ['the wrong workspace', 'req_other_workspace'],
    ['no row at all', 'req_nowhere'],
  ])('drops an id from %s', async (_label, id) => {
    expect(await lookup.findSelectable(WS, PROJECT, [id])).toEqual([]);
  });

  it('keeps only the in-scope ids from a mixed selection', async () => {
    const ids = REGISTER.map((r) => r.id).concat('req_nowhere');
    expect(await lookup.findSelectable(WS, PROJECT, ids)).toEqual(['req_ours']);
  });

  it('agrees with the in-memory source on every case', async () => {
    // Two implementations of one scope rule. This is the test that fails when
    // they start to disagree — the T648 lesson, applied before it bites.
    const inMemory = new InMemoryRequirementSelection(REGISTER);
    const ids = REGISTER.map((r) => r.id).concat('req_nowhere');
    expect(await lookup.findSelectable(WS, PROJECT, ids)).toEqual(
      await inMemory.findSelectable(WS, PROJECT, ids),
    );
  });

  it('asks nothing of the register for an empty selection', async () => {
    let calls = 0;
    const counting = new LookupRequirementSelection({
      findById: async () => {
        calls += 1;
        return null;
      },
    });
    expect(await counting.findSelectable(WS, PROJECT, [])).toEqual([]);
    expect(calls).toBe(0);
  });
});
