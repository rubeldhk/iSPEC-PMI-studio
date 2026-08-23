/**
 * T931 — the executable conformance check for a non-code output.
 *
 * Constitution V, v1.2.0: *"for document/configuration outputs, an executable
 * conformance check that can fail"*. The loop instance configuration files under
 * `packages/loop-contract/workflows/` are this Epic's non-code output, and this
 * is the check. It is written **before** the files exist and before `T932` makes
 * them pass, because a check authored against files already in place tends to
 * describe them rather than constrain them.
 *
 * It reads **every** file in the directory, so a later Epic adding
 * `change-room.json` or `defect-room.json` is covered without touching this
 * file. `EPIC-034` `T406v` and `EPIC-035` `T997w` both cite it by number.
 *
 * The four failures it must catch, from the contract §5:
 *   - a stage outside `LOOP_STAGES`;
 *   - a stage with no registered handler;
 *   - a trigger with no rule id (`FR-GEL-031`, `RULE-11`);
 *   - absent `approvedBy`/`approvalRef` (`FR-GEL-016`, `R-030-7`).
 *
 * Each is asserted against a synthetic bad configuration as well as against the
 * real files, because a check that has only ever seen valid input has never been
 * shown to fail.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';

const here = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = resolve(here, '../../../packages/loop-contract/workflows');

interface LoopConfigFile {
  schemaVersion?: unknown;
  workflowType?: unknown;
  stages?: unknown;
  transitions?: unknown;
  approvedBy?: unknown;
  approvalRef?: unknown;
}

interface ConfigTransition {
  from?: unknown;
  to?: unknown;
  requiredGates?: unknown;
  trigger?: unknown;
}

/**
 * The rule, in one function, so the assertions below and any future caller
 * cannot drift apart. Returns every violation rather than the first: a
 * configuration with three faults should report three, or fixing it becomes an
 * unbounded number of rounds.
 */
export function conformanceViolations(
  config: LoopConfigFile,
  registeredStages: readonly string[] = LOOP_STAGES,
): string[] {
  const problems: string[] = [];

  if (config.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (typeof config.workflowType !== 'string' || config.workflowType.length === 0) {
    problems.push('workflowType is required');
  }

  // FR-GEL-016 / R-030-7 — both, or the configuration does not load. A
  // configuration nobody approved is a governed workflow nobody authorised.
  if (typeof config.approvedBy !== 'string' || config.approvedBy.length === 0) {
    problems.push('approvedBy is required (FR-GEL-016)');
  }
  if (typeof config.approvalRef !== 'string' || config.approvalRef.length === 0) {
    problems.push('approvalRef is required (FR-GEL-016)');
  }

  const stages = Array.isArray(config.stages) ? config.stages : [];
  if (stages.length === 0) problems.push('stages must be a non-empty array');

  for (const stage of stages) {
    // FR-GEL-007 — outside the vocabulary.
    if (typeof stage !== 'string' || !(LOOP_STAGES as readonly string[]).includes(stage)) {
      problems.push(`stage "${String(stage)}" is not one of LOOP_STAGES (FR-GEL-007)`);
      continue;
    }
    // FR-GEL-007 / R-030-5 — named but unhandled. There is no no-op default: a
    // no-op Decide handler is an auto-approval wearing a placeholder's name.
    if (!registeredStages.includes(stage)) {
      problems.push(`stage "${stage}" has no registered StageHandler (FR-GEL-007)`);
    }
  }

  // FR-GEL-009 — programme-defined order. A file listing Decide before Analyze
  // would render a progress projection that disagrees with the model.
  const order = stages
    .filter((s): s is string => typeof s === 'string')
    .map((s) => (LOOP_STAGES as readonly string[]).indexOf(s));
  if (order.some((n, i) => i > 0 && n <= (order[i - 1] ?? -1))) {
    problems.push('stages must appear in LOOP_STAGES order (FR-GEL-009)');
  }

  const transitions = Array.isArray(config.transitions) ? config.transitions : [];
  for (const raw of transitions) {
    const t = raw as ConfigTransition;
    for (const end of ['from', 'to'] as const) {
      const value = t[end];
      if (typeof value !== 'string' || !stages.includes(value)) {
        problems.push(`transition ${end} "${String(value)}" is not a configured stage`);
      }
    }
    if (!Array.isArray(t.requiredGates)) {
      problems.push('transition requiredGates must be an array (FR-GEL-020)');
    }
    // FR-GEL-031, RULE-11 — a trigger is null, or it names its rule. "Present
    // but anonymous" is the invisible automation the rule forbids.
    if (t.trigger !== null && t.trigger !== undefined) {
      const rule = (t.trigger as { ruleId?: unknown }).ruleId;
      if (typeof rule !== 'string' || rule.length === 0) {
        problems.push('an automated transition must name its trigger rule (FR-GEL-031)');
      }
    }
  }

  return problems;
}

const VALID = {
  schemaVersion: 1,
  workflowType: 'probe-type',
  stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
  transitions: [{ from: 'Analyze', to: 'Decide', requiredGates: ['probe-gate'], trigger: null }],
  approvedBy: 'u_approver',
  approvalRef: 'commit_abc',
};

describe('T931 · the conformance check can fail — each of the four faults', () => {
  it('accepts a conforming configuration, or every assertion below means nothing', () => {
    expect(conformanceViolations(VALID, LOOP_STAGES)).toEqual([]);
  });

  it('fails on a stage outside LOOP_STAGES (FR-GEL-007)', () => {
    const bad = { ...VALID, stages: ['Event', 'Triage', 'Outcome'] };
    expect(conformanceViolations(bad, LOOP_STAGES).join(' ')).toMatch(/not one of LOOP_STAGES/);
  });

  it('fails on a stage with no registered handler (FR-GEL-007, R-030-5)', () => {
    // Every stage is in the vocabulary; `Decide` simply has nothing to run it.
    const registered = ['Event', 'Analyze', 'Outcome'];
    expect(conformanceViolations(VALID, registered).join(' ')).toMatch(
      /"Decide" has no registered StageHandler/,
    );
  });

  it('fails on a trigger with no rule id (FR-GEL-031, RULE-11)', () => {
    const bad = {
      ...VALID,
      transitions: [{ from: 'Analyze', to: 'Decide', requiredGates: [], trigger: {} }],
    };
    expect(conformanceViolations(bad, LOOP_STAGES).join(' ')).toMatch(/must name its trigger rule/);
  });

  it('fails on an absent approvedBy or approvalRef (FR-GEL-016)', () => {
    const noApprover = { ...VALID, approvedBy: '' };
    const noRef = { ...VALID, approvalRef: undefined };
    expect(conformanceViolations(noApprover, LOOP_STAGES).join(' ')).toMatch(/approvedBy is required/);
    expect(conformanceViolations(noRef, LOOP_STAGES).join(' ')).toMatch(/approvalRef is required/);
  });

  it('fails on stages listed out of model order (FR-GEL-009)', () => {
    const bad = { ...VALID, stages: ['Event', 'Decide', 'Analyze', 'Outcome'] };
    expect(conformanceViolations(bad, LOOP_STAGES).join(' ')).toMatch(/in LOOP_STAGES order/);
  });

  it('reports every violation, not just the first', () => {
    const bad = { ...VALID, approvedBy: '', approvalRef: '', stages: ['Triage'] };
    expect(conformanceViolations(bad, LOOP_STAGES).length).toBeGreaterThanOrEqual(3);
  });
});

describe('T932 · every file in packages/loop-contract/workflows/ conforms', () => {
  const files = existsSync(WORKFLOWS)
    ? readdirSync(WORKFLOWS).filter((name) => name.endsWith('.json') && name !== 'schema.json')
    : [];

  it('finds configuration files to check, or this proves nothing', () => {
    // Anti-vacuity. An empty directory would make the loop below pass forever
    // — the exact shape of "two Vitest projects passed with no test files"
    // recorded in epic-stage/harness.spec.ts.
    expect(files.length, `no configuration files found in ${WORKFLOWS}`).toBeGreaterThan(0);
  });

  it.each(files)('%s conforms to the loop configuration contract', (name) => {
    const config = JSON.parse(readFileSync(join(WORKFLOWS, name), 'utf8')) as LoopConfigFile;
    // Checked against the full vocabulary: a real handler registry is the
    // engine's concern at load time (FR-GEL-007), and this check is about the
    // file, not about which handlers happen to be wired in a given process.
    expect(conformanceViolations(config, LOOP_STAGES)).toEqual([]);
  });

  it.each(files)('%s names the file after its workflowType', (name) => {
    const config = JSON.parse(readFileSync(join(WORKFLOWS, name), 'utf8')) as LoopConfigFile;
    expect(`${String(config.workflowType)}.json`).toBe(name);
  });
});
