/**
 * `T1551` (EPIC-044, `FR-EPB-011`, `R-044-2`) — the stage configuration is a
 * document the package reads, with the register's seven stages unchanged and
 * the product's two extra stages beside them. Written to FAIL before `T1553`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadStageConfig, packageVersion, productProfile } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(here, '..');

describe('T1551 · the configuration document', () => {
  const config = loadStageConfig();

  it('keeps exactly seven register stages, each naming the governed command that reaches it', () => {
    expect(config.stages).toHaveLength(7);
    expect(config.stages.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(config.stages.map((s) => [s.name, s.reachedBy])).toEqual([
      ['Specified', 'specify'],
      ['Clarified', 'clarify'],
      ['Checklisted', 'checklist'],
      ['Planned', 'plan'],
      ['Tasked', 'tasks'],
      ['Analyzed', 'analyze'],
      ['Ready', null],
    ]);
  });

  it('adds Implementing and Converged as product stages with their evidence and next command', () => {
    expect(config.productStages.map((s) => [s.order, s.name, s.reachedBy, s.next])).toEqual([
      [8, 'Implementing', 'implement', '/speckit-converge'],
      [9, 'Converged', 'converge', '—'],
    ]);
    for (const stage of config.productStages) expect(stage.evidence, `${stage.name} states no evidence`).toBeTruthy();
  });

  it('names the state before the first stage and the first command to run, so the product names no command in code (FR-EPB-003)', () => {
    expect(config.notStarted).toEqual({ name: 'Not started', next: '/speckit-specify' });
  });

  it('names the two readiness profiles: the repository evaluates the DOR, a customer project evaluates nothing yet (FR-EPB-046)', () => {
    expect(config.readinessProfiles).toEqual({ repository: 'dor', customer: 'none' });
  });

  it('productProfile() is the seven stages followed by the two, by order', () => {
    const profile = productProfile(config);
    expect(profile.map((s) => s.name)).toEqual(['Specified', 'Clarified', 'Checklisted', 'Planned', 'Tasked', 'Analyzed', 'Ready', 'Implementing', 'Converged']);
    expect(profile.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('packageVersion() is the manifest version (FR-EPB-012)', () => {
    const manifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as { version: string };
    expect(packageVersion()).toBe(manifest.version);
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reads its own file by default, and a given path when asked', () => {
    const own = loadStageConfig();
    const explicit = loadStageConfig(join(PKG_DIR, 'epic-stage.config.json'));
    expect(explicit).toEqual(own);
  });
});
