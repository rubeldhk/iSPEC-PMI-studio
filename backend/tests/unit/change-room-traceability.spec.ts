/**
 * `T994m`, `T994n` (EPIC-034) — work arising from a change traces back to it.
 *
 * `FR-CHR-064`: *"Specification, task and test changes arising from an approved
 * change MUST be traceable to that change."*
 *
 * ## No second link store
 *
 * The links go through `EPIC-011`'s `LinkWriterService`, which is the one place
 * links live. A table of this Room's own would answer the same question in a
 * second voice, and the day the two disagreed nobody would know which was the
 * trace. `T994n` says so in its own words: *no second link store*.
 *
 * ## `change` is an artifact type and not a chain stage
 *
 * `CHAIN_STAGES` is the ordered derivation chain, and `chain-gap.service.ts`
 * indexes into it to decide what is up-chain of what. A change request is not a
 * stage of derivation; it is the reason a derivation changed. So `change` joins
 * the type without joining the sequence, and the three new edges point **at**
 * it — never from it. An edge with `change` as its source would make a change
 * derive from the work it caused, which is the chain by the back door.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  RePlanRecorder,
  type ChangeTraceWriterPort,
} from '../../src/modules/change-room/replan.recorder.js';
import {
  PERMITTED_EDGES,
  assertPermittedEdge,
  isChainStage,
} from '../../src/modules/traceability/link-writer.service.js';

/** Records what it was asked to write, so the test can read it back. */
function tracer() {
  const written: { sourceType: string; sourceId: string; changeRequestId: string }[] = [];
  const port: ChangeTraceWriterPort = {
    async linkArtifactToChange(input) {
      written.push({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        changeRequestId: input.changeRequestId,
      });
      return {};
    },
  };
  return { port, written };
}

const recorder = (links?: ChangeTraceWriterPort) =>
  new RePlanRecorder(new InMemoryChangeRoomStore(), links);

describe('T994m · the three edges FR-CHR-064 needs', () => {
  it.each(['specification', 'task', 'test'])('%s → change is permitted', (source) => {
    expect(() => assertPermittedEdge(source as never, 'change')).not.toThrow();
  });

  it('and change → anything is not', () => {
    // `change` is only ever a target. The other direction would put it in the
    // derivation chain by the back door.
    for (const target of ['specification', 'task', 'test', 'requirement']) {
      expect(() => assertPermittedEdge('change' as never, target as never)).toThrow();
    }
  });

  it('change is not a chain stage', () => {
    // The distinction the whole widening turns on. In the chain it would give
    // the gap report an ordering question with no correct answer.
    expect(isChainStage('change')).toBe(false);
    expect(isChainStage('specification')).toBe(true);
  });

  it('and no permitted edge has a non-chain source', () => {
    for (const edge of PERMITTED_EDGES) {
      expect(isChainStage(edge.sourceType), `${edge.sourceType} is a source`).toBe(true);
    }
  });
});

describe('T994m · the recorder writes them through EPIC-011', () => {
  it('links a specification to the change', async () => {
    const t = tracer();
    const written = await recorder(t.port).traceToChange({
      workspaceId: 'ws_1',
      changeRequestId: 'cr_1',
      artifacts: [{ type: 'specification', id: 'spec_1' }],
    });

    expect(written).toBe(1);
    expect(t.written[0]).toEqual({
      sourceType: 'specification',
      sourceId: 'spec_1',
      changeRequestId: 'cr_1',
    });
  });

  it('links tasks and tests too, each to the same change', async () => {
    const t = tracer();
    await recorder(t.port).traceToChange({
      workspaceId: 'ws_1',
      changeRequestId: 'cr_1',
      artifacts: [
        { type: 'specification', id: 'spec_1' },
        { type: 'task', id: 'task_9' },
        { type: 'test', id: 'test_4' },
      ],
    });

    expect(t.written.map((w) => w.sourceType)).toEqual(['specification', 'task', 'test']);
    expect(t.written.every((w) => w.changeRequestId === 'cr_1')).toBe(true);
  });

  it('writes nothing for an empty list, rather than inventing a link', async () => {
    const t = tracer();
    expect(
      await recorder(t.port).traceToChange({
        workspaceId: 'ws_1',
        changeRequestId: 'cr_1',
        artifacts: [],
      }),
    ).toBe(0);
    expect(t.written).toHaveLength(0);
  });

  it('refuses an artifact with no id, before writing any of them', async () => {
    // Checked across the whole list first: a partial trace is worse than none,
    // because the missing half looks like work that did not arise from the
    // change.
    const t = tracer();
    await expect(
      recorder(t.port).traceToChange({
        workspaceId: 'ws_1',
        changeRequestId: 'cr_1',
        artifacts: [
          { type: 'specification', id: 'spec_1' },
          { type: 'task', id: '  ' },
        ],
      }),
    ).rejects.toThrow(/id/i);
    expect(t.written).toHaveLength(0);
  });
});

describe('T994m · no second link store', () => {
  it('refuses when EPIC-011 is unbound rather than recording locally', async () => {
    // The whole point of `T994n`. A trace nobody else can traverse is not a
    // trace, and a local table for it is the second store the task forbids.
    await expect(
      recorder().traceToChange({
        workspaceId: 'ws_1',
        changeRequestId: 'cr_1',
        artifacts: [{ type: 'specification', id: 'spec_1' }],
      }),
    ).rejects.toThrow(/EPIC-011/);
  });

  it('the Room store offers no link table of its own', async () => {
    // Structural. If one existed, the refusal above would be a choice rather
    // than a consequence.
    const store = new InMemoryChangeRoomStore();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    for (const name of methods) {
      expect(/link/i.test(name), `the Change Room store offers ${name}`).toBe(false);
    }
  });

  it('the link-method check can fire', () => {
    expect(/link/i.test('appendLink')).toBe(true);
  });
});
