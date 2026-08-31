/**
 * `T997o`, `T997p` (EPIC-035) — nine ports, and eight of them refuse.
 *
 * `FR-DFR-062`, `FR-GEL-062`. The asymmetry is **asserted, not assumed**: it is
 * exactly the kind of thing a later reader tidies into consistency, and tidying
 * it either way breaks something.
 *
 * ## `TestExecution` absent must yield refusal, never a pass
 *
 * This is the one that matters most, and the one most likely to be got wrong
 * kindly. A fix arrives, the test-execution port is unbound, and the tempting
 * behaviour is to let the fix through — the runner is not this Epic's fault,
 * and blocking every repair on an absent dependency feels punitive.
 *
 * But `FR-DFR-041` says a fix submitted with no failing test on record MUST NOT
 * be accepted, and *"we could not check"* is not *"there is a test"*. An unbound
 * runner means nothing has demonstrated the defect. Accepting anyway records
 * that something did.
 *
 * ## Only `AgentGateway` degrades
 *
 * `FR-DFR-023`: an agent MAY triage and propose. An absent agent means nobody
 * proposed a classification, which a human can proceed without — they were
 * always the one who had to confirm it. Every other absence means a governed
 * step did not happen.
 *
 * ## And `RequirementIntake` is no longer among the refusals
 *
 * `T997d`, re-confirmed 2026-08-31: `EPIC-033`'s `T338v` landed and
 * `POST /rooms/requirement/gap-intake` is mounted. The port became an
 * **integration**. It is still declared here, and it still refuses when
 * unbound — what changed is that a binding now exists to make.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFECT_ROOM_PORTS,
  absentBehaviourOf,
} from '../../src/modules/defect-room/defect-room.tokens.js';

describe('T997o · nine ports, named', () => {
  it('declares nine', () => {
    expect(DEFECT_ROOM_PORTS).toHaveLength(9);
  });

  it('the nine the task names', () => {
    expect(DEFECT_ROOM_PORTS.map((p) => p.name).sort()).toEqual(
      [
        'AgentGateway',
        'BaselineReader',
        'ChangeIntake',
        'EvidenceStore',
        'LoopEngine',
        'PolicyProvider',
        'RepairTaskPort',
        'RequirementIntake',
        'TestExecution',
      ].sort(),
    );
  });

  it('each names the Epic that fills it', () => {
    for (const port of DEFECT_ROOM_PORTS) {
      expect(port.filledBy, `${port.name} names no owner`).toMatch(/EPIC-\d{3}|unowned/);
    }
  });

  it('and each says why its absence behaves as it does', () => {
    // The `because` is the part that survives. A table of names and behaviours
    // with no reasons is a table somebody rebalances.
    for (const port of DEFECT_ROOM_PORTS) {
      expect(port.because.length, `${port.name} gives no reason`).toBeGreaterThan(40);
    }
  });
});

describe('T997o · eight refuse, one degrades', () => {
  it('exactly one degrades', () => {
    const degrading = DEFECT_ROOM_PORTS.filter((p) => p.absent === 'degrade');
    expect(degrading.map((p) => p.name)).toEqual(['AgentGateway']);
  });

  it('and the other eight refuse', () => {
    const refusing = DEFECT_ROOM_PORTS.filter((p) => p.absent === 'refuse');
    expect(refusing).toHaveLength(8);
  });

  it('TestExecution refuses — absence is never a pass', () => {
    // `FR-DFR-062`. The single most important row in the table: "we could not
    // check" is not "there is a test", and accepting anyway records that
    // something demonstrated the defect when nothing did.
    expect(absentBehaviourOf('TestExecution')).toBe('refuse');
  });

  it('and its reason says so, not merely that it refuses', () => {
    const port = DEFECT_ROOM_PORTS.find((p) => p.name === 'TestExecution')!;
    expect(port.because).toMatch(/never a pass|not .*there is a test|could not check/i);
  });

  it('a port nobody declared has no behaviour, rather than a default one', () => {
    // The failure this prevents: `absentBehaviourOf` answering `degrade` for an
    // unknown name would make every unlisted seam permissive.
    expect(absentBehaviourOf('SomethingNobodyDeclared')).toBeNull();
  });

  it('the whole table is frozen', () => {
    expect(Object.isFrozen(DEFECT_ROOM_PORTS)).toBe(true);
    for (const port of DEFECT_ROOM_PORTS) {
      expect(Object.isFrozen(port)).toBe(true);
    }
  });
});

describe('T997o · the two collaborators that do not exist yet', () => {
  it('TestExecution is declared unowned', () => {
    // `R-035-1`. No callable test-execution surface exists anywhere in the
    // programme, re-confirmed at `T997d`. Naming an owner that does not exist
    // would be worse than naming none.
    const port = DEFECT_ROOM_PORTS.find((p) => p.name === 'TestExecution')!;
    expect(port.filledBy).toMatch(/unowned/i);
  });

  it('RepairTaskPort too — TaskRecord has no provenance field', () => {
    const port = DEFECT_ROOM_PORTS.find((p) => p.name === 'RepairTaskPort')!;
    expect(port.filledBy).toMatch(/unowned|EPIC-012/);
  });

  it('but RequirementIntake names EPIC-033, because that route now exists', () => {
    // `T997d`, re-confirmed 2026-08-31. The port stopped being a refusal
    // waiting on nobody and became an integration waiting on a binding.
    const port = DEFECT_ROOM_PORTS.find((p) => p.name === 'RequirementIntake')!;
    expect(port.filledBy).toContain('EPIC-033');
  });
});
