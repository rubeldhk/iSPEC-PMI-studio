/**
 * `T1905` (EPIC-047) — the four ports whose owners are not on `main` refuse.
 *
 * `R-047-13`. `EPIC-031`, `EPIC-032` and `EPIC-038` are open pull requests, and
 * nothing in the programme selects a gateway by model (`R-047-2`). Bound
 * permissively, each would make an Expert look governed while nothing governed
 * it — an approval nobody gave, an Evidence Contract nobody checked. So each
 * throws `GovernanceSeamUnboundError` (`503`) **naming itself**.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import {
  refusingContextAssembler,
  refusingContractApprovals,
  refusingEvidenceContracts,
  refusingGateways,
} from '../../src/modules/experts/experts.tokens.js';

async function refusal(attempt: () => Promise<unknown>): Promise<Error> {
  try {
    await attempt();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a refusal');
}

describe('T1905 · unbound ports refuse, naming themselves', () => {
  it('ExpertGateways', async () => {
    const e = await refusal(() => refusingGateways().gatewaysFor('claude-opus-5-5'));
    expect(e).toBeInstanceOf(GovernanceSeamUnboundError);
    expect(e.message).toMatch(/ExpertGateways/);
  });

  it('ContractApprovals — both submitting and reading a resolution', async () => {
    const ports = refusingContractApprovals();
    const submit = await refusal(() =>
      ports.submit({
        workspaceId: 'ws_1',
        actionType: 'expert-contract.approve',
        targetType: 'expert-contract-version',
        targetId: 'v1',
        objectVersion: 1,
        riskClass: 'low',
        actorId: 'u_1',
      }),
    );
    const read = await refusal(() => ports.resolutionOf('ws_1', 'd_1'));
    for (const e of [submit, read]) {
      expect(e).toBeInstanceOf(GovernanceSeamUnboundError);
      expect(e.message).toMatch(/ContractApprovals.*EPIC-031/);
    }
  });

  it('EvidenceContracts — never answers "exists" unchecked', async () => {
    const e = await refusal(() =>
      refusingEvidenceContracts().exists({ workClass: 'implementation', contractVersion: 1 }),
    );
    expect(e).toBeInstanceOf(GovernanceSeamUnboundError);
    expect(e.message).toMatch(/EvidenceContracts.*EPIC-032/);
  });

  it('ContextAssembler', async () => {
    const e = await refusal(() =>
      refusingContextAssembler().assemble({
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        objective: 'o',
        actorId: 'u_1',
        actorRole: 'engineer',
        policy: { budgetTokens: 1000, budgetCost: 1, includeLiveState: false },
      }),
    );
    expect(e).toBeInstanceOf(GovernanceSeamUnboundError);
    expect(e.message).toMatch(/ContextAssembler.*EPIC-038/);
  });
});
