/**
 * `T994j`, `T994k` (EPIC-034) — the re-plan recorder, which re-plans nothing.
 *
 * `FR-CHR-062`, `FR-CHR-065`, `R-034-2`.
 *
 * ## The trap this file exists to keep shut
 *
 * `FR-CHR-062` says downstream work MUST be updated *"through `BR-0154`'s
 * mechanism"*. `TaskRegenerationService.regenerate()` exists, is named exactly
 * for the job, and would satisfy that sentence in one call. It also **replaces**
 * a task list — `replaced: boolean`, *"existing when refused, the new list when
 * replaced"* — and `BR-0154` requires revision **without destroying
 * completed-work history**.
 *
 * So calling it would satisfy the sentence and violate the requirement the
 * sentence cites. `FR-CHR-065` forbids it outright: re-plan MUST NOT silently
 * discard work already completed.
 *
 * `EPIC-012` built regeneration as replace-with-confirmation. The confirmation
 * gate makes the replacement **deliberate**; it does not make it
 * **non-destructive**. An implementer who reads the requirement, finds the
 * service, calls it and sees green has done exactly the thing the requirement
 * forbids — and the tests would agree with them.
 *
 * ## So this records, and executes nothing
 *
 * The obligation sits in `recorded` where anyone can see it is outstanding,
 * until `U-12` exists to discharge it. `REPLAN_STATES` has no `executed`,
 * because this Epic has no verb that would produce one.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import { RePlanRecorder } from '../../src/modules/change-room/replan.recorder.js';
import { REPLAN_STATES } from '../../src/modules/change-room/replan.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(here, '..', '..', 'src', 'modules', 'change-room', 'replan.recorder.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const recorder = () => {
  const store = new InMemoryChangeRoomStore();
  return { store, subject: new RePlanRecorder(store) };
};

const obligation = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  changeDecisionId: 'cd_1',
  affectedSpecificationId: 'spec_1',
  whatMustChange: 'the notification window in the delivery tasks drops from 24h to 1h',
  why: 'the approved change shortens the regulatory window',
  ...over,
});

describe('T994j · an obligation is recorded', () => {
  it('naming what must change and why', async () => {
    const { subject } = recorder();
    const result = await subject.record(obligation());

    expect(result.whatMustChange).toContain('24h to 1h');
    expect(result.why).toContain('regulatory window');
    expect(result.affectedSpecificationId).toBe('spec_1');
  });

  it('in the `recorded` state', async () => {
    const { subject } = recorder();
    expect((await subject.record(obligation())).state).toBe('recorded');
  });

  it('and it is readable afterwards', async () => {
    const { store, subject } = recorder();
    await subject.record(obligation());
    const found = await store.listRePlanObligations('ws_1', 'cd_1');
    expect(found).toHaveLength(1);
    expect(found[0]?.state).toBe('recorded');
  });

  it('one per affected specification', async () => {
    const { store, subject } = recorder();
    await subject.record(obligation());
    await subject.record(obligation({ affectedSpecificationId: 'spec_2' }));
    expect(await store.listRePlanObligations('ws_1', 'cd_1')).toHaveLength(2);
  });
});

describe('T994j · what it refuses to record', () => {
  it('an obligation that does not say what must change', async () => {
    // `U-12` will read this prose. An obligation with nothing in it is a
    // reminder that something is outstanding without saying what — which is
    // worse than none, because it looks discharged once somebody glances at it.
    const { subject } = recorder();
    await expect(subject.record(obligation({ whatMustChange: '   ' }))).rejects.toThrow(
      /whatMustChange/,
    );
  });

  it('one that does not say why', async () => {
    const { subject } = recorder();
    await expect(subject.record(obligation({ why: '' }))).rejects.toThrow(/why/i);
  });

  it('one with no affected specification', async () => {
    const { subject } = recorder();
    await expect(subject.record(obligation({ affectedSpecificationId: '' }))).rejects.toThrow(
      /specification/i,
    );
  });

  it('and writes nothing when it refuses', async () => {
    const { store, subject } = recorder();
    await expect(subject.record(obligation({ why: '' }))).rejects.toThrow();
    expect(await store.listRePlanObligations('ws_1', 'cd_1')).toHaveLength(0);
  });
});

describe('T994j · R-034-2 — it executes nothing', () => {
  it('never imports TaskRegenerationService', () => {
    // The load-bearing clause. `change-room-independence.spec.ts` asserts this
    // across the whole module; it is repeated here because this is the one file
    // where the temptation actually arises, and a reader looking at the
    // recorder should find the ban beside it.
    expect(/TaskRegeneration/.test(CODE), 'the recorder imports TaskRegenerationService').toBe(
      false,
    );
    expect(/regenerate\s*\(/.test(CODE)).toBe(false);
  });

  it('the ban check can fire', () => {
    // Anti-tautology: an absence assertion is worth nothing unless the matcher
    // is shown catching the thing it forbids.
    expect(/TaskRegeneration/.test("import { TaskRegenerationService } from '../tasks';")).toBe(
      true,
    );
    expect(/regenerate\s*\(/.test('await tasks.regenerate({ specificationId });')).toBe(true);
  });

  it('offers no verb that would execute a re-plan', () => {
    // Structural. `record` is the only public path, and a method named for
    // execution would be the first step back towards the shortcut.
    const subject = new RePlanRecorder(new InMemoryChangeRoomStore());
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(subject)).filter(
      (name) => name !== 'constructor',
    );
    for (const forbidden of ['execute', 'apply', 'regenerate', 'replace', 'perform']) {
      expect(methods, `RePlanRecorder offers ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('and the obligation has no state that would mean it ran here', () => {
    // `REPLAN_STATES` has two members and neither is `executed`. A third would
    // imply a transition nothing in this Epic can make.
    expect([...REPLAN_STATES]).toEqual(['recorded', 'discharged-by-U-12']);
    expect([...REPLAN_STATES]).not.toContain('executed');
  });
});
