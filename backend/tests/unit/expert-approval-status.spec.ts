/**
 * `T1921` (EPIC-047) — a version's status is read, never remembered.
 *
 * `R-047-5`, `FR-EXP-005`. `EPIC-031` offers no callback, so whatever this
 * module last saw could be stale. A version is `approved` exactly while its
 * decision says so — read again every time it matters.
 */
import { describe, expect, it } from 'vitest';
import { effectiveVersion, statusOf } from '../../src/modules/experts/approval.js';
import { refusingContractApprovals } from '../../src/modules/experts/experts.tokens.js';
import { recordingApprovals, version } from '../helpers/expert-fixtures.js';

describe('T1921 · derived approval status', () => {
  it('no decision is a draft — and reading a draft needs no decision engine', async () => {
    await expect(statusOf(version(), refusingContractApprovals())).resolves.toBe('draft');
  });

  it('a pending decision is submitted; approved is approved; refused is refused', async () => {
    const approvals = recordingApprovals();
    approvals.resolve('d_p', 'pending');
    approvals.resolve('d_a', 'approved');
    approvals.resolve('d_r', 'refused');
    expect(await statusOf(version({ decisionId: 'd_p' }), approvals)).toBe('submitted');
    expect(await statusOf(version({ decisionId: 'd_a' }), approvals)).toBe('approved');
    expect(await statusOf(version({ decisionId: 'd_r' }), approvals)).toBe('refused');
  });

  it('a decision that changes after a read is read as it now stands', async () => {
    const approvals = recordingApprovals();
    approvals.resolve('d_1', 'approved');
    const v = version({ decisionId: 'd_1' });
    expect(await statusOf(v, approvals)).toBe('approved');
    approvals.resolve('d_1', 'refused');
    expect(await statusOf(v, approvals)).toBe('refused');
  });

  it('the effective version is the highest approved, not the newest', async () => {
    const approvals = recordingApprovals();
    approvals.resolve('d_1', 'approved');
    approvals.resolve('d_2', 'approved');
    approvals.resolve('d_3', 'pending');
    const versions = [
      version({ id: 'cv_1', version: 1, decisionId: 'd_1' }),
      version({ id: 'cv_2', version: 2, decisionId: 'd_2' }),
      version({ id: 'cv_3', version: 3, decisionId: 'd_3' }),
      version({ id: 'cv_4', version: 4 }),
    ];
    expect((await effectiveVersion(versions, approvals))?.version).toBe(2);
  });

  it('no approved version means no effective version', async () => {
    expect(await effectiveVersion([version()], recordingApprovals())).toBeNull();
  });
});
