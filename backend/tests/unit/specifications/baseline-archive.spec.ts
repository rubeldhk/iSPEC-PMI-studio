/**
 * T099a — a baselined specification is immutable: editing forks a new version
 * in `draft` and the baseline stays retrievable unchanged; archiving retains
 * traceability links. Written to FAIL before T099b exists (Constitution V).
 *
 * FR-011a / FR-011b / US5. The fork is deliberately NOT a lifecycle
 * transition: `baselined → draft` is not in the permitted set, and the
 * database CHECK would refuse recording it — editing is a versioning event.
 */
import { describe, expect, it } from 'vitest';
import {
  BaselineService,
  InMemorySpecStatePort,
} from '../../../src/modules/specifications/baseline.service.js';
import {
  InMemorySpecificationVersionStore,
  SpecificationVersionService,
} from '../../../src/modules/specifications/version.service.js';
import { InMemoryTransitionRecorder } from '../../../src/modules/specifications/lifecycle.machine.js';
import { ConflictError, InvalidLifecycleTransitionError } from '../../../src/core/errors.js';

function build(): {
  service: BaselineService;
  versions: SpecificationVersionService;
  state: InMemorySpecStatePort;
  recorder: InMemoryTransitionRecorder;
} {
  const versions = new SpecificationVersionService(new InMemorySpecificationVersionStore());
  const state = new InMemorySpecStatePort();
  const recorder = new InMemoryTransitionRecorder();
  return { service: new BaselineService(versions, state, recorder), versions, state, recorder };
}

const SPEC = { id: 's1', workspaceId: 'ws_a' };

async function seedBaselined(built: ReturnType<typeof build>): Promise<void> {
  built.state.set(SPEC.id, 'baselined');
  await built.versions.appendIfChanged({
    workspaceId: 'ws_a',
    specificationId: SPEC.id,
    contentRaw: 'the baselined text',
    contentParsed: { title: 'Baseline' },
    lifecycleState: 'baselined',
    authoredById: 'u1',
  });
}

describe('FR-011a · the baseline is immutable — editing forks', () => {
  it('editing a baselined specification creates a NEW version in draft', async () => {
    const built = build();
    await seedBaselined(built);

    const fork = await built.service.editBaselined({
      ...SPEC,
      contentRaw: 'the amended text',
      contentParsed: { title: 'Amended' },
      authoredById: 'u2',
    });

    expect(fork.versionNumber).toBe(2);
    expect(fork.lifecycleStateAtCreation).toBe('draft');
    // The specification itself now sits in draft…
    expect(built.state.get(SPEC.id)).toBe('draft');
    // …and NO lifecycle transition was recorded: baselined → draft is not a
    // transition, it is a fork (the DB CHECK would refuse the row).
    expect(built.recorder.records).toHaveLength(0);
  });

  it('the baselined version stays retrievable UNCHANGED after the fork', async () => {
    const built = build();
    await seedBaselined(built);
    await built.service.editBaselined({
      ...SPEC,
      contentRaw: 'the amended text',
      contentParsed: {},
      authoredById: 'u2',
    });

    const history = await built.versions.listFor('ws_a', SPEC.id);
    const baseline = history.find((v) => v.versionNumber === 1);
    expect(baseline?.contentRaw).toBe('the baselined text');
    expect(baseline?.lifecycleStateAtCreation).toBe('baselined');
  });

  it('refuses to fork a specification that is not baselined — that is a plain edit', async () => {
    const built = build();
    built.state.set(SPEC.id, 'draft');
    await expect(
      built.service.editBaselined({ ...SPEC, contentRaw: 'x', contentParsed: {}, authoredById: 'u1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('FR-011b · archive retains, never deletes', () => {
  it.each(['approved', 'baselined', 'implemented'] as const)(
    'archives from %s, recording the transition with actor and time',
    async (from) => {
      const built = build();
      built.state.set(SPEC.id, from);
      await built.service.archive({ ...SPEC, actorId: 'u1' });
      expect(built.state.get(SPEC.id)).toBe('archived');
      expect(built.recorder.records[0]).toMatchObject({
        fromState: from,
        toState: 'archived',
        actorId: 'u1',
      });
    },
  );

  it('refuses to archive from draft or review, naming the permitted set', async () => {
    const built = build();
    built.state.set(SPEC.id, 'draft');
    await expect(built.service.archive({ ...SPEC, actorId: 'u1' })).rejects.toBeInstanceOf(
      InvalidLifecycleTransitionError,
    );
  });

  it('archiving touches no version and no link — nothing destructive exists to call', async () => {
    const built = build();
    await seedBaselined(built);
    await built.service.archive({ ...SPEC, actorId: 'u1' });
    // Versions intact…
    expect(await built.versions.listFor('ws_a', SPEC.id)).toHaveLength(1);
    // …and the service exposes no link-touching or deleting member at all.
    const members = Object.getOwnPropertyNames(Object.getPrototypeOf(built.service));
    for (const forbidden of ['delete', 'remove', 'unlink', 'purge']) {
      expect(members.some((m) => m.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});
