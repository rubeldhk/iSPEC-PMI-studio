/**
 * `T1336` (EPIC-041) — the provisioning vocabulary: steps, states, outcomes.
 *
 * `data-model.md` §1.1 and §2.1. Eleven steps in a fixed order, shared between
 * the API's prepare step and the worker's initialise step so a resumed run knows
 * where the previous one stopped. The bar between the seventh and eighth is the
 * process boundary (`R-041-1`): nothing before it names an engine.
 *
 * `prepared` and `initialisation_pending` are DIFFERENT facts — one says *wait
 * for the worker*, the other *run the setup skill* — and the screen shows them
 * differently (`FR-LPW-051`). A single "pending" would send the user to the
 * skill while the worker was still working.
 *
 * Framework-free (PC-1). Unit test: `backend/tests/unit/projects/provisioning-types.spec.ts`.
 */

export const PROVISIONING_STATES = Object.freeze([
  'not_provisioned',
  'prepared',
  'initialisation_pending',
  'provisioned',
  'failed',
] as const);
export type ProvisioningState = (typeof PROVISIONING_STATES)[number];

/** The API's half. Names no engine. */
export const PREPARE_STEPS = Object.freeze([
  'check_root',
  'create_directory',
  'adopt_or_init_git',
  'write_project_json',
  'merge_mcp_json',
  'copy_setup_skill',
  'queue_initialise',
] as const);

/** The worker's half, or the setup skill's. */
export const INITIALISE_STEPS = Object.freeze([
  'run_engine_init',
  'copy_extension',
  'register_hooks',
  'verify_structure',
] as const);

export const PROVISIONING_STEPS = Object.freeze([...PREPARE_STEPS, ...INITIALISE_STEPS] as const);
export type ProvisioningStep = (typeof PROVISIONING_STEPS)[number];

export const PROVISIONING_OUTCOMES = Object.freeze(['succeeded', 'no_change', 'pending', 'failed'] as const);
export type ProvisioningOutcome = (typeof PROVISIONING_OUTCOMES)[number];

/** One attempt. Append-only; the project's state is a projection of the latest. */
export interface ProvisioningRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  /** Always a human: the setup skill's report arrives through EPIC-043 and names the connector. */
  readonly actorId: string;
  readonly correlationId: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly outcome: ProvisioningOutcome;
  readonly stepsCompleted: readonly ProvisioningStep[];
  /** Required when `outcome === 'failed'` — the database CHECKs it too. */
  readonly failedStep: ProvisioningStep | null;
  /** Sanitised: never a path outside the root, never a credential. */
  readonly failureReason: string | null;
  readonly engineTag: string | null;
  readonly bundleVersion: string | null;
  /** Relative paths, so a partial run is inspectable (US1 scenario 5). */
  readonly filesWritten: readonly string[];
  /** EPIC-042 (R-042-8): `.pmi/first-run` was written by this run. */
  readonly firstRunMarkerWritten: boolean;
}

/** The first step not yet completed, in vocabulary order — or null when all are. */
export function nextStep(completed: readonly ProvisioningStep[]): ProvisioningStep | null {
  const done = new Set(completed);
  for (const step of PROVISIONING_STEPS) {
    if (!done.has(step)) return step;
  }
  return null;
}

/**
 * What a record says the project now is. `null` for `no_change`, because a
 * no-op run has no opinion — the caller keeps the state it had.
 */
export function stateAfter(record: ProvisioningRecord): ProvisioningState | null {
  switch (record.outcome) {
    case 'failed':
      return 'failed';
    case 'pending':
      return 'initialisation_pending';
    case 'no_change':
      return null;
    case 'succeeded':
      return record.stepsCompleted.includes('verify_structure') ? 'provisioned' : 'prepared';
  }
}

const TRANSITIONS: Readonly<Record<ProvisioningState, readonly ProvisioningState[]>> = Object.freeze({
  not_provisioned: ['prepared', 'failed'],
  prepared: ['provisioned', 'initialisation_pending', 'failed'],
  // A resume (the setup skill, or a worker that arrived late) goes straight to
  // provisioned; a re-run of the prepare half goes back through prepared.
  initialisation_pending: ['provisioned', 'prepared', 'failed'],
  failed: ['prepared', 'provisioned', 'initialisation_pending'],
  // Provisioned is terminal. Only a no-op leaves it where it is.
  provisioned: ['provisioned'],
});

export function canTransition(from: ProvisioningState, to: ProvisioningState): boolean {
  return TRANSITIONS[from].includes(to);
}
