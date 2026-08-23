/**
 * T947 — an unauthorized transition is refused, and the refusal names what was
 * missing. `FR-GEL-011`, `FR-GEL-014`.
 *
 * Two assertions, and the second is the one that decays.
 *
 *   1. The attempt is **refused**. Easy, and easy to keep true.
 *   2. The refusal **names the authority that was required**. This is what
 *      makes a 403 actionable instead of a wall — and it is the first thing to
 *      go when someone tidies an error message, because nothing else notices.
 *
 * A refusal here is a **result, not a throw** (`FR-GEL-014`): it gets recorded,
 * and a caller's `catch` cannot swallow it.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { evaluateAuthority } from '../../src/modules/loop/authority.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'authority-type',
    stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Analyze', to: 'Decide', requiredGates: [], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

/** Who may perform which transition — the tenant half of the configuration. */
const AUTHORITIES = {
  'Event->Analyze': ['analyst', 'lead'],
  'Analyze->Decide': ['lead'],
};

describe('T947 · an authorized actor passes', () => {
  it('permits an actor holding the required authority', () => {
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: AUTHORITIES,
      from: 'Analyze',
      to: 'Decide',
      actorAuthorities: ['lead'],
    });
    expect(verdict.permitted).toBe(true);
    if (!verdict.permitted) throw new Error('unreachable');
    expect(verdict.basis).toBe('lead');
  });

  it('records WHICH authority permitted it, not merely that one did', () => {
    // `authorityBasis` is a required column on every transition record. An actor
    // holding three roles must leave a record saying which one was used, or
    // "who could have done this?" has no answer six months later.
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: AUTHORITIES,
      from: 'Event',
      to: 'Analyze',
      actorAuthorities: ['lead', 'analyst'],
    });
    expect(verdict.permitted).toBe(true);
    if (!verdict.permitted) throw new Error('unreachable');
    expect(AUTHORITIES['Event->Analyze']).toContain(verdict.basis);
  });
});

describe('FR-GEL-011 · an unauthorized actor is refused, by name', () => {
  it('refuses an actor holding none of the required authorities', () => {
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: AUTHORITIES,
      from: 'Analyze',
      to: 'Decide',
      actorAuthorities: ['analyst'],
    });
    expect(verdict.permitted).toBe(false);
  });

  it('names the authority that was required', () => {
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: AUTHORITIES,
      from: 'Analyze',
      to: 'Decide',
      actorAuthorities: ['analyst'],
    });
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted) throw new Error('unreachable');
    expect(verdict.reason).toMatch(/lead/);
    // And what the actor actually had, so the operator can see the gap rather
    // than infer it.
    expect(verdict.reason).toMatch(/analyst/);
  });

  it('refuses an actor with no authorities at all', () => {
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: AUTHORITIES,
      from: 'Event',
      to: 'Analyze',
      actorAuthorities: [],
    });
    expect(verdict.permitted).toBe(false);
  });
});

describe('a transition the configuration does not declare is refused before authority', () => {
  it('refuses an undeclared transition even for an actor holding everything', () => {
    // Order matters. Asking "may this actor do it?" about a transition that
    // does not exist invites the answer "yes" from a permissive authority map,
    // which would let an object jump Analyze entirely.
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: { 'Event->Outcome': ['lead'] },
      from: 'Event',
      to: 'Outcome',
      actorAuthorities: ['lead'],
    });
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted) throw new Error('unreachable');
    expect(verdict.reason).toMatch(/not declared/i);
  });
});

describe('FR-GEL-062 · a transition with no authority configured is refused, not permitted', () => {
  it('refuses when the authority map says nothing about this transition', () => {
    // The default that would be catastrophic: "no rule configured" reading as
    // "anyone may". An unconfigured transition is one nobody has authorised,
    // which is the same answer as a refusal and must produce it.
    const verdict = evaluateAuthority({
      config: CONFIG,
      authorities: {},
      from: 'Event',
      to: 'Analyze',
      actorAuthorities: ['lead'],
    });
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted) throw new Error('unreachable');
    expect(verdict.reason).toMatch(/no authority is configured/i);
  });
});
