/**
 * T957 — fail-closed. `SC-GEL-003`, `SC-GEL-009`, `FR-GEL-041`, `R-030-2`.
 *
 * `SC-GEL-009`: *"when the audit store is unavailable, 100% of transitions are
 * refused and zero proceed unrecorded."* Cited by identifier because the
 * convergence check reads identifiers, and behaviour nobody can trace to a
 * criterion is behaviour that criterion cannot be shown to have.
 *
 * *"The audit writer fails, the transition is refused, and the stage is
 * unchanged on read-back."*
 *
 * This is the assertion that catches the most dangerous version of a working
 * loop: one that advances objects and loses the record of why. Every other test
 * in this Epic would stay green — the object moves, the caller gets `accepted`,
 * the progress projection is right. What is gone is accountability, and nothing
 * else notices it going.
 *
 * **Read-back is the point, not the return value.** A writer could return
 * `refused` and have already moved the object; only re-reading catches that.
 * Which is exactly what the first draft of `transition-writer.ts` would have
 * done — the advance sat outside the transaction, so a rollback restored a
 * snapshot taken *after* the object had moved. Found by writing this test.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type AuditSink, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { TransitionWriter } from '../../src/modules/loop/transition-writer.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'fail-closed-type',
    stages: ['Event', 'Analyze', 'Outcome'],
    transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: null }],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['analyst'] };

/** An audit sink that is present, wired, and broken — the realistic failure. */
const brokenAudit: AuditSink = {
  async record() {
    throw new Error('audit store unavailable');
  },
};

const workingAudit = (seen: unknown[]): AuditSink => ({
  async record(entry) {
    seen.push(entry);
  },
});

async function seed(audit: AuditSink) {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws_1', projectId: 'p_1', workflowType: 'fail-closed-type', configVersion: 1,
    subjectType: 'opaque', subjectId: 's_1', currentStage: 'Event',
  });
  return { store, object, writer: new TransitionWriter(store, audit) };
}

const attempt = {
  toStage: 'Analyze' as const,
  expectedVersion: 0,
  actor: { kind: 'human' as const, id: 'u_1', authorities: ['analyst'] },
  gates: [],
};

describe('T957 · the happy path writes both, or the test below proves nothing', () => {
  it('advances the object and records the audit entry', async () => {
    const seen: unknown[] = [];
    const { store, object, writer } = await seed(workingAudit(seen));
    const result = await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt });
    expect(result.outcome).toBe('accepted');
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
    expect(seen).toHaveLength(1);
  });
});

describe('SC-GEL-003 · a failed audit leaves the object exactly where it was', () => {
  it('does not report the transition as accepted', async () => {
    const { object, writer } = await seed(brokenAudit);
    // A fault, not a governed refusal — so it surfaces as a rejection rather
    // than a `TransitionResult`. FR-GEL-014 is about refusals the loop DECIDED;
    // an unavailable audit store is not one of those.
    await expect(
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt }),
    ).rejects.toThrow(/audit store unavailable/);
  });

  it('leaves currentStage unchanged ON READ-BACK', async () => {
    const { store, object, writer } = await seed(brokenAudit);
    await writer
      .write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt })
      .catch(() => undefined);

    const after = await store.findObject(object.id);
    expect(after?.currentStage).toBe('Event');
  });

  it('leaves the OCC version unchanged, so the next attempt is not poisoned', async () => {
    // A rolled-back advance that left `version` incremented would make every
    // subsequent well-formed attempt lose a race against nothing.
    const { store, object, writer } = await seed(brokenAudit);
    await writer
      .write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt })
      .catch(() => undefined);
    expect((await store.findObject(object.id))?.version).toBe(0);
  });

  it('writes no orphan transition row', async () => {
    // The other half of atomicity: a transition recorded with no audit entry is
    // the same accountability hole in the other direction.
    const { store, object, writer } = await seed(brokenAudit);
    await writer
      .write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt })
      .catch(() => undefined);
    expect(await store.transitionsFor(object.id)).toHaveLength(0);
  });

  it('lets a later attempt succeed once audit recovers', async () => {
    // Fail-closed must not mean fail-permanently. The object is untouched, so a
    // retry against the same version is still valid.
    const { store, object } = await seed(brokenAudit);
    const seen: unknown[] = [];
    const recovered = new TransitionWriter(store, workingAudit(seen));
    const result = await recovered.write({
      object, config: CONFIG, authorities: AUTHORITIES, ...attempt,
    });
    expect(result.outcome).toBe('accepted');
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
    expect(seen).toHaveLength(1);
  });
});
