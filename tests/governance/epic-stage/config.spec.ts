/**
 * T469 · Check `G-26-01` — the stage model is configuration, not code.
 * Written to FAIL before T470 exists (Constitution V).
 *
 * **`FR-ESK-015`.** The stage sequence, the evidence rule for each stage, the
 * DOR condition set, the posture kinds, the Epic kinds and the waiver roles are
 * *configuration* — the same pattern `governance.config.json` established for
 * the steering review interval, where EPIC-018 recorded the reasoning: a
 * threshold hard-coded in a check is a principle nobody agreed to.
 *
 * This check asserts the config's **shape and completeness**, not its values
 * beyond what the specification fixes: seven stages (`FR-ESK-001`), three
 * posture kinds (`FR-ESK-020`), two Epic kinds (`FR-ESK-024`), twelve DOR
 * conditions (`FR-ESK-012`), three waiver roles (`FR-ESK-022`).
 *
 * Those counts are in the spec, so they are asserted. The *contents* — which
 * stage comes third, what `DOR-07` reads — are configuration and are asserted
 * for structure only. A check that pinned every value would make the file
 * unchangeable without editing a test, which is the opposite of configuration.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';

const CONFIG_PATH = join(REPO_ROOT, 'governance/epic-stage.config.json');

interface StageConfig {
  readonly name: string;
  readonly order: number;
  readonly evidence: string;
  readonly next: string;
}

interface EpicStageConfig {
  readonly stages: StageConfig[];
  readonly postureKinds: Record<string, { readonly requires: string; readonly meaning: string }>;
  readonly epicKinds: Record<string, { readonly terminalStage: string; readonly evaluatesDor: boolean }>;
  readonly dorConditions: { readonly id: string; readonly condition: string; readonly reads: string }[];
  readonly waiverRoles: string[];
  readonly epicDirectoryPattern: string;
}

function load(): EpicStageConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as EpicStageConfig;
}

describe('G-26-01 · epic-stage.config.json (FR-ESK-015)', () => {
  it('exists', () => {
    expect(
      existsSync(CONFIG_PATH),
      'governance/epic-stage.config.json is absent — the stage model would be hard-coded in a check',
    ).toBe(true);
  });

  it('defines exactly seven ordered stages (FR-ESK-001)', () => {
    const { stages } = load();
    expect(stages).toHaveLength(7);
    // Contiguous from 1. A gap or a duplicate would make "highest contiguous
    // stage" ambiguous, and the derivation would silently pick one reading.
    expect(stages.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gives every stage its evidence rule and its next command (FR-ESK-002)', () => {
    for (const stage of load().stages) {
      expect(stage.name, 'a stage with no name').toBeTruthy();
      expect(stage.evidence, `stage ${stage.name} states no evidence`).toBeTruthy();
      expect(stage.next, `stage ${stage.name} names no next command`).toBeTruthy();
    }
  });

  it('names next commands as concrete invocations, not activities (FR-ESK-002)', () => {
    // "run the clarification step" is not actionable; `/speckit-clarify` is.
    // The terminal stage is the one exception and says so with an em dash.
    for (const stage of load().stages) {
      expect(
        stage.next.startsWith('/speckit-') || stage.next === '—' || stage.next === 'DOR evaluation',
        `stage ${stage.name} names "${stage.next}", which is not a command`,
      ).toBe(true);
    }
  });

  it('defines exactly three posture kinds, each with a required field (FR-ESK-020)', () => {
    const { postureKinds } = load();
    expect(Object.keys(postureKinds).sort()).toEqual(['Blocked', 'Held', 'Superseded']);
    for (const [kind, definition] of Object.entries(postureKinds)) {
      expect(definition.requires, `posture ${kind} names no required field`).toBeTruthy();
      expect(definition.meaning, `posture ${kind} states no meaning`).toBeTruthy();
    }
  });

  it('defines exactly two Epic kinds, and only one of them is evaluated for readiness (FR-ESK-024)', () => {
    const { epicKinds } = load();
    expect(Object.keys(epicKinds).sort()).toEqual(['delivery', 'parent-design']);
    expect(epicKinds['delivery']?.evaluatesDor).toBe(true);
    // A parent design carries no tasks by design, so evaluating it for
    // readiness would report a permanent, meaningless failure.
    expect(epicKinds['parent-design']?.evaluatesDor).toBe(false);
    expect(epicKinds['parent-design']?.terminalStage).toBe('Planned');
  });

  it('defines exactly twelve DOR conditions, DOR-01 to DOR-12 (FR-ESK-012)', () => {
    const { dorConditions } = load();
    expect(dorConditions).toHaveLength(12);
    expect(dorConditions.map((condition) => condition.id)).toEqual([
      'DOR-01',
      'DOR-02',
      'DOR-03',
      'DOR-04',
      'DOR-05',
      'DOR-06',
      'DOR-07',
      'DOR-08',
      'DOR-09',
      'DOR-10',
      'DOR-11',
      'DOR-12',
    ]);
  });

  it('states what each DOR condition reads, so none needs human judgement (FR-ESK-011)', () => {
    for (const condition of load().dorConditions) {
      expect(condition.condition, `${condition.id} states no condition`).toBeTruthy();
      expect(condition.reads, `${condition.id} names no evidence to read`).toBeTruthy();
    }
  });

  it('reuses the three governance roles for waiver ownership (FR-ESK-022)', () => {
    const { waiverRoles } = load();
    expect([...waiverRoles].sort()).toEqual(['product-owner', 'project-owner', 'tech-lead']);

    // Reused, not re-declared. A second list of roles would drift from the
    // first, and the register would authorise owners governance did not.
    const shared = JSON.parse(
      readFileSync(join(REPO_ROOT, 'governance/governance.config.json'), 'utf8'),
    ) as { owners?: string[] };
    if (shared.owners) {
      expect([...waiverRoles].sort()).toEqual([...shared.owners].sort());
    }
  });

  it('excludes non-Epic directories by pattern, never by a maintained list (FR-ESK-008)', () => {
    // The whole point: `specs/_shared/` is excluded because it does not match
    // `NNN-`, not because someone remembered to list it. A maintained list is a
    // second source of truth that silently omits the next new directory.
    const { epicDirectoryPattern } = load();
    expect(epicDirectoryPattern).toBeTruthy();
    const pattern = new RegExp(epicDirectoryPattern);
    expect(pattern.test('004-workspace-tenancy-audit')).toBe(true);
    expect(pattern.test('026-epic-stage-kanban')).toBe(true);
    expect(pattern.test('_shared')).toBe(false);
    expect(pattern.test('README.md')).toBe(false);
  });

  it('is valid JSON with no trailing content', () => {
    // A config that parses only by luck is a config that breaks on the next
    // edit, and the failure would look like a derivation bug.
    expect(() => load()).not.toThrow();
  });
});
