/**
 * `T2192` (EPIC-039, `BR-0120`, `US6`) — notification dispatch: a governed
 * event that needs a human requests `SendNotification` **in process as
 * `notification-dispatch`** (a caller a session cannot claim over HTTP —
 * analysis U1), and exactly one `notification_deliveries` row records it.
 *
 * - The delivery id is minted first and sent as the provider idempotency key
 *   (`R-039-13`), so a retried provider call delivers once.
 * - Content carrying credential material is refused by `CapabilityRequests`
 *   (`credential-material-in-content`) before any provider is called — never
 *   redacted and sent (`FR-HUB-045`).
 * - A state-changing capability over a key that cannot be narrowed is refused
 *   by the resolver's scope rule (`FR-HUB-034`).
 * - A provider failure is recorded with its category; the cause is only ever
 *   read — the delivery row is the only write (`US6` AS2).
 */
import { randomUUID } from 'node:crypto';
import { sanitiseText } from '@pmi/capability-contract';
import { ValidationFailedError } from '../../../core/errors.js';
import type { IntegrationsStore } from '../integrations.store.js';
import type { CapabilityRequests } from '../requests/capability-requests.service.js';

export const NOTIFICATION_CALLER = 'notification-dispatch';

export interface NotificationRequest {
  /** The governed event that caused it — `{ kind, ref }`. */
  readonly cause: Readonly<{ kind: string; ref: string }>;
  /** Platform user ids are what is recorded; the address goes only to the adapter call. */
  readonly recipients: readonly { readonly userId?: string; readonly address: string }[];
  readonly subject: string;
  readonly body: { readonly text: string };
}

export interface NotificationOutcome {
  readonly deliveryId: string;
  readonly resolutionId: string;
  readonly outcome: 'delivered' | 'failed' | 'refused';
  readonly reason?: string;
}

export interface NotificationDeps {
  readonly store: IntegrationsStore;
  readonly requests: CapabilityRequests;
}

export class NotificationService {
  constructor(private readonly deps: NotificationDeps) {}

  async notify(actor: { workspaceId: string; userId: string }, projectId: string, message: NotificationRequest): Promise<NotificationOutcome> {
    if (message.cause === null || typeof message.cause !== 'object' || typeof message.cause.kind !== 'string' || typeof message.cause.ref !== 'string') {
      throw new ValidationFailedError('A notification names the governed event that caused it: cause { kind, ref }.', { fields: [{ field: 'cause', reason: '{ kind, ref }' }] });
    }
    const deliveryId = randomUUID();
    const response = await this.deps.requests.request(
      actor,
      projectId,
      {
        capability: 'SendNotification',
        major: 1,
        caller: NOTIFICATION_CALLER,
        input: { recipients: message.recipients.map((r) => ({ address: r.address })), subject: message.subject, body: { text: message.body.text }, idempotencyKey: deliveryId },
      },
      { http: false },
    );
    const recipients = message.recipients.map((r) => r.userId ?? r.address);
    const cause = { kind: message.cause.kind, ref: message.cause.ref };
    const base = { id: deliveryId, workspaceId: actor.workspaceId, projectId, cause, recipients, resolutionId: response.resolutionId };

    if (response.outcome === 'refused') {
      const reason = response.refusal?.code ?? 'refused';
      await this.deps.store.appendDelivery({ ...base, outcome: 'refused', providerMessageId: null, failureReason: reason });
      return { deliveryId, resolutionId: response.resolutionId, outcome: 'refused', reason };
    }
    if (response.invocation?.outcome !== 'succeeded') {
      const category = response.invocation?.errorCategory ?? 'adapter-fault';
      await this.deps.store.appendDelivery({ ...base, outcome: 'failed', providerMessageId: null, failureReason: sanitiseText(`${category}${response.invocation?.retryAfterSeconds !== undefined ? ` (retry after ${response.invocation.retryAfterSeconds} s)` : ''}`) });
      return { deliveryId, resolutionId: response.resolutionId, outcome: 'failed', reason: category };
    }
    const result = (response.result ?? {}) as { delivered?: boolean; providerMessageId?: string };
    await this.deps.store.appendDelivery({ ...base, outcome: 'delivered', providerMessageId: result.providerMessageId ?? null, failureReason: null });
    return { deliveryId, resolutionId: response.resolutionId, outcome: 'delivered' };
  }
}
