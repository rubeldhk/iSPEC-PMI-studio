/**
 * `T2191` (EPIC-039, `US6`, `FR-HUB-034`, `FR-HUB-045`) — notification dispatch.
 *
 * - subject or body carrying credential material is refused
 *   `credential-material-in-content` — never redacted and sent;
 * - one `notification_deliveries` row per request, its id the provider
 *   idempotency key;
 * - a provider failure records the provider's reason and touches nothing of
 *   the cause (`US6` AS2);
 * - a full-access Resend key is refused by default — `SendNotification`
 *   changes state, so `not-narrowable` follows `refuse` (`R-039-10`).
 *
 * Written to FAIL before `T2192`.
 */
import { readFileSync } from 'node:fs';
import { Replay, type Recording } from '@pmi/capability-contract/replay';
import { describe, expect, it } from 'vitest';
import { createAdapterCatalog } from '../../src/composition/integration-adapters.js';
import { NOTIFICATION_CALLER } from '../../src/modules/integrations/notifications/notification.service.js';
import { OWNER, PROJECT, WS, configure, testHub } from './integrations-hub.fixture.js';

const ACTOR = { workspaceId: WS, userId: OWNER };
const CAUSE = { kind: 'decision-waiting', ref: 'dec_42' };
const MESSAGE = { cause: CAUSE, recipients: [{ userId: 'u_reviewer', address: 'reviewer@example.test' }], subject: 'A decision is waiting', body: { text: 'Decision dec_42 needs you.' } };
const RESEND_BASE = 'https://api.resend.test';
const RECORDINGS = new URL('../../../packages/capability-adapters/resend/tests/recordings/', import.meta.url);
const load = (f: string): Recording => JSON.parse(readFileSync(new URL(f, RECORDINGS), 'utf8')) as Recording;

describe('T2191 · notification dispatch (US6)', () => {
  it('delivers once through the configured adapter, as notification-dispatch, and records one row whose id is the idempotency key', async () => {
    const hub = testHub();
    await configure(hub, 'SendNotification', ['fixture-notify']);
    const out = await hub.notifications.notify(ACTOR, PROJECT, MESSAGE);
    expect(out).toMatchObject({ outcome: 'delivered' });
    const rows = await hub.store.listDeliveries(WS, PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: out.deliveryId, outcome: 'delivered', cause: CAUSE, recipients: ['u_reviewer'], failureReason: null });
    expect(rows[0]!.providerMessageId).toMatch(/^fixture-msg-/);
    const [resolution] = await hub.store.listResolutions(WS, { projectId: PROJECT, limit: 5 });
    expect(resolution).toMatchObject({ id: rows[0]!.resolutionId, caller: NOTIFICATION_CALLER, capability: 'SendNotification', outcome: 'resolved' });
    expect(NOTIFICATION_CALLER).toBe('notification-dispatch');
    const notify = hub.catalog.adapter('fixture-notify') as unknown as { deliveries: { idempotencyKey: string }[] };
    expect(notify.deliveries.map((d) => d.idempotencyKey)).toEqual([out.deliveryId]);
  });

  it('subject or body with credential material is refused credential-material-in-content, never sent', async () => {
    for (const leak of [{ subject: 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789' }, { body: { text: 'use pmi-canary-11111111-2222-3333-4444-555555555555 please' } }]) {
      const hub = testHub();
      await configure(hub, 'SendNotification', ['fixture-notify']);
      const out = await hub.notifications.notify(ACTOR, PROJECT, { ...MESSAGE, ...leak });
      expect(out).toMatchObject({ outcome: 'refused', reason: 'credential-material-in-content' });
      const notify = hub.catalog.adapter('fixture-notify') as unknown as { deliveries: unknown[] };
      expect(notify.deliveries).toEqual([]);
      const [row] = await hub.store.listDeliveries(WS, PROJECT);
      expect(row).toMatchObject({ outcome: 'refused', failureReason: 'credential-material-in-content', providerMessageId: null });
      expect(JSON.stringify(row)).not.toMatch(/ghp_|pmi-canary-/);
    }
  });

  it('a provider failure records the reason; the cause is untouched (US6 AS2)', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-notify');
    await hub.configuration.put(ACTOR, PROJECT, 'SendNotification', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'provider-error' } } }] });
    await hub.health.checkNow(WS, PROJECT, e);
    const cause = { ...CAUSE };
    const out = await hub.notifications.notify(ACTOR, PROJECT, { ...MESSAGE, cause });
    expect(out).toMatchObject({ outcome: 'failed', reason: 'provider-unavailable' });
    expect(cause).toEqual(CAUSE);
    const [row] = await hub.store.listDeliveries(WS, PROJECT);
    expect(row).toMatchObject({ outcome: 'failed', failureReason: expect.stringContaining('provider-unavailable') });
  });

  it('nothing configured: refused with the resolver code, one row, nothing delivered', async () => {
    const hub = testHub();
    const out = await hub.notifications.notify(ACTOR, PROJECT, MESSAGE);
    expect(out.outcome).toBe('refused');
    expect(await hub.store.listDeliveries(WS, PROJECT)).toHaveLength(1);
  });

  it('a full-access Resend key is refused by default (scope-not-narrowable); a sending-only key delivers', async () => {
    for (const [file, expected] of [
      ['2026-10-10.resend-email.full-access.json', { outcome: 'refused', reason: 'scope-not-narrowable' }],
      ['2026-10-10.resend-email.json', { outcome: 'delivered' }],
    ] as const) {
      const replay = new Replay([load('2026-10-10.resend-email.json'), load(file)]); // a later recording overrides an earlier one
      const catalog = createAdapterCatalog({ fetch: replay.fetch(RESEND_BASE) as typeof fetch });
      const hub = testHub({ catalog });
      const e = await hub.entry('resend-email');
      await hub.configuration.put(ACTOR, PROJECT, 'SendNotification', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { from: 'PMI Studio <notify@acme.test>', apiBaseUrl: RESEND_BASE } }] });
      await hub.credentials.set(ACTOR, PROJECT, e.id, { kind: 'resend-api-key', value: 're_test_0123456789abcdefghijklmnopqrstuv' });
      const out = await hub.notifications.notify(ACTOR, PROJECT, MESSAGE);
      expect(out, file).toMatchObject(expected);
      const sent = replay.seen.filter((r) => r.method === 'POST' && r.path === '/emails');
      expect(sent, file).toHaveLength(expected.outcome === 'delivered' ? 1 : 0);
      if (expected.outcome === 'delivered') expect(sent[0]!.headers['idempotency-key']).toBe(out.deliveryId);
    }
  });
});

/**
 * `T2626` (convergence, `US6` AS1–AS2) — one delivery row for EVERY
 * `SendNotification` request, whichever caller asked: a Room asking through
 * the route records its delivery as `notification-dispatch` does. A provider
 * failure records its category AND the provider's message, sanitised.
 */
describe('T2626 · every SendNotification request records its delivery', () => {
  const ROUTE_INPUT = { recipients: [{ address: 'reviewer@example.test' }], subject: 'A change needs review', body: { text: 'Please look.' }, idempotencyKey: 'room-change-ch_7-review' };

  it('a room:* caller through the route records one delivered row, its cause the capability request', async () => {
    const hub = testHub();
    await configure(hub, 'SendNotification', ['fixture-notify']);
    const res = await hub.requests.request(ACTOR, PROJECT, { capability: 'SendNotification', major: 1, caller: 'room:change', input: ROUTE_INPUT }, { http: true });
    expect(res).toMatchObject({ outcome: 'resolved', invocation: { outcome: 'succeeded' } });
    const rows = await hub.store.listDeliveries(WS, PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: 'delivered', resolutionId: res.resolutionId, cause: { kind: 'capability-request', ref: 'room:change' }, recipients: ['reviewer@example.test'], failureReason: null });
    expect(rows[0]!.providerMessageId).toMatch(/^fixture-msg-/);
  });

  it('a refused route request records one refused row with the refusal code', async () => {
    const hub = testHub();
    const res = await hub.requests.request(ACTOR, PROJECT, { capability: 'SendNotification', major: 1, caller: 'room:defect', input: ROUTE_INPUT }, { http: true });
    expect(res.outcome).toBe('refused');
    const rows = await hub.store.listDeliveries(WS, PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: 'refused', resolutionId: res.resolutionId, failureReason: res.refusal!.code, providerMessageId: null });
  });

  it('a read capability records no delivery', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    await hub.requests.request(ACTOR, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: 'a'.repeat(40) } }, { http: true });
    expect(await hub.store.listDeliveries(WS, PROJECT)).toEqual([]);
  });

  it('notify() still records exactly one row (not two) now that the request records it', async () => {
    const hub = testHub();
    await configure(hub, 'SendNotification', ['fixture-notify']);
    const out = await hub.notifications.notify(ACTOR, PROJECT, MESSAGE);
    const rows = await hub.store.listDeliveries(WS, PROJECT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: out.deliveryId, cause: CAUSE, recipients: ['u_reviewer'] });
  });

  it('a provider failure records the category and the provider message, sanitised', async () => {
    const hub = testHub();
    const e = await hub.entry('fixture-notify');
    await hub.configuration.put(ACTOR, PROJECT, 'SendNotification', { adapters: [{ registryEntryId: e.id, preference: 1, binding: { script: { invoke: 'provider-error' } } }] });
    await hub.health.checkNow(WS, PROJECT, e);
    await hub.notifications.notify(ACTOR, PROJECT, MESSAGE);
    const [row] = await hub.store.listDeliveries(WS, PROJECT);
    expect(row!.failureReason).toBe('provider-unavailable: fixture: the provider answered 500');
  });
});
