/**
 * `T2190` (EPIC-039, `R-039-9`) — `resend-email`: `SendNotification` over the
 * Resend API, one project binding (`from`) and one key.
 *
 * A Resend key's permission is fixed when it is created (`full_access` or
 * `sending_access`), so the kind narrows **at issue**: the health probe
 * establishes which one the project holds (`R-039-10`, `FR-HUB-034`).
 */
import type { AdapterDescriptor } from '@pmi/capability-contract';

export const RESEND_ADAPTER_VERSION = '0.1.0';
export const RESEND_API = 'https://api.resend.com';

export const RESEND_DESCRIPTOR: AdapterDescriptor = Object.freeze({
  key: 'resend-email',
  name: 'Resend (email)',
  provider: 'resend',
  transport: 'native-api',
  version: RESEND_ADAPTER_VERSION,
  implements: [{ capability: 'SendNotification', majors: [1] }],
  credentialKinds: [{ kind: 'resend-api-key', narrowing: 'at-issue' }],
  credentialRequired: true,
  bindingSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['from'],
    properties: {
      /** `Name <address>` or a bare address on a verified domain. */
      from: { type: 'string', minLength: 3, maxLength: 320 },
      /** A recorded replay in tests. */
      apiBaseUrl: { type: 'string', pattern: '^https?://[^\\s]+$', maxLength: 300 },
    },
  },
  scopeMapping: { 'notification.send': ['emails:send'] },
}) as AdapterDescriptor;
