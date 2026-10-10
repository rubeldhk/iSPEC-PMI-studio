/**
 * `T1923` (EPIC-047) — the registry: register, version, submit, retire.
 *
 * `FR-EXP-001`…`FR-EXP-009`. Every act passes through `authoring.ts` and
 * records its actor and instant. A new version is a whole contract, never a
 * patch; a submission happens once; the effective version is the highest
 * approved; and retiring keeps the history it ends.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { Authoring } from '../../src/modules/experts/authoring.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { RegistryService } from '../../src/modules/experts/registry.service.js';
import {
  accessFrom,
  authorOfWs1,
  contract,
  evidenceKnowing,
  recordingApprovals,
  type RecordingApprovals,
} from '../helpers/expert-fixtures.js';

const NOW = '2026-10-09T09:00:00.000Z';

function registry(over: { approvals?: RecordingApprovals; access?: ReturnType<typeof authorOfWs1> } = {}) {
  const store = new InMemoryExpertsStore();
  const approvals = over.approvals ?? recordingApprovals();
  let n = 0;
  const service = new RegistryService(store, {
    authoring: new Authoring(over.access ?? authorOfWs1()),
    approvals,
    evidence: evidenceKnowing('implementation@1'),
    clock: () => NOW,
    ids: () => `id_${(n += 1)}`,
  });
  return { store, approvals, service };
}

const input = { key: 'test-engineer', name: 'Test Engineer', contract: contract() };

describe('T1923 · the registry', () => {
  it('register creates the Expert and version 1 as a draft, recording actor and instant', async () => {
    const { service } = registry();
    const created = await service.register('ws_1', 'u_1', input);
    expect(created.expert).toMatchObject({ key: 'test-engineer', status: 'active', registeredBy: 'u_1', registeredAt: NOW });
    const view = await service.get('ws_1', 'u_1', created.expert.id);
    expect(view.versions.map((v) => [v.version, v.status, v.createdBy])).toEqual([[1, 'draft', 'u_1']]);
    expect(view.effectiveVersion).toBeNull();
  });

  it('refuses a key that is not a lowercase slug, and a blank name', async () => {
    const { service } = registry();
    await expect(service.register('ws_1', 'u_1', { ...input, key: 'Test Engineer' })).rejects.toBeInstanceOf(
      ValidationFailedError,
    );
    await expect(service.register('ws_1', 'u_1', { ...input, name: '  ' })).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('a new version is the next number and carries the whole new contract', async () => {
    const { service } = registry();
    const { expert } = await service.register('ws_1', 'u_1', input);
    const v2 = await service.newVersion('ws_1', 'u_1', expert.id, contract({ rolePurpose: 'revised' }));
    expect([v2.version, v2.contract.rolePurpose]).toEqual([2, 'revised']);
    const view = await service.get('ws_1', 'u_1', expert.id);
    expect(view.versions.map((v) => v.contract.rolePurpose)).toEqual([contract().rolePurpose, 'revised']);
  });

  it('submit sends the version to EPIC-031 with its risk class, stores the decision once, and refuses a second', async () => {
    const { service, approvals } = registry();
    const { expert } = await service.register('ws_1', 'u_1', input);
    await service.submit('ws_1', 'u_1', expert.id, 1);
    expect(approvals.submitted).toEqual([
      expect.objectContaining({
        actionType: 'expert-contract.approve',
        targetType: 'expert-contract-version',
        objectVersion: 1,
        riskClass: 'medium',
        actorId: 'u_1',
      }),
    ]);
    expect((await service.get('ws_1', 'u_1', expert.id)).versions[0]?.status).toBe('submitted');
    await expect(service.submit('ws_1', 'u_1', expert.id, 1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('the effective version is the highest approved', async () => {
    const { service, approvals } = registry();
    const { expert } = await service.register('ws_1', 'u_1', input);
    await service.newVersion('ws_1', 'u_1', expert.id, contract({ rolePurpose: 'v2' }));
    await service.submit('ws_1', 'u_1', expert.id, 1);
    await service.submit('ws_1', 'u_1', expert.id, 2);
    approvals.resolve('d_1', 'approved');
    approvals.resolve('d_2', 'refused');
    expect((await service.get('ws_1', 'u_1', expert.id)).effectiveVersion?.version).toBe(1);
  });

  it('retire is idempotent, keeps history, and a retired Expert takes no new versions', async () => {
    const { service } = registry();
    const { expert } = await service.register('ws_1', 'u_1', input);
    await service.retire('ws_1', 'u_1', expert.id);
    await service.retire('ws_1', 'u_1', expert.id);
    const view = await service.get('ws_1', 'u_1', expert.id);
    expect([view.expert.status, view.expert.retiredBy, view.versions.length]).toEqual(['retired', 'u_1', 1]);
    await expect(service.newVersion('ws_1', 'u_1', expert.id, contract())).rejects.toBeInstanceOf(ConflictError);
  });

  it('every act needs the edit grant; reading needs read (FR-EXP-009)', async () => {
    const reader = registry({ access: accessFrom({ 'u_1:expert-registry:ws_1': 'read' }) });
    await expect(reader.service.register('ws_1', 'u_1', input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reader.service.list('ws_1', 'u_1')).resolves.toEqual([]);
    const nobody = registry({ access: accessFrom({}) });
    await expect(nobody.service.list('ws_1', 'u_1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('an Expert in another workspace is not found', async () => {
    const { service } = registry({
      access: accessFrom({ 'u_1:expert-registry:ws_1': 'edit', 'u_1:expert-registry:ws_2': 'edit' }),
    });
    const { expert } = await service.register('ws_1', 'u_1', input);
    await expect(service.get('ws_2', 'u_1', expert.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.submit('ws_2', 'u_1', expert.id, 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('list shows role, risk class, effective version and status', async () => {
    const { service, approvals } = registry();
    const { expert } = await service.register('ws_1', 'u_1', input);
    await service.submit('ws_1', 'u_1', expert.id, 1);
    approvals.resolve('d_1', 'approved');
    expect(await service.list('ws_1', 'u_1')).toEqual([
      expect.objectContaining({
        id: expert.id,
        key: 'test-engineer',
        status: 'active',
        rolePurpose: contract().rolePurpose,
        riskClass: 'medium',
        effectiveVersion: 1,
        latestVersion: 1,
      }),
    ]);
  });
});
