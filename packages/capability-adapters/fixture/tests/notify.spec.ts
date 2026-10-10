/**
 * `T2187` (EPIC-039, `US6`, `FR-HUB-060`) — `fixture-notify` passes the shared
 * conformance suite (`T2123`) including CC-10, records each delivery, honours
 * the idempotency key (one delivery per key), and fails on demand with a
 * provider reason.
 *
 * Written to FAIL before `T2188`.
 */
import { capabilityConformanceSuite } from '@pmi/capability-contract/conformance';
import { createCredentialHandle, type AdapterContext, type CapabilityAdapter } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { FixtureNotifyAdapter } from '../src/index.js';

const SECRET = 'pmi-canary-66666666-7777-8888-9999-000000000000';

function context(_a: CapabilityAdapter, binding: Record<string, unknown> = {}): AdapterContext {
  return {
    workspaceId: 'ws',
    projectId: 'pr',
    binding,
    credential: createCredentialHandle(SECRET, 'fixture-token'),
    scope: { requested: { access: 'write', resources: ['notification.send'] }, granted: ['fixture:send'], narrowing: 'exact' },
    signal: new AbortController().signal,
    timeoutMs: 1000,
  };
}

const INPUT = { recipients: [{ address: 'reviewer@example.test' }], subject: 'Build finished', body: { text: 'The build for abc finished.' }, idempotencyKey: 'notif-1' };

capabilityConformanceSuite('fixture-notify', {
  capability: 'SendNotification',
  adapter: () => new FixtureNotifyAdapter(),
  context: (a) => context(a),
  validInput: () => ({ ...INPUT }),
  inject: (a, scenario) => (a as FixtureNotifyAdapter).inject(scenario),
  supports: ['throttled', 'credential-rejected', 'unhealthy', 'provider-error'],
  credentialSecret: SECRET,
  idempotencyKeysSeen: (a) => (a as FixtureNotifyAdapter).deliveries.map((d) => d.idempotencyKey),
});

describe('T2187 · fixture-notify', () => {
  const call = (a: FixtureNotifyAdapter, input: unknown = INPUT, binding: Record<string, unknown> = {}) => a.invoke({ ...context(a, binding), capability: 'SendNotification', contractVersion: '1.0', input });

  it('records a delivery with its recipients, subject and key, and answers delivered with a message id', async () => {
    const a = new FixtureNotifyAdapter();
    const r = await call(a);
    expect(r).toMatchObject({ ok: true, output: { delivered: true } });
    expect(a.deliveries).toEqual([expect.objectContaining({ idempotencyKey: 'notif-1', recipients: ['reviewer@example.test'], subject: 'Build finished' })]);
    expect((r as { output: { providerMessageId: string } }).output.providerMessageId).toMatch(/^fixture-msg-/);
  });

  it('honours the idempotency key: the same key delivers once and answers the same message id', async () => {
    const a = new FixtureNotifyAdapter();
    const first = await call(a);
    const second = await call(a);
    expect(a.deliveries).toHaveLength(1);
    expect(second).toEqual(first);
    await call(a, { ...INPUT, idempotencyKey: 'notif-2' });
    expect(a.deliveries).toHaveLength(2);
  });

  it('fails on demand with a provider reason, and records nothing', async () => {
    const a = new FixtureNotifyAdapter();
    const r = await call(a, INPUT, { script: { invoke: 'provider-error' } });
    expect(r).toMatchObject({ ok: false, errorCategory: 'provider-unavailable' });
    expect((r as { message: string }).message.length).toBeGreaterThan(0);
    expect(a.deliveries).toEqual([]);
  });

  it('declares SendNotification at major 1, a write scope, and no credential requirement', () => {
    const d = new FixtureNotifyAdapter().descriptor;
    expect(d).toMatchObject({ key: 'fixture-notify', provider: 'fixture', credentialRequired: false });
    expect(d.implements).toEqual([{ capability: 'SendNotification', majors: [1] }]);
    expect(d.scopeMapping['notification.send']).toEqual(['fixture:send']);
  });

  it('never echoes the credential', async () => {
    const a = new FixtureNotifyAdapter();
    const r = await call(a, INPUT, { script: { invoke: 'credential-rejected' } });
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });
});
