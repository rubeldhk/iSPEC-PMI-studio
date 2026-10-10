/**
 * T858e — the zero-item Contract, written to fail first. `FR-EVS-026`.
 *
 * A Contract with no items is a gate that always passes, and it looks identical
 * to a Contract nobody has written yet. So it is permitted **only** with an
 * explicit `zeroItemPolicyRef`, and the emptiness is **visible** in the status a
 * Room renders and in the gate's acceptance — never a silent pass.
 */
import { describe, expect, it } from 'vitest';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const empty = { workClass: 'chore', contractVersion: 1, items: [], zeroItemPolicyRef: 'POLICY-chore-none' };
const principal = { workspaceId: 'ws_zero', userId: 'u1' };

describe('T858e · FR-EVS-026 — empty only on purpose', () => {
  it('refuses to load a zero-item Contract with no policy reference', () => {
    expect(() => ContractCatalog.fromDefinitions([{ ...empty, zeroItemPolicyRef: undefined }])).toThrow(
      /zero-items-without-policy/,
    );
  });

  it('loads one that names its policy', () => {
    expect(ContractCatalog.fromDefinitions([empty]).latest('chore')).toMatchObject({
      zeroItemPolicyRef: 'POLICY-chore-none',
    });
  });

  it('shows the emptiness in the status, so a reader can see it was empty on purpose', async () => {
    const repository = new InMemoryEvidenceRepository();
    const catalog = ContractCatalog.fromDefinitions([empty]);
    const gate = new CompletionGate(repository, catalog, null);
    const svc = new EvidenceService(repository, catalog, gate, { canRead: async () => true }, null);
    const bound = await svc.bind(principal, {
      workRef: { type: 'task', id: 'C-1' },
      workClass: 'chore',
      projectId: 'p1',
      subject: { type: 'file', id: 'f', version: 1 },
    });
    expect(bound.status).toMatchObject({ satisfied: true, unmet: [], zeroItemPolicyRef: 'POLICY-chore-none' });
    await expect(gate.complete('ws_zero', { type: 'task', id: 'C-1' }, 'user:u1')).resolves.toEqual({ ok: true });
  });
});
