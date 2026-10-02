/**
 * `T1346` (EPIC-041) — the worker's initialise step for a local workspace.
 *
 * `R-041-1`, `R-041-9`, `FR-LPW-008`. The prepare half ran in the API and
 * queued this; the consumer runs the injected initialiser on the job's
 * workspace and hands the outcome — the steps completed, the files written, the
 * tag and bundle used, or the failed step with a sanitised reason — to the
 * platform to record through `@pmi/backend/worker-api`. This file names no
 * engine: the initialiser is composed at the root.
 *
 * Unit test: `worker/tests/unit/provisioning-consumer.spec.ts` (T1343).
 */
import type { ConsumeResult } from './generation.consumer.js';

export type InitialiseStep = 'run_engine_init' | 'copy_extension' | 'register_hooks' | 'verify_structure';

export interface WorkspaceToInitialise {
  readonly writePath: string;
  readonly agentIntegration: string;
  readonly scriptType: 'sh' | 'ps';
  readonly engineTag: string;
  readonly bundleVersion: string;
}

export interface InitialiseJobDescription {
  readonly jobId: string;
  readonly kind: 'initialise_workspace';
  readonly workspace: WorkspaceToInitialise;
}

export type InitialiseOutcome =
  | { readonly ok: true; readonly stepsCompleted: readonly InitialiseStep[]; readonly filesWritten: readonly string[] }
  | {
      readonly ok: false;
      readonly failedStep: InitialiseStep;
      readonly reason: string;
      readonly stepsCompleted: readonly InitialiseStep[];
      readonly filesWritten: readonly string[];
    };

/** What the initialiser (the Spec Kit adapter's) is asked for. */
export interface LocalInitialiserPort {
  initialise(input: WorkspaceToInitialise & { directory: string; extensionDir: string }): Promise<InitialiseOutcome>;
}

/** What the platform records (`finaliseInitialisation` in the barrel). */
export type FinalisedOutcome = InitialiseOutcome & { readonly engineTag: string; readonly bundleVersion: string };

export interface ProvisioningConsumerDeps {
  readonly initialiser: LocalInitialiserPort;
  readonly finalise: (jobId: string, outcome: FinalisedOutcome) => Promise<void>;
  /** The bundle's extension half, resolved at the root. */
  readonly extensionDir: () => string;
}

export interface ProvisioningConsumer {
  run(job: InitialiseJobDescription): Promise<ConsumeResult>;
}

export function createProvisioningConsumer(deps: ProvisioningConsumerDeps): ProvisioningConsumer {
  return {
    async run(job) {
      if (job.kind !== 'initialise_workspace') {
        throw new Error(`The provisioning consumer handles initialise_workspace jobs only; job "${job.jobId}" is "${String(job.kind)}".`);
      }
      const { workspace } = job;
      let outcome: InitialiseOutcome;
      try {
        outcome = await deps.initialiser.initialise({
          ...workspace,
          directory: workspace.writePath,
          extensionDir: deps.extensionDir(),
        });
      } catch (error) {
        // An initialiser that throws is a failed first step, not a crashed
        // worker: the project must read *failed* with a reason, and the queue
        // must not retry a directory it half-wrote.
        outcome = {
          ok: false,
          failedStep: 'run_engine_init',
          reason: String((error as Error).message ?? error).split(workspace.writePath).join('<project>').slice(0, 500),
          stepsCompleted: [],
          filesWritten: [],
        };
      }
      await deps.finalise(job.jobId, { ...outcome, engineTag: workspace.engineTag, bundleVersion: workspace.bundleVersion });
      return outcome.ok ? { state: 'succeeded' } : { state: 'failed', failureReason: 'engine_error' };
    },
  };
}
