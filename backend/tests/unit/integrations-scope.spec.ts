/**
 * `T2179` (EPIC-039, `FR-HUB-034`, `US4` AS4) — the resolver grants only the
 * contract's required scope, and a credential it cannot narrow follows the
 * configuration: refused by default for a state-changing capability, proceeded
 * and recorded otherwise.
 *
 * Written to FAIL before `T2180`.
 */
import { contractFor, type AdapterDescriptor } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { defaultOnNotNarrowable, grantScope } from '../../src/modules/integrations/resolver/scope.js';

const github = {
  credentialKinds: [
    { kind: 'github-app-installation', narrowing: 'per-request' },
    { kind: 'github-token', narrowing: 'none' },
  ],
  scopeMapping: { 'repository.contents': ['contents:read'], 'ci.checks': ['checks:read', 'statuses:read'], 'ci.artifacts': ['actions:read'] },
} as unknown as AdapterDescriptor;
const resend = { credentialKinds: [{ kind: 'resend-api-key', narrowing: 'at-issue' }], scopeMapping: { 'notification.send': ['emails:send'] } } as unknown as AdapterDescriptor;

describe('T2179 · only the required scope is granted', () => {
  it('ReadBuildStatus gets checks and statuses, nothing of contents or actions', () => {
    const d = grantScope(contractFor('ReadBuildStatus', 1)!, github, 'github-app-installation', null, null);
    expect(d.grant).toEqual({ requested: { access: 'read', resources: ['ci.checks'] }, granted: ['checks:read', 'statuses:read'], narrowing: 'exact' });
    expect(d.proceed).toBe(true);
  });
});

describe('T2179 · narrowing', () => {
  it('per-request → exact; none → not-narrowable; no credential → exact', () => {
    expect(grantScope(contractFor('ReadRepository', 1)!, github, 'github-app-installation', null, null).grant.narrowing).toBe('exact');
    expect(grantScope(contractFor('ReadRepository', 1)!, github, 'github-token', null, null).grant.narrowing).toBe('not-narrowable');
    expect(grantScope(contractFor('ReadRepository', 1)!, github, null, null, null).grant.narrowing).toBe('exact');
  });

  it('at-issue follows what the probe established', () => {
    expect(grantScope(contractFor('SendNotification', 1)!, resend, 'resend-api-key', 'narrowed-at-issue', null).grant.narrowing).toBe('narrowed-at-issue');
    expect(grantScope(contractFor('SendNotification', 1)!, resend, 'resend-api-key', 'not-narrowable', null).grant.narrowing).toBe('not-narrowable');
    expect(grantScope(contractFor('SendNotification', 1)!, resend, 'resend-api-key', null, null).grant.narrowing).toBe('not-narrowable');
  });
});

describe('T2179 · not-narrowable follows onNotNarrowable', () => {
  it('defaults: refuse for a state-changing capability, proceed-and-record otherwise', () => {
    expect(defaultOnNotNarrowable(contractFor('SendNotification', 1)!)).toBe('refuse');
    expect(defaultOnNotNarrowable(contractFor('ReadRepository', 1)!)).toBe('proceed-and-record');
    expect(grantScope(contractFor('SendNotification', 1)!, resend, 'resend-api-key', 'not-narrowable', null).proceed).toBe(false);
    expect(grantScope(contractFor('ReadRepository', 1)!, github, 'github-token', null, null)).toMatchObject({ proceed: true, reason: expect.stringContaining('recording') });
  });

  it('an explicit configuration overrides the default either way', () => {
    expect(grantScope(contractFor('SendNotification', 1)!, resend, 'resend-api-key', 'not-narrowable', 'proceed-and-record').proceed).toBe(true);
    expect(grantScope(contractFor('ReadRepository', 1)!, github, 'github-token', null, 'refuse').proceed).toBe(false);
  });
});
