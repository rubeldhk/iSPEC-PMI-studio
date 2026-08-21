/**
 * T266 — reconciliation clears the mark WITH attribution; a baselined
 * specification is reconciled by FORKING a new draft, never by alteration
 * (FR-ENH-007, FR-011a). Written to FAIL before T267 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryCurrencyStore,
} from '../../../src/modules/specifications/currency.service.js';
import { ReconciliationService } from '../../../src/modules/specifications/reconciliation.service.js';

const WS = 'ws_a';

function build(lifecycleState: string): {
  service: ReconciliationService;
  store: InMemoryCurrencyStore;
  fork: ReturnType<typeof vi.fn>;
} {
  const store = new InMemoryCurrencyStore();
  store.seed('s1', {
    currencyStatus: 'stale',
    staleReason: 'decision adr_1 changed',
    lifecycleState,
  });
  const fork = vi.fn(async () => ({ id: 's1_fork', lifecycleState: 'draft' }));
  return { store, fork, service: new ReconciliationService(store, { fork }) };
}

describe('T266 · reconciliation with attribution', () => {
  it('clears the mark and records who reconciled, and when', async () => {
    const { service, store } = build('draft');
    const at = new Date('2026-08-20T12:00:00Z');
    const out = await service.reconcile(WS, 's1', 'u_reviewer', at);
    expect(out.forked).toBe(false);
    const state = store.stateOf('s1');
    expect(state?.currencyStatus).toBe('current');
    expect(state?.staleReason).toBeNull();
    expect(state?.reconciledById).toBe('u_reviewer');
    expect(state?.reconciledAt).toEqual(at);
  });

  it('a specification that is not stale is refused — nothing to reconcile', async () => {
    const { service, store } = build('draft');
    await service.reconcile(WS, 's1', 'u1');
    await expect(service.reconcile(WS, 's1', 'u1')).rejects.toThrow(/not stale|current/i);
    expect(store.stateOf('s1')?.currencyStatus).toBe('current');
  });

  it('cross-workspace reconciliation is an opaque refusal', async () => {
    const { service } = build('draft');
    await expect(service.reconcile('ws_b', 's1', 'u9')).rejects.toThrow();
  });
});

describe('T266 · a BASELINED specification forks, never alters (FR-011a)', () => {
  it('reconcile on baselined → a new draft via the fork seam; the baseline row is untouched', async () => {
    const { service, store, fork } = build('baselined');
    const out = await service.reconcile(WS, 's1', 'u_reviewer');

    expect(out.forked).toBe(true);
    expect(out.forkedSpecificationId).toBe('s1_fork');
    expect(fork).toHaveBeenCalledWith(WS, 's1', 'u_reviewer');

    // The baseline itself: content AND its staleness record unaltered — the
    // mark stays as history; the fork is the reconciled line.
    const baseline = store.stateOf('s1');
    expect(baseline?.currencyStatus).toBe('stale');
    expect(baseline?.reconciledById).toBeUndefined();
  });
});
