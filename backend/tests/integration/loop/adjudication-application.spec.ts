/**
 * T1088 (EPIC-030 Phase C2A) — EPIC-009 application, and the honesty of "unknown".
 *
 * `FR-GEL-069`. The rule under test: **an EPIC-009 failure cannot yield an
 * `applied` verdict**, and an outcome nobody observed is reported as neither
 * applied nor refused.
 */
import { describe, expect, it } from 'vitest';
import {
  LifecycleApplicationAdapter,
  type ApplicationIntentStore,
  type SpecificationTransitionPort,
} from '../../../src/modules/loop/lifecycle-application.adapter';

class RecordingIntents implements ApplicationIntentStore {
  readonly opened: unknown[] = [];
  readonly settled: string[] = [];
  async open(input: Record<string, string>): Promise<string> {
    this.opened.push(input);
    return `intent-${this.opened.length}`;
  }
  async settle(_intentId: string, outcome: string): Promise<void> {
    this.settled.push(outcome);
  }
}

function adapter(
  transition: SpecificationTransitionPort['transition'],
): { adapter: LifecycleApplicationAdapter; intents: RecordingIntents } {
  const intents = new RecordingIntents();
  return { adapter: new LifecycleApplicationAdapter({ transition }, intents), intents };
}

const INPUT = {
  workspaceId: 'w1',
  specificationId: 's1',
  expectedCurrentStatus: 'draft',
  requestedStatus: 'review',
  actorId: 'u1',
};

function named(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('T1088 · confirmation', () => {
  it('confirms when EPIC-009 reports the requested state', async () => {
    const { adapter: a, intents } = adapter(async () => ({ id: 't1', lifecycleState: 'review' }));
    expect(await a.apply(INPUT)).toEqual({ outcome: 'confirmed', transitionId: 't1' });
    expect(intents.settled).toEqual(['confirmed']);
  });

  it('records a durable intent BEFORE calling EPIC-009', async () => {
    // Without this, an application that may have happened leaves no trace for
    // a reconciliation pass to find.
    let intentAtCallTime = 0;
    const intents = new RecordingIntents();
    const a = new LifecycleApplicationAdapter(
      {
        transition: async () => {
          intentAtCallTime = intents.opened.length;
          return { id: 't1', lifecycleState: 'review' };
        },
      },
      intents,
    );
    await a.apply(INPUT);
    expect(intentAtCallTime, 'the call happened before the intent was durable').toBe(1);
  });
});

describe('T1088 · a stated refusal is a refusal', () => {
  it('reports refused when EPIC-009 states the transition is not permitted', async () => {
    const { adapter: a } = adapter(async () => {
      throw named('InvalidLifecycleTransitionError', 'draft -> review not permitted');
    });
    const out = await a.apply(INPUT);
    expect(out.outcome).toBe('refused');
  });
});

describe('T1088 · an unobserved outcome is UNKNOWN, never applied and never refused', () => {
  it('reports unknown on a timeout', async () => {
    const { adapter: a, intents } = adapter(async () => {
      throw named('TimeoutError', 'no response in 30s');
    });
    const out = await a.apply(INPUT);
    expect(out.outcome).toBe('unknown');
    expect(intents.settled).toEqual(['unknown']);
  });

  it('reports unknown on an unexpected fault — a database outage is not a policy decision', async () => {
    const { adapter: a } = adapter(async () => {
      throw named('PrismaClientKnownRequestError', 'connection lost');
    });
    expect((await a.apply(INPUT)).outcome).toBe('unknown');
  });

  it('reports unknown when EPIC-009 returns a state other than the one requested', async () => {
    // No error was raised, and the transition still did not happen. Trusting
    // the absence of an exception would report this as applied.
    const { adapter: a } = adapter(async () => ({ id: 't1', lifecycleState: 'draft' }));
    const out = await a.apply(INPUT);
    expect(out.outcome).toBe('unknown');
    expect(out.outcome === 'unknown' && out.reason).toMatch(/rather than/);
  });

  it('NEVER returns confirmed for any failure mode', async () => {
    for (const thrower of [
      () => named('TimeoutError', 't'),
      () => named('Error', 'generic'),
      () => named('PrismaClientKnownRequestError', 'db'),
      () => named('InvalidLifecycleTransitionError', 'refused'),
    ]) {
      const { adapter: a } = adapter(async () => {
        throw thrower();
      });
      expect((await a.apply(INPUT)).outcome).not.toBe('confirmed');
    }
  });
});
