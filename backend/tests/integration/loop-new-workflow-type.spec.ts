/**
 * T946 — quickstart Scenario 1, and `SC-GEL-001`.
 *
 * *A workflow type this Epic's code does not name runs end to end by
 * configuration alone.* That is `BR-0064` — *"governed workflows MUST be
 * configurable instances of the common model"* — stated as something that can
 * fail.
 *
 * The claim has two halves and both are asserted here, because either alone is
 * cheap to satisfy and worthless:
 *
 *   1. **It runs.** A type declared only in a JSON file loads, resolves its own
 *      stages and gates, and produces a governed object at `Event`.
 *   2. **Zero lines of new engine code.** No file under
 *      `backend/src/modules/loop/` names the type. A loop with a `switch` on
 *      workflow type would pass the first half forever.
 *
 * The second is the one that decays. A special case added for one Room, six
 * months from now, would leave every other test green.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { LoopService } from '../../src/modules/loop/loop.service.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { authoritiesOf, directoryOf } from '../helpers/loop-principals.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_SRC = resolve(here, '../../src/modules/loop');

/**
 * A workflow type invented in this file and nowhere else.
 *
 * Not `requirement-room` or any real Room: those names appear in comments across
 * the repository, so a scan for them would be noise. This one exists only here,
 * which makes the "zero lines of new engine code" assertion mean exactly what it
 * says.
 */
const INVENTED_TYPE = 'procurement-approval';

const INVENTED_CONFIG = {
  schemaVersion: 1,
  workflowType: INVENTED_TYPE,
  stages: ['Event', 'Context', 'Decide', 'Outcome'],
  transitions: [
    { from: 'Event', to: 'Context', requiredGates: [], trigger: { ruleId: 'intake-complete' } },
    { from: 'Context', to: 'Decide', requiredGates: ['procurement-threshold'], trigger: null },
    { from: 'Decide', to: 'Outcome', requiredGates: [], trigger: null },
  ],
  approvedBy: 'u_finance_lead',
  approvalRef: 'commit_procurement_v1',
};

function handler(stage: StageHandler['stage']): StageHandler {
  return { stage, async enter() { return { ok: true }; } };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('T946 · Scenario 1 — a type the engine does not name runs by configuration alone', () => {
  const stages = new StageRegistry(LOOP_STAGES.map(handler));
  const config = loadLoopConfig(INVENTED_CONFIG, { registeredStages: stages.registeredStages });
  const ACTORS = { u_1: { workspaceId: 'ws_1', authorities: [] } } as const;
  const ACTING = { workspaceId: 'ws_1', userId: 'u_1' };
  const service = new LoopService(
    new InMemoryLoopStore(),
    new LoopConfigRegistry([config]),
    {},
    undefined,
    directoryOf(ACTORS),
    authoritiesOf(ACTORS),
  );

  it('loads a configuration written entirely in a file', () => {
    expect(config.workflowType).toBe(INVENTED_TYPE);
    expect(config.stages).toEqual(['Event', 'Context', 'Decide', 'Outcome']);
  });

  it('carries the type\'s own gates, which no engine file knows about', () => {
    expect(config.transitionFor('Context', 'Decide')?.requiredGates).toEqual([
      'procurement-threshold',
    ]);
  });

  it('carries the type\'s own automation rule (FR-GEL-031)', () => {
    expect(config.transitionFor('Event', 'Context')?.trigger).toEqual({
      ruleId: 'intake-complete',
    });
  });

  it('declares a governed object of that type, at Event (FR-GEL-006)', async () => {
    const ref = await service.declareObject(ACTING, {
      projectId: 'p_1',
      workflowType: INVENTED_TYPE,
      subjectType: 'purchase-order',
      subjectId: 'po_42',
    });
    expect(ref.workflowType).toBe(INVENTED_TYPE);
    expect(ref.objectId).toMatch(/[0-9a-f-]{36}/);
  });

  it('projects its progress in the one shared vocabulary (FR-GEL-051)', () => {
    const rows = service.progressForConfig(config, {
      currentStage: 'Context',
      completedStages: ['Event'],
    });
    expect(rows).toHaveLength(8);
    // Four stages this type does not use, visible rather than absent.
    expect(rows.filter((r) => r.omitted).map((r) => r.stage)).toEqual([
      'Analyze',
      'Execute',
      'Verify',
      'Evidence',
    ]);
  });

  it('refuses a type nobody configured, rather than improvising one', async () => {
    await expect(
      service.declareObject(ACTING, {
        projectId: 'p_1',
        workflowType: 'not-configured',
        subjectType: 'x',
        subjectId: 'y',
      }),
    ).rejects.toThrow(/not-configured/);
  });
});

describe('SC-GEL-001 · zero lines of new engine code', () => {
  const files = walk(ENGINE_SRC).map((p) => ({
    rel: relative(ENGINE_SRC, p),
    body: readFileSync(p, 'utf8'),
  }));

  it('has engine sources to scan, or the assertion below proves nothing', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it('names the invented workflow type in no engine file', () => {
    const offenders = files.filter((f) => f.body.includes(INVENTED_TYPE));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('names the invented type\'s gate and rule in no engine file', () => {
    // The subtler version of the same failure: not a `switch` on the type, but
    // a special case keyed on one of its gates.
    const offenders = files.filter(
      (f) => f.body.includes('procurement-threshold') || f.body.includes('intake-complete'),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('branches on no workflow type at all', () => {
    // What a `switch (workflowType)` looks like however it is spelled. The
    // engine resolves a type's configuration; it never asks which type it is.
    const offenders = files.filter((f) =>
      /switch\s*\(\s*[\w.]*workflowType|workflowType\s*===\s*['"]/.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('would notice a special case if one were added — the check checks itself', () => {
    const planted = `if (object.workflowType === 'procurement-approval') { skipGates(); }`;
    expect(/workflowType\s*===\s*['"]/.test(planted)).toBe(true);
    expect(planted.includes(INVENTED_TYPE)).toBe(true);
  });
});
