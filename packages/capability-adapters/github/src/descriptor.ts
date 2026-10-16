/**
 * `T2157` (EPIC-039, `R-039-9`) — `github-rest`: one adapter, three reads, one
 * project binding and one credential.
 */
import type { AdapterDescriptor } from '@pmi/capability-contract';

export const GITHUB_ADAPTER_VERSION = '0.1.0';

export const GITHUB_DESCRIPTOR: AdapterDescriptor = Object.freeze({
  key: 'github-rest',
  name: 'GitHub (REST)',
  provider: 'github',
  transport: 'native-api',
  version: GITHUB_ADAPTER_VERSION,
  implements: [
    { capability: 'ReadRepository', majors: [1] },
    { capability: 'ReadBuildStatus', majors: [1] },
    { capability: 'ReadTestResults', majors: [1] },
  ],
  credentialKinds: [
    { kind: 'github-app-installation', narrowing: 'per-request' },
    { kind: 'github-token', narrowing: 'none' },
  ],
  credentialRequired: true,
  bindingSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['repository'],
    properties: {
      repository: { type: 'string', pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$', maxLength: 200 },
      artifactName: { type: 'string', minLength: 1, maxLength: 100 },
      resultFormat: { type: 'string', enum: ['junit-xml'] },
      /** GitHub Enterprise Server, or a recorded replay in tests. */
      apiBaseUrl: { type: 'string', pattern: '^https?://[^\\s]+$', maxLength: 300 },
    },
  },
  scopeMapping: {
    'repository.contents': ['contents:read'],
    'ci.checks': ['checks:read', 'statuses:read'],
    'ci.artifacts': ['actions:read'],
  },
}) as AdapterDescriptor;
