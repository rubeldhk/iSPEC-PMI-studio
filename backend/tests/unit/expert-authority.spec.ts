/**
 * `T1929` (EPIC-047) — a run may do only what its contract allows **and** what
 * its requester may do.
 *
 * `FR-EXP-012`, `FR-EXP-013`, `FR-EXP-014`. Three rules: a capability or tool
 * outside the contract is refused by name; a prohibited action is refused even
 * when the contract also allows it; and every target must be allowed by the
 * contract and by `EPIC-024` for the requesting actor — an Expert is never a
 * route to authority its requester lacks.
 */
import { describe, expect, it } from 'vitest';
import { contractRefusal, targetRefusal } from '../../src/modules/experts/authority.js';
import { accessFrom, contract } from '../helpers/expert-fixtures.js';

const ask = (over: Partial<{ capabilities: string[]; tools: string[]; actions: string[] }> = {}) => ({
  capabilities: ['test'],
  tools: ['run-tests'],
  actions: [],
  ...over,
});

describe('T1929 · authority', () => {
  it('admits a request inside the contract', () => {
    expect(contractRefusal(contract(), ask())).toBeNull();
  });

  it('refuses a capability outside the contract, naming it', () => {
    expect(contractRefusal(contract(), ask({ capabilities: ['generate'] }))).toMatch(/capability.*generate/);
  });

  it('refuses a tool outside the contract, naming it', () => {
    expect(contractRefusal(contract(), ask({ tools: ['run-tests', 'shell'] }))).toMatch(/tool.*shell/);
  });

  it('refuses a prohibited action', () => {
    expect(contractRefusal(contract(), ask({ actions: ['push'] }))).toMatch(/prohibited.*push/);
  });

  it('a prohibition wins over an allowance (FR-EXP-013)', () => {
    const c = contract({ allowedTools: ['run-tests', 'push'], prohibitedActions: ['push'] });
    expect(contractRefusal(c, ask({ tools: ['push'] }))).toMatch(/prohibited.*push/);
  });

  it('a target the contract allows and the actor may touch is admitted', async () => {
    const access = accessFrom({ 'u_1:specification:sp_1': 'read' });
    await expect(
      targetRefusal('ws_1', 'u_1', contract(), [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }], access),
    ).resolves.toBeNull();
  });

  it('a target the contract does not cover is refused, though the actor could touch it', async () => {
    const access = accessFrom({ 'u_1:specification:sp_1': 'edit' });
    const refusal = await targetRefusal(
      'ws_1',
      'u_1',
      contract(),
      [{ artifactType: 'specification', artifactId: 'sp_1', action: 'edit' }],
      access,
    );
    expect(refusal).toMatch(/contract.*edit.*specification/);
  });

  it('a target the contract covers but the actor may not touch is refused (FR-EXP-014)', async () => {
    const refusal = await targetRefusal(
      'ws_1',
      'u_1',
      contract(),
      [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
      accessFrom({}),
    );
    expect(refusal).toMatch(/u_1 may not read specification sp_1/);
  });

  it('a fault in the access check propagates rather than admitting', async () => {
    await expect(
      targetRefusal('ws_1', 'u_1', contract(), [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }], {
        async mayRead() {
          throw new Error('grant store unreachable');
        },
        async mayEdit() {
          throw new Error('grant store unreachable');
        },
      }),
    ).rejects.toThrow(/unreachable/);
  });
});
