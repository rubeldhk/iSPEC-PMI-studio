/**
 * T851 · `DEF-026-007` — the Next column knows what kind of Epic it addresses.
 *
 * The register recommended `/speckit-tasks` to EPIC-017, a parent design —
 * the one command `FR-ESK-024` defines that kind as never running. The
 * near miss is on record: a `/speckit-tasks 017` run was made BECAUSE the
 * register recommended it, and was stopped by a human reading the spec's own
 * status line, not by any check. This file is that check.
 *
 * Two layers, matching how the defect escaped:
 *
 * 1. **The derivation** — `deriveStage` resolves `next` to `—` when the
 *    reached stage's command does not reach the epic's kind (the `T683`
 *    `appliesTo` shape: absence means every kind). Naming a command that must
 *    not run is Constitution IX's honesty error in the opposite direction.
 * 2. **The committed register** — no `parent-design` row names a
 *    task-generating or implementation command. This is the assertion whose
 *    absence let 28 rows render unnoticed.
 *
 * Written to FAIL before T852/T853 exist (Constitution V).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';
import { deriveStage, loadStageConfig } from './derive';
import {
  MINIMAL_ANALYSIS,
  MINIMAL_PLAN,
  MINIMAL_TASKS,
  RESOLVED_CHECKLIST,
  SPEC_WITH_EMPTY_SESSION,
  buildEpicTree,
} from './fixtures';

const config = loadStageConfig();

/** Commands a parent design must never be told to run (FR-ESK-024, D-18/D-19). */
const FORBIDDEN_FOR_PARENT = ['/speckit-tasks', '/speckit-analyze', '/speckit-implement', 'DOR evaluation'];

describe('T851 · the derivation takes kind into account (DEF-026-007)', () => {
  it('a parent design at its terminal Planned stage is told —, not /speckit-tasks', () => {
    const tree = buildEpicTree({
      '017-enhancement-model': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    try {
      const derived = deriveStage(join(tree.specsDir, '017-enhancement-model'), config, 'parent-design');
      expect(derived.stage).toBe('Planned');
      // The honest answer at a stage whose command does not reach this kind.
      expect(derived.next).toBe('—');
    } finally {
      tree.cleanup();
    }
  });

  it('a DELIVERY epic at Planned still reads /speckit-tasks — unchanged', () => {
    const tree = buildEpicTree({
      '099-delivery-fixture': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    try {
      const derived = deriveStage(join(tree.specsDir, '099-delivery-fixture'), config, 'delivery');
      expect(derived.next).toBe('/speckit-tasks');
    } finally {
      tree.cleanup();
    }
  });

  it('kind filtering reaches every stage whose command excludes the kind, not only Planned', () => {
    // A parent design that (contradictorily) accumulated tasks + analysis:
    // the derivation still must not point it at the DOR it never evaluates.
    const tree = buildEpicTree({
      '098-parent-overgrown': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: MINIMAL_ANALYSIS,
      },
    });
    try {
      const derived = deriveStage(join(tree.specsDir, '098-parent-overgrown'), config, 'parent-design');
      expect(FORBIDDEN_FOR_PARENT).not.toContain(derived.next);
    } finally {
      tree.cleanup();
    }
  });

  it('stages BEFORE the split point still address every kind — EPIC-002 keeps its checklist command', () => {
    const tree = buildEpicTree({
      '002-parent-clarified': { spec: SPEC_WITH_EMPTY_SESSION },
    });
    try {
      const derived = deriveStage(join(tree.specsDir, '002-parent-clarified'), config, 'parent-design');
      expect(derived.stage).toBe('Clarified');
      // The defect judged this correct: a checklist is not forbidden to a
      // parent design; only task-generating commands are.
      expect(derived.next).toBe('/speckit-checklist');
    } finally {
      tree.cleanup();
    }
  });

  it('an unspecified kind behaves as before — absence filters nothing', () => {
    const tree = buildEpicTree({
      '097-kindless': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    try {
      const derived = deriveStage(join(tree.specsDir, '097-kindless'), config);
      expect(derived.next).toBe('/speckit-tasks');
    } finally {
      tree.cleanup();
    }
  });
});

describe('T851 · the COMMITTED register recommends nothing a parent design must never run', () => {
  const register = readFileSync(join(REPO_ROOT, 'governance/epic-stage-register.md'), 'utf8');

  /** Table rows whose Kind cell reads parent-design. */
  const parentRows = register
    .split('\n')
    .filter((line) => line.startsWith('| [EPIC-') && line.includes('| parent-design |'));

  it('has parent-design rows to check — the assertion cannot pass vacuously', () => {
    expect(parentRows.length).toBeGreaterThanOrEqual(2); // EPIC-002, EPIC-017
  });

  it.each(FORBIDDEN_FOR_PARENT.map((command) => [command]))(
    'no parent-design row names %s in its Next column',
    (command) => {
      const offenders = parentRows.filter((row) => row.includes(command));
      expect(
        offenders,
        `the register tells a parent design to run ${command} — DEF-026-007 rendering again`,
      ).toEqual([]);
    },
  );
});
