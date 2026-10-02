/**
 * `T1552` (EPIC-044) — `G-44-01`: the two copies of the stage configuration are
 * one document.
 *
 * `R-044-2`: the canonical file lives in `packages/epic-stage/` because the
 * platform runs where `governance/` does not exist; `governance/epic-stage.config.json`
 * stays because every reference since `EPIC-026` names it. Two files kept
 * identical by a failing test is a conformance check; two files nobody compares
 * is the drift `R-06` forbids. Written to FAIL before `T1553`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const CANONICAL = join(REPO_ROOT, 'packages', 'epic-stage', 'epic-stage.config.json');
const MIRROR = join(REPO_ROOT, 'governance', 'epic-stage.config.json');

describe('G-44-01 · governance/epic-stage.config.json mirrors the package file byte for byte', () => {
  it('the two files are identical', () => {
    const canonical = readFileSync(CANONICAL, 'utf8');
    const mirror = readFileSync(MIRROR, 'utf8');
    expect(mirror).toBe(canonical);
  });

  it('the canonical file carries reachedBy on every register stage and the two product stages', () => {
    const config = JSON.parse(readFileSync(CANONICAL, 'utf8')) as { stages: { reachedBy?: string | null }[]; productStages: { name: string }[] };
    expect(config.stages).toHaveLength(7);
    for (const stage of config.stages) expect(stage).toHaveProperty('reachedBy');
    expect(config.productStages.map((s) => s.name)).toEqual(['Implementing', 'Converged']);
  });
});
