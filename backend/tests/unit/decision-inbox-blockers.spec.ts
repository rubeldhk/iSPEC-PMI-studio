/**
 * T754 — a blocked entry names what would unblock it. `FR-DPE-025`, `FR-DPE-021`.
 *
 * The missing evidence, the pending approver or the refusing policy — **named**,
 * never a generic "not ready". And named from the decision alone, so the Inbox
 * shows it without opening the artifact (`FR-DPE-021`, `BR-0192`).
 */
import { describe, expect, it } from 'vitest';
import { inboxFor } from '../../src/modules/decision/inbox.projection.js';
import { PLATFORM_DEFAULT_POLICY } from '../../src/modules/decision/policy.loader.js';
import { engine, gates, request, rules } from '../helpers/decision-engine.js';

const policy = { ...PLATFORM_DEFAULT_POLICY, version: 2, approvedBy: 'owner' };
const bob = { kind: 'human' as const, id: 'u_bob' };

async function blockedEntry(setup: Parameters<typeof engine>[0], overrides: Parameters<typeof request>[0]) {
  const harness = engine(setup);
  await harness.engine.decide(request({ requestedBy: 'u_bob', actor: bob, ...overrides }));
  const [entry] = inboxFor(bob, await harness.repository.list('ws_dpe'), policy);
  return entry!;
}

describe('T754 · FR-DPE-025 — what would unblock it, named', () => {
  it('names the unsatisfied gate and what its provider said', async () => {
    const entry = await blockedEntry(
      { steering: rules([{ actionPattern: 'deploy', band: 'medium' }]), gates: gates({ 'evidence:tests-pass': 'refused' }) },
      { requiredGates: ['evidence:tests-pass'] },
    );
    expect(entry.kind).toBe('blocked');
    expect(entry.blockedBy).toMatch(/evidence:tests-pass/);
  });

  it('names an unevaluated gate as unevaluated, not as missing', async () => {
    const entry = await blockedEntry(
      { steering: rules([{ actionPattern: 'deploy', band: 'medium' }]), gates: null },
      { requiredGates: ['g1'] },
    );
    expect(entry.blockedBy).toMatch(/g1.*no GateProvider/);
  });

  it('names the refusing policy when policy, not a gate, refused', async () => {
    const entry = await blockedEntry(
      { steering: rules([{ actionPattern: 'deploy', band: 'medium' }]) },
      { requiredGates: [] },
    );
    expect(entry.blockedBy).toMatch(/policy v2/);
  });

  it('names the approver a pending approval awaits', async () => {
    const harness = engine();
    await harness.engine.decide(request({ actionType: 'release.promote', requestedBy: 'u_bob', actor: bob }));
    const [entry] = inboxFor({ kind: 'human', id: 'u_carol' }, await harness.repository.list('ws_dpe'), policy);
    expect(entry!.blockedBy).toMatch(/authorized human other than u_bob/);
  });

  it('never reports a bare not-ready', async () => {
    const entry = await blockedEntry(
      { steering: rules([{ actionPattern: 'deploy', band: 'medium' }]), gates: gates({ g1: 'refused' }) },
      { requiredGates: ['g1'] },
    );
    expect(entry.blockedBy).not.toMatch(/^not ready$/i);
    expect(entry.blockedBy.length).toBeGreaterThan(10);
  });
});
