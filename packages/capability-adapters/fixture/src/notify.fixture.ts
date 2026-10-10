/**
 * `T2188` (EPIC-039, `US6`) — `fixture-notify`: `SendNotification` without a
 * mail provider.
 *
 * Every delivery is recorded (recipients, subject, key — never a credential),
 * and the idempotency key is honoured the way a real provider honours it: the
 * same key delivers once and answers the first message id again (CC-10,
 * `R-039-13`). Failures are scripted through the binding like every fixture.
 */
import { createHash } from 'node:crypto';
import type { AdapterCall, AdapterDescriptor, AdapterResult } from '@pmi/capability-contract';
import { FixtureAdapter, fixtureDescriptor, invalidInput, type FixtureScript } from './shared.js';

export interface FixtureDelivery {
  readonly idempotencyKey: string;
  readonly recipients: readonly string[];
  readonly subject: string;
  readonly providerMessageId: string;
  readonly acceptedAt: string;
}

export class FixtureNotifyAdapter extends FixtureAdapter {
  readonly descriptor: AdapterDescriptor = fixtureDescriptor({
    key: 'fixture-notify',
    name: 'Fixture notifications',
    implements: [{ capability: 'SendNotification', majors: [1] }],
    scopeMapping: { 'notification.send': ['fixture:send'] },
  });

  readonly deliveries: FixtureDelivery[] = [];

  protected async serve(call: AdapterCall, _script: FixtureScript): Promise<AdapterResult> {
    const input = call.input as { recipients?: unknown; subject?: unknown; body?: unknown; idempotencyKey?: unknown } | null;
    if (input === null || typeof input !== 'object' || !Array.isArray(input.recipients) || typeof input.subject !== 'string' || typeof input.idempotencyKey !== 'string') {
      return invalidInput('SendNotification needs recipients, a subject, a body and an idempotency key');
    }
    const key = input.idempotencyKey;
    const seen = this.deliveries.find((d) => d.idempotencyKey === key);
    if (seen !== undefined) return { ok: true, output: { delivered: true, providerMessageId: seen.providerMessageId, acceptedAt: seen.acceptedAt }, providerRequestId: seen.providerMessageId };
    const recipients = (input.recipients as unknown[]).map((r) => (r !== null && typeof r === 'object' ? String((r as { address?: unknown }).address ?? '') : ''));
    const providerMessageId = `fixture-msg-${createHash('sha256').update(`${call.projectId}:${key}`).digest('hex').slice(0, 16)}`;
    const delivery: FixtureDelivery = { idempotencyKey: key, recipients, subject: input.subject, providerMessageId, acceptedAt: new Date().toISOString() };
    this.deliveries.push(delivery);
    return { ok: true, output: { delivered: true, providerMessageId, acceptedAt: delivery.acceptedAt }, providerRequestId: providerMessageId };
  }
}
