/**
 * T921 — the five ports, written to fail first.
 *
 * Two of these assertions are the Epic's load-bearing ones and neither is about
 * behaviour:
 *
 *   - `GateOutcome.result` has **four** members and no default, so
 *     `FR-GEL-021`'s *"a silent pass MUST NOT be reachable"* is a compile error
 *     rather than a review comment;
 *   - `AuditSink.record` takes a **non-optional** transaction handle, unlike the
 *     existing `AuditService.record(input, tx?)`, so the non-atomic call
 *     `FR-GEL-041` forbids cannot be written.
 *
 * The `@ts-expect-error` blocks are the second assertion's real test. They fail
 * the build in the direction that matters: if the type ever stops rejecting the
 * bad call, `tsc` reports the directive as unused and `pnpm typecheck` goes red.
 * A runtime test cannot see any of this — an interface has no runtime value —
 * which is why `packages/execution-contract` set this precedent.
 */
import { describe, expect, it } from 'vitest';
import {
  GATE_RESULTS,
  isGateResult,
  type AuditSink,
  type GateProvider,
  type PolicyProvider,
  type StageHandler,
  type EvidenceProvider,
  type TransactionHandle,
  type TransitionAuditEntry,
} from '../src/ports.js';

describe('FR-GEL-021 · a gate result has four members and no fifth', () => {
  it('names exactly satisfied, refused, exception and violation', () => {
    expect(GATE_RESULTS).toEqual(['satisfied', 'refused', 'exception', 'violation']);
  });

  it('has no fifth member — a skipped gate is one of these or it is nothing', () => {
    expect(GATE_RESULTS).toHaveLength(4);
    expect(Object.isFrozen(GATE_RESULTS)).toBe(true);
  });

  it('offers no default and no "skipped" spelling', () => {
    // BR-0060: a skipped gate is a recorded violation or an explicit exception,
    // never a silent pass. The vocabulary is where that starts — if `skipped`
    // or `not-applicable` existed here, every later guard would be optional.
    expect(GATE_RESULTS).not.toContain('skipped');
    expect(GATE_RESULTS).not.toContain('passed');
    expect(GATE_RESULTS).not.toContain('not-applicable');
    expect(isGateResult('skipped')).toBe(false);
    expect(isGateResult('satisfied')).toBe(true);
  });
});

describe('FR-GEL-041 · the audit handle is not optional', () => {
  it('accepts an implementation that requires a transaction', () => {
    const sink: AuditSink = {
      async record(_entry: TransitionAuditEntry, _tx: TransactionHandle): Promise<void> {},
    };
    expect(typeof sink.record).toBe('function');
    // Two declared parameters, not one — the arity the interface forces.
    expect(sink.record.length).toBe(2);
  });

  it('rejects a call that omits the transaction handle', () => {
    const sink: AuditSink = {
      async record(_entry: TransitionAuditEntry, _tx: TransactionHandle): Promise<void> {},
    };
    const entry = {} as TransitionAuditEntry;
    // @ts-expect-error — FR-GEL-041: the transition and its audit record are
    // atomic, so a call with no transaction is the non-atomic write the
    // requirement forbids. If this ever compiles, tsc fails on the unused
    // directive and this test has done its job.
    void (() => sink.record(entry));
    expect(true).toBe(true);
  });
});

describe('the ports declare seams and fill none of them', () => {
  it('shapes a stage handler around one stage', () => {
    const handler: StageHandler = {
      stage: 'Decide',
      async enter() {
        return { ok: true } as never;
      },
    };
    expect(handler.stage).toBe('Decide');
  });

  it('types the four provider seams the loop does not implement', () => {
    // Present as type-level assertions only. `FR-GEL-062` — an absent provider
    // is a load-time refusal, and this package deliberately ships no fallback
    // any consumer could pick up by accident.
    const providers: {
      policy: PolicyProvider | undefined;
      evidence: EvidenceProvider | undefined;
      gate: GateProvider | undefined;
    } = { policy: undefined, evidence: undefined, gate: undefined };
    expect(providers.policy).toBeUndefined();
    expect(providers.evidence).toBeUndefined();
    expect(providers.gate).toBeUndefined();
  });
});
