/**
 * `T2311` (EPIC-048) — the eleven ports of `contracts/learning-contract.md` §5,
 * bound refusing, each do what its row says (`R-048-20`).
 *
 * The rule the file applies eleven times: **a default that permits is
 * invisible** (`FR-GEL-062`). So every assertion below is about an absence
 * answering *no*: an unbound decision path is not an approval, unbound evidence
 * is not verified, an unbound reader check is not a grant.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import {
  LEARNING_PORTS,
  refusingPorts,
  unboundAdmission,
  type LearningPorts,
} from '../../src/modules/learning/learning.tokens.js';

const WS = 'ws_a';

async function refusal(fn: () => Promise<unknown>): Promise<GovernanceSeamUnboundError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GovernanceSeamUnboundError);
    return err as GovernanceSeamUnboundError;
  }
  throw new Error('expected a refusal, got an answer');
}

describe('T2311 · the eleven ports are declared, each with what its absence does', () => {
  it('are exactly the eleven of the contract', () => {
    expect(LEARNING_PORTS.map((p) => p.name).sort()).toEqual(
      [
        'ApprovalAttestations',
        'Audit',
        'EvidenceReads',
        'Executions',
        'ExpertProvenance',
        'KnowledgeIndex',
        'LearningDecisions',
        'LearningPolicySource',
        'Principals',
        'ReaderAccess',
        'SecretScreen',
      ].sort(),
    );
  });

  it('none declares a permissive absence', () => {
    for (const port of LEARNING_PORTS) {
      expect(['refuse', 'withhold', 'stay-proposed', 'flag', 'not-yet-retrievable']).toContain(port.absent);
      expect(port.filledBy.length).toBeGreaterThan(0);
      expect(port.because.length).toBeGreaterThan(20);
    }
  });
});

describe('T2311 · bound refusing', () => {
  const ports: LearningPorts = refusingPorts();

  it.each([
    ['EvidenceReads', () => ports.evidence.resolve(WS, ['ev_1'])],
    ['ExpertProvenance', () => ports.experts.forExecution(WS, 'exe_1')],
    ['LearningDecisions', () => ports.decisions.decide({} as never)],
    ['LearningDecisions', () => ports.decisions.approve({ workspaceId: WS, decisionId: 'd', approver: { kind: 'human', id: 'u' } })],
    ['LearningDecisions', () => ports.decisions.refuse({ workspaceId: WS, decisionId: 'd', by: { kind: 'human', id: 'u' }, kind: 'rejected', reason: 'r' })],
    ['LearningDecisions', () => ports.decisions.resolutionOf(WS, 'd')],
    ['KnowledgeIndex', () => ports.index.reindex({ workspaceId: WS, entryId: 'e', versionId: 'v' })],
    ['Executions', () => ports.executions.describe(WS, 'exe_1')],
    ['SecretScreen', () => ports.secrets.screen({ statement: 'x' })],
    ['Principals', () => ports.principals.kindOf(WS, 'u_1')],
    ['Audit', () => ports.audit.record({ workspaceId: WS, actorId: 'u', action: 'create', targetType: 't', outcome: 'success' })],
    ['ApprovalAttestations', () => ports.attestations.contribute({} as never)],
  ] as const)('%s throws GovernanceSeamUnboundError naming itself', async (name, call) => {
    const err = await refusal(call as () => Promise<unknown>);
    expect(err.message).toContain(name);
    expect(err.code).toBe('governance_seam_unbound');
  });

  it('ReaderAccess withholds — unreadable is the safe reading (FR-LRN-016)', async () => {
    await expect(ports.readerAccess.canRead({ workspaceId: WS, userId: 'u_1' }, { type: 'project', id: 'p1' })).resolves.toBe(false);
  });

  it('LearningPolicySource answers no policy — so no categories, so every submission is refused (FR-LRN-003)', async () => {
    await expect(ports.policy.current(WS)).resolves.toBeNull();
  });

  it('KnowledgeAdmission absent excludes every knowledge candidate with permission', async () => {
    const verdicts = await unboundAdmission.admit(
      [
        { sourceId: 'e1', sourceVersion: 'v1' },
        { sourceId: 'e2', sourceVersion: 'v2' },
      ],
      { workspaceId: WS, projectId: 'p1' },
    );
    expect(verdicts).toEqual([
      { admitted: false, reason: 'permission', detail: 'admission port unbound' },
      { admitted: false, reason: 'permission', detail: 'admission port unbound' },
    ]);
  });

  it('none answers permissively — nothing returns a resolution, a verified citation or an admission', async () => {
    const answers = await Promise.allSettled([
      ports.evidence.resolve(WS, ['ev_1']),
      ports.decisions.resolutionOf(WS, 'd'),
      ports.principals.kindOf(WS, 'u'),
      ports.experts.forExecution(WS, 'exe'),
    ]);
    expect(answers.every((a) => a.status === 'rejected')).toBe(true);
  });
});
