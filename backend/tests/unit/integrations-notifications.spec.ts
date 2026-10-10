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
