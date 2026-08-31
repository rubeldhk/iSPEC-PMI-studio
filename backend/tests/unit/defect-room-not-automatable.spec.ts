/**
 * `T998j` (EPIC-035) — the non-automatable exception.
 *
 * `FR-DFR-030`, `FR-DFR-032`, `FR-DFR-043`, `R-035-7`.
 *
 * ## Three obligations, and the two that get dropped
 *
 * `BR-0054` says a failing test is required *"where automatable"*, so an
 * exception has to exist. The requirement then attaches two conditions to it:
 * **the reason MUST be recorded**, and **alternative evidence is required**.
 *
 * The reason survives most implementations. The evidence does not, and without
 * it "not automatable" is a bypass with a checkbox — the one sentence that
 * accepts any fix at all.
 *
 * The third obligation is the one nobody thinks of as an obligation: the
 * exception **MUST be visible and enumerable**. An exception you cannot count
 * is indistinguishable from a policy, because the only way to find out how
 * often it is used is to read every defect. So the service can list them.
 *
 * ## Evidence goes through `EPIC-032`, and this Room writes no access rules
 *
 * `R-035-7`: `FR-DFR-032` and `FR-DFR-033` are one composition, not two
 * mechanisms. The evidence store's own `AccessPolicy` refuses to read around
 * artifact access, so a second check here would be a second thing that can be
 * wrong. With the store unbound there is nowhere to put evidence that honours
 * those rules — so recording refuses rather than keeping a Room-local copy.
 *
 * That matters more here than anywhere else in the product: reproduction detail
 * is the one place a user is actively encouraged to paste a payload that
 * reproduces a failure (`PP-008`), and a reproduction HAR carrying a session
 * token under this Room's access rules is readable by everyone who can see
 * defects.
 */
import { describe, expect, it } from 'vitest';
import {
  ReproductionService,
  type EvidenceStorePort,
} from '../../src/modules/defect-room/reproduction.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');

/** A store that accepts a contribution and returns the ref it filed it under. */
const accepts: EvidenceStorePort = {
  async contribute(input) {
    return { evidenceRef: `ev_${input.attestation.predicateType.slice(-4)}` };
  },
};

const attestation = {
  _type: 'https://in-toto.io/Statement/v1' as const,
  subject: [{ name: 'notification-window', digest: { sha256: 'abc123' } }] as const,
  predicateType: 'https://pmi.studio/attestation/transcript/v1',
  predicate: { note: 'the sandbox run, captured by hand' },
};

/**
 * Two helpers, not one with a default.
 *
 * `room(evidence = accepts)` reads correctly and is wrong: `room(undefined)`
 * takes the default, so the two tests asserting an UNBOUND store refuses would
 * have been exercising a bound one. That mistake has now been made twice in
 * this repository, and both times the tests passed.
 */
async function room() {
  return build(accepts);
}

async function roomWith(evidence: EvidenceStorePort | undefined) {
  return build(evidence);
}

async function build(evidence: EvidenceStorePort | undefined) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'triaged',
    origin: 'manual-report',
    contestedArtifactRef: 'spec_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: NOW,
  });
  return { store, subject: new ReproductionService(store, evidence) };
}

const input = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  reproducible: 'not-automatable',
  environment: 'the third-party sandbox, EU region',
  affectedBehaviourRef: 'rv_1',
  notAutomatableReason: 'reproduces only against the third-party sandbox, which has no runner',
  evidence: [attestation],
  observedAt: NOW,
  recordedBy: 'u_1',
  ...over,
});

describe('T998j · the reason is required, and only where the exception applies', () => {
  it('records it', async () => {
    const { subject } = await room();
    const row = await subject.record(input());
    expect(row.reproducible).toBe('not-automatable');
    expect(row.notAutomatableReason).toMatch(/no runner/);
  });

  it('refuses the exception with no reason', async () => {
    const { subject } = await room();
    await expect(subject.record(input({ notAutomatableReason: null }))).rejects.toThrow(
      /FR-DFR-043/,
    );
  });

  it('and with a blank one', async () => {
    // A reason that says nothing is the same as none, and reads as one that was
    // given.
    const { subject } = await room();
    await expect(subject.record(input({ notAutomatableReason: '   ' }))).rejects.toThrow(
      /FR-DFR-043/,
    );
  });

  it('and refuses a reason on a defect that IS automatable', async () => {
    // Not pedantry: the exception has to be countable, and a reason attached to
    // an automatable defect inflates the count with a case that never used the
    // exception at all.
    const { subject } = await room();
    await expect(
      subject.record(input({ reproducible: 'always', notAutomatableReason: 'seems hard' })),
    ).rejects.toThrow(/only where/i);
  });

  it('while an automatable reproduction states null, not nothing', async () => {
    // Nullable, never optional. `null` is a stated "no exception here"; an
    // absent key is a question nobody asked.
    const { subject } = await room();
    const row = await subject.record(input({ reproducible: 'always', notAutomatableReason: null }));
    expect(row.notAutomatableReason).toBeNull();
    expect(Object.keys(row)).toContain('notAutomatableReason');
  });
});

describe('T998j · alternative evidence is required', () => {
  it('refuses the exception with no evidence at all', async () => {
    // The half that gets dropped, and the half that makes the exception safe.
    const { subject } = await room();
    await expect(subject.record(input({ evidence: [] }))).rejects.toThrow(/alternative evidence/i);
  });

  it('and requires evidence for an ordinary reproduction too', async () => {
    // `FR-DFR-030` — reproducibility, environment, **evidence** and affected
    // behaviour, all captured as data rather than left implicit in the test.
    const { subject } = await room();
    await expect(subject.record(input({ reproducible: 'always', notAutomatableReason: null, evidence: [] }))).rejects.toThrow(
      /evidence/i,
    );
  });

  it('but not-reproduced may carry none, because nothing was observed', async () => {
    // The one honest empty case. Demanding evidence of an absence would push
    // people to record something rather than nothing, which is worse than the
    // gap it fills.
    const { subject } = await room();
    const row = await subject.record(
      input({ reproducible: 'not-reproduced', notAutomatableReason: null, evidence: [] }),
    );
    expect(row.evidenceRefs).toEqual([]);
  });
});

describe('T998j · evidence goes through EPIC-032, or nowhere', () => {
  it('stores the refs the evidence store returned, not the payload', async () => {
    // `FR-DFR-032`. No payload, content or attachment field exists on the row —
    // the Room forwards and keeps the reference.
    const { subject } = await room();
    const row = await subject.record(input());
    expect(row.evidenceRefs).toHaveLength(1);
    expect(JSON.stringify(row)).not.toContain('captured by hand');
  });

  it('refuses when no evidence store is bound', async () => {
    // `DEFECT_ROOM_PORTS`: `EvidenceStore` absent ⇒ refuse. With no store bound
    // there is nowhere to put evidence that honours the artifact's access
    // rules, and a Room-local copy would honour this Room's rules instead.
    const { subject } = await roomWith(undefined);
    await expect(subject.record(input())).rejects.toThrow(/EPIC-032/);
  });

  it('and writes nothing while refusing', async () => {
    const { store, subject } = await roomWith(undefined);
    await expect(subject.record(input())).rejects.toThrow();
    expect(await store.reproductionsFor('ws_1', 'df_1')).toHaveLength(0);
  });

  it('a store that throws refuses too, rather than recording an unbacked ref', async () => {
    const broken: EvidenceStorePort = {
      async contribute() {
        throw new Error('the evidence store is unreachable');
      },
    };
    const { store, subject } = await roomWith(broken);
    await expect(subject.record(input())).rejects.toThrow(/unreachable/);
    expect(await store.reproductionsFor('ws_1', 'df_1')).toHaveLength(0);
  });

  it('the control: a bound store does record one', async () => {
    // Without this, a service that refused every reproduction would satisfy
    // every refusal above.
    const { store, subject } = await room();
    await subject.record(input());
    expect(await store.reproductionsFor('ws_1', 'df_1')).toHaveLength(1);
  });
});

describe('T998j · and the exception is enumerable', () => {
  it('lists the not-automatable ones across the workspace', async () => {
    // `FR-DFR-043`. An exception you cannot count is indistinguishable from a
    // policy: the only way to learn how often it is used would be to read every
    // defect, so nobody would.
    const { store, subject } = await room();
    await subject.record(input());
    await store.createDefect({
      id: 'df_2',
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      epicId: 'EPIC-999',
      state: 'triaged',
      origin: 'manual-report',
      contestedArtifactRef: 'spec_2',
      contestedArtifactVersion: 'v1',
      severity: 'low',
      reportedBy: 'u_0',
      reportedAt: NOW,
    });
    await subject.record(input({ defectId: 'df_2', reproducible: 'always', notAutomatableReason: null }));

    const exceptions = await subject.exceptions('ws_1');
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.defectId).toBe('df_1');
    expect(exceptions[0]?.notAutomatableReason).toMatch(/no runner/);
  });

  it('and none from another workspace', async () => {
    const { subject } = await room();
    await subject.record(input());
    expect(await subject.exceptions('ws_other')).toHaveLength(0);
  });
});
