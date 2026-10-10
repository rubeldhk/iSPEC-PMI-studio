/**
 * `T1809` (EPIC-038 Convergence) — current source versions, read from the
 * modules that own them.
 *
 * `FR-CTX-017`, `SC-CTX-009`, `FR-CTX-063`. Staleness, the index's stale count
 * and inspection's drift notes all need the current version of a source; with
 * no reader bound, every one of them answered *unknown* in the running
 * application. Requirements and specifications already expose their current
 * state — the requirement's content hash, the specification's current version
 * number — so the reader asks those modules' public services and nothing else.
 *
 * Three answers, kept apart: *resolves at version X*, *does not resolve*
 * (absent, other workspace, retired, no current version), and *unknown* (a type
 * no module answers for). A read that fails is an outage and propagates.
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/core/errors.js';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';

function services(over: Partial<GovernedSourceServices> = {}): GovernedSourceServices {
  return {
    requirements: {
      async get(workspaceId, id) {
        if (workspaceId !== 'ws_1' || !['rq_1', 'rq_retired'].includes(id)) throw new NotFoundError('Not found.');
        return {
          id, projectId: 'pr_1', reference: 'REQ-1', description: 'notify once',
          contentHash: 'hash_a', retiredAt: id === 'rq_retired' ? new Date() : null,
        };
      },
    },
    specifications: {
      async get(workspaceId, id) {
        if (workspaceId !== 'ws_1' || !['sp_1', 'sp_empty'].includes(id)) throw new NotFoundError('Not found.');
        return {
          id, projectId: 'pr_1', title: 'Notifications',
          currentVersion: id === 'sp_1' ? { versionNumber: 3, contentRaw: '# Notifications' } : null,
        };
      },
      async versions() {
        return [{ versionNumber: 3, contentRaw: '# Notifications v3' }, { versionNumber: 2, contentRaw: '# v2' }];
      },
    },
    ...over,
  };
}

describe('T1809 · the version reader', () => {
  const reader = governedSources(services());

  it('a requirement resolves at its content hash', async () => {
    expect(await reader.currentVersion('ws_1', 'requirement', 'rq_1')).toEqual({ resolves: true, version: 'hash_a' });
  });

  it('a specification resolves at its current version number', async () => {
    expect(await reader.currentVersion('ws_1', 'specification', 'sp_1')).toEqual({ resolves: true, version: 'v3' });
  });

  it('absent, another workspace, retired, or no current version: does not resolve', async () => {
    expect(await reader.currentVersion('ws_1', 'requirement', 'rq_none')).toEqual({ resolves: false });
    expect(await reader.currentVersion('ws_2', 'requirement', 'rq_1')).toEqual({ resolves: false });
    expect(await reader.currentVersion('ws_1', 'requirement', 'rq_retired')).toEqual({ resolves: false });
    expect(await reader.currentVersion('ws_1', 'specification', 'sp_empty')).toEqual({ resolves: false });
  });

  it('a type no module answers for is unknown, with a reason — never "does not resolve"', async () => {
    const answer = await reader.currentVersion('ws_1', 'decision', 'd_1');
    expect(answer.resolves).toBe('unknown');
    expect(answer.resolves === 'unknown' ? answer.reason : '').toMatch(/decision/);
  });

  it('a failing read is an outage and propagates', async () => {
    const failing = governedSources(
      services({ requirements: { async get() { throw new Error('register unreachable'); } } }),
    );
    await expect(failing.currentVersion('ws_1', 'requirement', 'rq_1')).rejects.toThrow(/register unreachable/);
  });
});
