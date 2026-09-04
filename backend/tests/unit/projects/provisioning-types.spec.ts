/**
 * `T1335` (EPIC-041) — the step vocabulary and the states between them.
 *
 * `data-model.md` §1.1, §2.1. Eleven steps in a fixed order, with the process
 * boundary after the seventh; five states of which `prepared` and
 * `initialisation_pending` are DIFFERENT facts; `failed` reachable from any
 * non-terminal state and never without a step; a resumed run starting at the
 * first step the previous one did not complete.
 *
 * Written to FAIL before `T1336` exists.
 */
import { describe, expect, it } from 'vitest';
import {
  INITIALISE_STEPS,
  PREPARE_STEPS,
  PROVISIONING_OUTCOMES,
  PROVISIONING_STATES,
  PROVISIONING_STEPS,
  canTransition,
  nextStep,
  stateAfter,
  type ProvisioningRecord,
} from '../../../src/modules/projects/provisioning.types.js';

const record = (over: Partial<ProvisioningRecord> = {}): ProvisioningRecord => ({
  id: 'prov_1',
  workspaceId: 'ws',
  projectId: 'pr',
  actorId: 'u',
  correlationId: 'c',
  startedAt: new Date(),
  endedAt: new Date(),
  outcome: 'succeeded',
  stepsCompleted: [...PREPARE_STEPS],
  failedStep: null,
  failureReason: null,
  engineTag: null,
  bundleVersion: '0.1.0',
  filesWritten: [],
  ...over,
});

describe('T1335 · the vocabulary', () => {
  it('has eleven steps, seven before the process boundary and four after', () => {
    expect(PREPARE_STEPS).toEqual([
      'check_root',
      'create_directory',
      'adopt_or_init_git',
      'write_project_json',
      'merge_mcp_json',
      'copy_setup_skill',
      'queue_initialise',
    ]);
    expect(INITIALISE_STEPS).toEqual(['run_engine_init', 'copy_extension', 'register_hooks', 'verify_structure']);
    expect(PROVISIONING_STEPS).toEqual([...PREPARE_STEPS, ...INITIALISE_STEPS]);
  });

  it('has five states and four outcomes', () => {
    expect([...PROVISIONING_STATES]).toEqual(['not_provisioned', 'prepared', 'initialisation_pending', 'provisioned', 'failed']);
    expect([...PROVISIONING_OUTCOMES]).toEqual(['succeeded', 'no_change', 'pending', 'failed']);
  });
});

describe('T1335 · nextStep resumes at the first incomplete step', () => {
  it('starts at check_root for a fresh run', () => {
    expect(nextStep([])).toBe('check_root');
  });

  it('resumes after the last completed step, never repeating create_directory', () => {
    expect(nextStep(['check_root', 'create_directory', 'adopt_or_init_git', 'write_project_json'])).toBe('merge_mcp_json');
  });

  it('is null when every step is done', () => {
    expect(nextStep([...PROVISIONING_STEPS])).toBeNull();
  });
});

describe('T1335 · stateAfter reads the record, and prepared is not pending', () => {
  it('a succeeded prepare-only record is prepared', () => {
    expect(stateAfter(record())).toBe('prepared');
  });

  it('a succeeded record through verify_structure is provisioned', () => {
    expect(stateAfter(record({ stepsCompleted: [...PROVISIONING_STEPS] }))).toBe('provisioned');
  });

  it('a pending record is initialisation_pending — a different fact from prepared', () => {
    expect(stateAfter(record({ outcome: 'pending' }))).toBe('initialisation_pending');
  });

  it('a failed record is failed', () => {
    expect(stateAfter(record({ outcome: 'failed', failedStep: 'merge_mcp_json', stepsCompleted: ['check_root', 'create_directory'] }))).toBe('failed');
  });

  it('no_change leaves the state to the caller', () => {
    expect(stateAfter(record({ outcome: 'no_change' }))).toBeNull();
  });
});

describe('T1335 · transitions', () => {
  it('failed is reachable from every non-terminal state', () => {
    for (const from of ['not_provisioned', 'prepared', 'initialisation_pending'] as const) {
      expect(canTransition(from, 'failed')).toBe(true);
    }
  });

  it('prepared goes to provisioned or pending; pending goes to provisioned; failed and pending resume', () => {
    expect(canTransition('prepared', 'provisioned')).toBe(true);
    expect(canTransition('prepared', 'initialisation_pending')).toBe(true);
    expect(canTransition('initialisation_pending', 'provisioned')).toBe(true);
    expect(canTransition('failed', 'prepared')).toBe(true);
    expect(canTransition('initialisation_pending', 'prepared')).toBe(true);
  });

  it('nothing goes back to not_provisioned, and provisioned only stays provisioned', () => {
    expect(canTransition('prepared', 'not_provisioned')).toBe(false);
    expect(canTransition('provisioned', 'prepared')).toBe(false);
    expect(canTransition('provisioned', 'provisioned')).toBe(true);
  });
});
