/**
 * `T1927` (EPIC-047) — comparing two contract versions, element by element.
 *
 * `FR-EXP-072`. All twelve elements are reported, and an unchanged element is
 * reported **as unchanged** rather than left out — an omission would let a
 * reader assume something was compared that was not.
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/core/errors.js';
import { compareContracts } from '../../src/modules/experts/registry.service.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T1927 · version comparison', () => {
  it('reports all twelve elements, marking only what changed', () => {
    const diff = compareContracts(contract(), contract({ riskClass: 'high', allowedTools: ['read-file'] }));
    expect(diff).toHaveLength(12);
    expect(diff.filter((d) => d.changed).map((d) => d.element)).toEqual([
      'allowed tools and capabilities',
      'risk class',
    ]);
    const risk = diff.find((d) => d.element === 'risk class');
    expect([risk?.from, risk?.to]).toEqual([{ riskClass: 'medium' }, { riskClass: 'high' }]);
  });

  it('identical contracts compare as twelve unchanged elements, none omitted', () => {
    const diff = compareContracts(contract(), contract());
    expect(diff.map((d) => d.changed)).toEqual(Array(12).fill(false));
  });

  it('a version that does not exist is not found', async () => {
    const { RegistryService } = await import('../../src/modules/experts/registry.service.js');
    const { InMemoryExpertsStore } = await import('../../src/modules/experts/experts.store.js');
    const { Authoring } = await import('../../src/modules/experts/authoring.js');
    const { authorOfWs1, evidenceKnowing, recordingApprovals } = await import('../helpers/expert-fixtures.js');
    const service = new RegistryService(new InMemoryExpertsStore(), {
      authoring: new Authoring(authorOfWs1()),
      approvals: recordingApprovals(),
      evidence: evidenceKnowing('implementation@1'),
    });
    const { expert } = await service.register('ws_1', 'u_1', { key: 'qa', name: 'QA', contract: contract() });
    await expect(service.compare('ws_1', 'u_1', expert.id, 1, 2)).rejects.toBeInstanceOf(NotFoundError);
  });
});
