/**
 * `T2190` (EPIC-039, `US6`) — `SendNotification` → `POST /emails`, with the
 * contract's `idempotencyKey` sent as Resend's `Idempotency-Key` (CC-10): a
 * retried request is delivered once.
 */
import type { AdapterResult, FetchLike } from '@pmi/capability-contract';
import { failFor, resendCall } from './http.js';

export interface SendInput {
  readonly recipients: readonly { readonly address: string }[];
  readonly subject: string;
  readonly body: { readonly text: string };
  readonly idempotencyKey: string;
}

export async function send(fetch: FetchLike, base: string, key: string, from: string, input: SendInput, signal: AbortSignal, now: () => Date): Promise<AdapterResult> {
  const res = await resendCall(fetch, `${base}/emails`, {
    method: 'POST',
    key,
    idempotencyKey: input.idempotencyKey,
    body: { from, to: input.recipients.map((r) => r.address), subject: input.subject, text: input.body.text },
    signal,
  });
  if (res.status < 200 || res.status >= 300) failFor(res);
  const id = typeof res.body['id'] === 'string' ? (res.body['id'] as string) : undefined;
  return { ok: true, output: { delivered: true, ...(id !== undefined ? { providerMessageId: id } : {}), acceptedAt: now().toISOString() }, ...(id !== undefined ? { providerRequestId: id } : {}) };
}
