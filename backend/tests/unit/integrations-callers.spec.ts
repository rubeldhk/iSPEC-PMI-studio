/**
 * `T2242` (EPIC-039, analysis U1, `FR-HUB-004`) — `caller` is declared by the
 * client, so over HTTP only the Rooms (which run in the browser) may name
 * themselves. `loop`, `context-assembly`, `evidence-intake` and
 * `notification-dispatch` are set by the in-process module that owns them.
 *
 * Written to FAIL before `T2243`.
 */
import { PLATFORM_CALLERS } from '@pmi/capability-contract';
import { describe, expect, it } from 'vitest';
import { OWNER, PROJECT, SHA, WS, configure, testHub } from './integrations-hub.fixture.js';

const actor = { workspaceId: WS, userId: OWNER };

describe('T2242 · callers over HTTP', () => {
  it.each(['loop', 'context-assembly', 'evidence-intake', 'notification-dispatch'])('a body naming %s is refused caller-not-platform, recorded, and nothing is invoked', async (caller) => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const r = await hub.requests.request(actor, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller, input: { revision: SHA } }, { http: true });
    expect(r).toMatchObject({ outcome: 'refused', refusal: { code: 'caller-not-platform' } });
    expect(r.invocation).toBeUndefined();
    expect((await hub.store.findResolution(WS, r.resolutionId))!.refusalCode).toBe('caller-not-platform');
  });

  it.each(['room:requirement', 'room:change', 'room:defect'])('%s is accepted', async (caller) => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    const r = await hub.requests.request(actor, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller, input: { revision: SHA } }, { http: true });
    expect(r.outcome).toBe('resolved');
  });

  it('a caller outside the platform list is refused everywhere', async () => {
    const hub = testHub();
    const r = await hub.requests.request(actor, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller: 'local-agent', input: { revision: SHA } }, { http: false });
    expect(r.refusal!.code).toBe('caller-not-platform');
  });
});

describe('T2242 · callers in-process', () => {
  it('accepts every PLATFORM_CALLERS member', async () => {
    const hub = testHub();
    await configure(hub, 'ReadBuildStatus', ['fixture-ci']);
    for (const caller of PLATFORM_CALLERS) {
      const r = await hub.requests.request(actor, PROJECT, { capability: 'ReadBuildStatus', major: 1, caller, input: { revision: SHA } }, { http: false });
      expect(r.outcome, caller).toBe('resolved');
    }
  });
});
