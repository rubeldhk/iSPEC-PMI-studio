/**
 * T828 — the requirement content-change signal (EPIC-008 F-04.7, **FR-032**).
 *
 * Written to FAIL before T829 exists (Constitution V).
 *
 * Added by the EPIC-008 convergence pass. `OutOfDateService` (T094) flags every
 * specification derived from a changed requirement — but nothing was telling it
 * a requirement had changed. EPIC-007 built the hash and said so explicitly:
 * "the one function in this epic with no user-visible behaviour". This is the
 * seam that gives it one.
 *
 * The signal is a hook, not a direct call, for the same reason the FR-033
 * refusal hook is: the requirement register must not depend on the
 * specification module. They meet at the composition root (EPIC-014 F-11.2),
 * as `onRefused` already does.
 */
import { describe, expect, it } from 'vitest';
import { requirementContentHash } from '../../../src/modules/requirements/requirement-hash.js';
import {
  InMemoryRequirementStore,
  RequirementsService,
  type RequirementContentChange,
} from '../../../src/modules/requirements/requirements.service.js';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
} from '../../../src/modules/requirements/requirement-version.service.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const VALID = { description: 'The system shall settle.', type: 'functional', priority: 'p1' } as const;

function service(): { service: RequirementsService; changes: RequirementContentChange[] } {
  const changes: RequirementContentChange[] = [];
  return {
    changes,
    service: new RequirementsService(
      new InMemoryRequirementStore(),
      new RequirementVersionService(new InMemoryRequirementVersionStore()),
      { onContentChanged: (change) => changes.push(change) },
    ),
  };
}

describe('a material edit signals the change (FR-032)', () => {
  it('emits both hashes, so the consumer decides rather than trusting the caller', async () => {
    const { service: svc, changes } = service();
    const created = await svc.create(CTX, 'p1', VALID);
    await svc.edit(CTX, created.id, { description: 'The system shall settle nightly.' });

    expect(changes).toHaveLength(1);
    expect(changes[0]!.requirementId).toBe(created.id);
    expect(changes[0]!.workspaceId).toBe('ws_a');
    expect(changes[0]!.previousContentHash).toBe(requirementContentHash(VALID));
    expect(changes[0]!.currentContentHash).toBe(
      requirementContentHash({ ...VALID, description: 'The system shall settle nightly.' }),
    );
  });

  it('emits on a priority change, not only on a text change', async () => {
    const { service: svc, changes } = service();
    const created = await svc.create(CTX, 'p1', VALID);
    await svc.edit(CTX, created.id, { priority: 'p3' });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.previousContentHash).not.toBe(changes[0]!.currentContentHash);
  });

  it('emits AFTER the record has moved — a consumer never reads a stale requirement', async () => {
    const store = new InMemoryRequirementStore();
    const seen: (string | undefined)[] = [];
    const svc = new RequirementsService(
      store,
      new RequirementVersionService(new InMemoryRequirementVersionStore()),
      {
        onContentChanged: (change) => {
          seen.push(undefined);
          void store.findById(change.requirementId).then((r) => {
            seen[seen.length - 1] = r?.contentHash;
          });
        },
      },
    );
    const created = await svc.create(CTX, 'p1', VALID);
    await svc.edit(CTX, created.id, { description: 'Amended text.' });
    await Promise.resolve();
    expect(seen[0]).toBe(
      requirementContentHash({ ...VALID, description: 'Amended text.' }),
    );
  });
});

describe('a non-material edit signals nothing', () => {
  it('an edit that changes nothing emits no signal', async () => {
    const { service: svc, changes } = service();
    const created = await svc.create(CTX, 'p1', VALID);
    await svc.edit(CTX, created.id, { description: VALID.description });
    expect(changes).toEqual([]);
  });

  it('re-spacing the same text emits no signal — the hash decides, not the string', async () => {
    const { service: svc, changes } = service();
    const created = await svc.create(CTX, 'p1', VALID);
    await svc.edit(CTX, created.id, { description: '  The system   shall settle.  ' });
    expect(changes).toEqual([]);
  });

  it('creating a requirement emits nothing — a new requirement makes nothing stale', async () => {
    const { service: svc, changes } = service();
    await svc.create(CTX, 'p1', VALID);
    expect(changes).toEqual([]);
  });
});

describe('the hook is optional', () => {
  it('an unwired register still edits — the seam is not a dependency', async () => {
    const svc = new RequirementsService(
      new InMemoryRequirementStore(),
      new RequirementVersionService(new InMemoryRequirementVersionStore()),
    );
    const created = await svc.create(CTX, 'p1', VALID);
    await expect(svc.edit(CTX, created.id, { description: 'Amended.' })).resolves.toMatchObject({
      description: 'Amended.',
    });
  });
});
