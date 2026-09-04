/**
 * `T1342` (EPIC-041) — the prepare step: a project becomes a directory.
 *
 * `FR-LPW-002`–`FR-LPW-013`, `R-041-1`, `R-041-2`, `R-041-9`, `R-041-10`. Seven
 * steps, in the fixed vocabulary order, each recorded as it completes so an
 * interrupted run resumes at the first step the previous one did not finish and
 * never repeats a destructive one. Nothing here names an engine: initialising
 * The engine's own initialiser is the worker's step, queued as the seventh, and a host with no
 * worker leaves the project honestly *initialisation pending* (`refresh()`).
 *
 * Refusals write a `failed` record naming the step and the reason, then throw
 * — so the screen shows what happened and the caller gets the status the
 * contract promises. Every refusal leaves zero files behind: the checks that
 * can refuse run before the first write.
 *
 * Framework-free (PC-1). Wired in `projects.module.ts`.
 * Unit tests: `provisioning.service.spec.ts` (T1339), `initialisation-pending.spec.ts` (T1347).
 */
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ConflictError, PlatformError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace } from '../../core/workspace.guard.js';
import type { AuditRecordInput } from '../audit/audit.service.js';
import type { JobRequest, SubmitResult } from '../jobs/jobs.service.js';
import { mcpServerEntry, mergeMcpJson, writeProjectJson } from './project-files.js';
import { assertRootAvailable, resolveRootPath, type ProjectsRootConfig } from './projects-root.js';
import type { ActingContext, ProjectRecord, ProjectStore } from './projects.service.js';
import type { ProvisioningRecordStore } from './provisioning.store.js';
import {
  INITIALISE_STEPS,
  PREPARE_STEPS,
  nextStep,
  stateAfter,
  type ProvisioningRecord,
  type ProvisioningState,
  type ProvisioningStep,
} from './provisioning.types.js';

// ------------------------------------------------------------------- ports

/** Just enough of `JobsService`. Null means no queue exists on this host. */
export interface InitialiseJobPort {
  submit(req: JobRequest): Promise<SubmitResult>;
}

/** Just enough of the job ledger to know whether anyone claimed the job. */
export interface InitialiseJobLedgerPort {
  listForProject(
    workspaceId: string,
    projectId: string,
  ): Promise<{ id: string; kind: string; state: string; createdAt: Date; startedAt: Date | null }[]>;
}

/** `@pmi/workspace-bundle`, by shape — so a test can supply a temp directory. */
export interface WorkspaceBundlePort {
  /** The integration used when a request names none — the bundle's, not the API's (`FR-LPW-006`). */
  readonly defaultIntegration: string;
  readonly version: string;
  skillsDir(): string;
  skillsPathFor(integration: string): { ok: true; path: string } | { ok: false; reason: string };
}

export interface GitPort {
  init(directory: string): Promise<void>;
}

export interface AuditPort {
  record(input: AuditRecordInput): Promise<void>;
}

export interface ProvisioningDeps {
  readonly config: ProjectsRootConfig;
  readonly projects: ProjectStore;
  readonly records: ProvisioningRecordStore;
  readonly jobs: InitialiseJobPort | null;
  readonly ledger?: InitialiseJobLedgerPort | null;
  readonly bundle: WorkspaceBundlePort;
  readonly git: GitPort;
  readonly audit?: AuditPort;
  readonly now?: () => Date;
  readonly newCorrelationId?: () => string;
}

export interface ProvisionRequest {
  readonly rootPath: string;
  readonly agentIntegration?: string;
  readonly scriptType?: 'sh' | 'ps';
}

export interface ProvisionResult {
  readonly project: ProjectRecord;
  readonly record: ProvisioningRecord;
}

/** A step refused or failed. Carries the step so the record can name it. */
class StepFailure extends Error {
  constructor(
    readonly step: ProvisioningStep,
    readonly inner: Error,
  ) {
    super(inner.message);
    this.name = 'StepFailure';
  }
}

export class ProvisioningService {
  private readonly now: () => Date;
  private readonly correlate: () => string;

  constructor(private readonly deps: ProvisioningDeps) {
    this.now = deps.now ?? ((): Date => new Date());
    this.correlate = deps.newCorrelationId ?? ((): string => randomUUID());
  }

  async history(workspaceId: string, projectId: string): Promise<ProvisioningRecord[]> {
    await this.project(workspaceId, projectId);
    return this.deps.records.listForProject(workspaceId, projectId);
  }

  /**
   * The refusals that need no project row: root unavailable, path outside the
   * root, path already owned. `POST /projects` asks this BEFORE creating the
   * row, so a refused root creates nothing (contracts/provisioning-api.md).
   */
  async check(ctx: ActingContext, request: ProvisionRequest): Promise<void> {
    await assertRootAvailable(this.deps.config);
    const resolved = resolveRootPath(this.deps.config, request.rootPath);
    const owner = await this.deps.projects.findByRootPath(ctx.workspaceId, resolved.hostPath);
    if (owner !== null) {
      throw new ConflictError(`The directory ${resolved.hostPath} already belongs to project "${owner.name}".`);
    }
  }

  /**
   * Prepare — or resume preparing — a project's directory.
   *
   * The resume rule: the latest record's completed steps are trusted and the
   * run starts at the first step not among them. `create_directory` is
   * therefore never repeated on a directory that already holds a first run's
   * files, which is what keeps an interruption from becoming a refusal.
   */
  async prepare(ctx: ActingContext, projectId: string, request: ProvisionRequest): Promise<ProvisionResult> {
    const project = await this.project(ctx.workspaceId, projectId);
    const startedAt = this.now();
    const correlationId = this.correlate();

    if (project.provisioningState === 'provisioned') {
      return { project, record: await this.append(ctx, project, correlationId, startedAt, 'no_change', [...PREPARE_STEPS, ...INITIALISE_STEPS], [], null) };
    }

    const previous = await this.deps.records.latestForProject(ctx.workspaceId, projectId);
    // What the previous run already did, and therefore what this one skips:
    //   failed    → its completed steps; resume at the first missing one.
    //   pending   → its completed steps minus the queue step, so a worker that
    //               exists now gets the job; the files are not rewritten.
    //   succeeded (prepared, waiting for the worker) → everything; no_change.
    const completed: ProvisioningStep[] =
      previous === null || project.rootPath === null
        ? []
        : [...previous.stepsCompleted].filter(
            (s) => (PREPARE_STEPS as readonly string[]).includes(s) && !(previous.outcome === 'pending' && s === 'queue_initialise'),
          );
    const attemptedBefore = completed.length;
    const written: string[] = [];

    // FR-LPW-005 (T1396): the request, then the project, then CONFIGURATION,
    // then the bundle's default and `sh` — never a provider named here.
    const agentIntegration =
      request.agentIntegration ?? project.agentIntegration ?? this.deps.config.defaultAgentIntegration ?? this.deps.bundle.defaultIntegration;
    const scriptType = request.scriptType ?? project.scriptType ?? this.deps.config.defaultScriptType ?? 'sh';
    let hostPath = project.rootPath;
    let writePath: string | undefined;

    const done = (step: ProvisioningStep): boolean => completed.includes(step);
    const finish = (step: ProvisioningStep): void => {
      if (!done(step)) completed.push(step);
    };
    const attempt = async (step: ProvisioningStep, work: () => Promise<void>): Promise<void> => {
      if (done(step)) return;
      try {
        await work();
      } catch (error) {
        throw new StepFailure(step, error instanceof Error ? error : new Error(String(error)));
      }
      finish(step);
    };

    let outcome: ProvisioningRecord['outcome'] = 'succeeded';
    try {
      // 1 — the root exists and the requested path lives under it (FR-LPW-005, FR-LPW-007).
      await attempt('check_root', async () => {
        await assertRootAvailable(this.deps.config);
        const resolved = resolveRootPath(this.deps.config, request.rootPath);
        const owner = await this.deps.projects.findByRootPath(ctx.workspaceId, resolved.hostPath);
        if (owner !== null && owner.id !== project.id) {
          throw new ConflictError(`The directory ${resolved.hostPath} already belongs to project "${owner.name}".`);
        }
        hostPath = resolved.hostPath;
        writePath = resolved.writePath;
      });
      // On resume the record carries the path; the first run just resolved it.
      if (writePath === undefined) writePath = resolveRootPath(this.deps.config, request.rootPath).writePath;
      const dir = writePath;

      // 2 — an empty directory, or an empty git repository, or nothing (FR-LPW-012).
      await attempt('create_directory', async () => {
        const entries = await listEntries(dir);
        if (entries === null) {
          await mkdir(dir, { recursive: true });
          return;
        }
        const others = entries.filter((e) => e !== '.git');
        if (others.length > 0) {
          throw new ValidationFailedError(
            `The project directory cannot be used: ${request.rootPath.trim()} is not empty (${others.length} entr${others.length === 1 ? 'y' : 'ies'}, e.g. ${others[0]}). Only an empty directory or an empty git repository may be adopted in this Epic.`,
            { fields: [{ field: 'rootPath', reason: 'not empty' }] },
          );
        }
      });

      // 3 — git is the durable substrate for local mode (FR-LPW-013, ADR-0009 as amended).
      await attempt('adopt_or_init_git', async () => {
        if (!(await exists(join(dir, '.git')))) await this.deps.git.init(dir);
      });

      // 4 — .pmi/project.json (FR-LPW-009).
      await attempt('write_project_json', async () => {
        written.push(
          await writeProjectJson(dir, {
            projectId: project.id,
            workspaceId: project.workspaceId,
            projectName: project.name,
            platformUrl: this.deps.config.publicUrl,
            agentIntegration,
            scriptType,
            engineTag: this.deps.config.engineTag,
            bundleVersion: this.deps.bundle.version,
            preparedAt: startedAt,
          }),
        );
      });

      // 5 — .mcp.json, merged (R-041-10).
      await attempt('merge_mcp_json', async () => {
        const result = await mergeMcpJson(
          dir,
          mcpServerEntry({ publicUrl: this.deps.config.publicUrl, mcpServerVersion: this.deps.config.mcpServerVersion }),
        );
        written.push(result.path);
      });

      // 6 — the setup skill, where THIS integration reads skills from (FR-LPW-006).
      await attempt('copy_setup_skill', async () => {
        const target = this.deps.bundle.skillsPathFor(agentIntegration);
        if (!target.ok) throw new ValidationFailedError(target.reason, { fields: [{ field: 'agentIntegration', reason: 'no skills directory mapped' }] });
        const source = join(this.deps.bundle.skillsDir(), 'setup-PMIStudio');
        await cp(source, join(dir, target.path, 'setup-PMIStudio'), { recursive: true });
        written.push(`${target.path}/setup-PMIStudio/SKILL.md`);
      });

      // 7 — hand the rest to the worker (R-041-1). No queue means nobody can take it.
      if (this.deps.jobs === null) {
        outcome = 'pending';
      } else {
        const jobs = this.deps.jobs;
        await attempt('queue_initialise', async () => {
          await jobs.submit({
            workspaceId: project.workspaceId,
            projectId: project.id,
            kind: 'initialise_workspace',
            requestedById: ctx.userId,
            // The initialiser is the tool that runs; its version is the tag it runs at.
            engineName: 'workspace-initialiser',
            engineVersion: this.deps.config.engineTag,
            correlationId,
            inputRefs: {
              workspace: {
                writePath: dir,
                agentIntegration,
                scriptType,
                engineTag: this.deps.config.engineTag,
                bundleVersion: this.deps.bundle.version,
              },
            },
          });
        });
      }
    } catch (error) {
      const failure = error instanceof StepFailure ? error : new StepFailure('check_root', error as Error);
      await this.append(ctx, project, correlationId, startedAt, 'failed', completed, written, failure, { hostPath, agentIntegration, scriptType });
      await this.deps.projects.update(ctx.workspaceId, project.id, {
        provisioningState: 'failed',
        ...(hostPath !== null && hostPath !== project.rootPath ? { rootPath: hostPath } : {}),
        agentIntegration,
        scriptType,
      });
      throw failure.inner;
    }

    // Every step was already done and nothing was queued again: a no-op, said so.
    if (outcome === 'succeeded' && completed.length === attemptedBefore && written.length === 0) outcome = 'no_change';

    const record = await this.append(ctx, project, correlationId, startedAt, outcome, completed, written, null, { hostPath, agentIntegration, scriptType });
    const state: ProvisioningState = stateAfter(record) ?? project.provisioningState;
    const updated = await this.deps.projects.update(ctx.workspaceId, project.id, {
      rootPath: hostPath,
      agentIntegration,
      scriptType,
      provisioningState: state,
    });
    return { project: updated, record };
  }

  /**
   * `FR-LPW-010` — a prepared project whose initialise job nobody has claimed
   * within the bound reads *initialisation pending*. Derived from the ledger,
   * so it is true whenever it is read and needs no timer to survive a restart.
   */
  async refresh(workspaceId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.project(workspaceId, projectId);
    if (project.provisioningState !== 'prepared' || !this.deps.ledger) return project;

    const jobs = await this.deps.ledger.listForProject(workspaceId, projectId);
    const job = jobs.filter((j) => j.kind === 'initialise_workspace').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (job === undefined || job.state !== 'queued' || job.startedAt !== null) return project;
    if (this.now().getTime() - job.createdAt.getTime() <= this.deps.config.initialiseWaitMs) return project;

    const latest = await this.deps.records.latestForProject(workspaceId, projectId);
    const completed = latest?.stepsCompleted ?? [...PREPARE_STEPS];
    await this.append({ workspaceId, userId: latest?.actorId ?? project.ownerUserId }, project, this.correlate(), this.now(), 'pending', [...completed], [], null);
    return this.deps.projects.update(workspaceId, projectId, { provisioningState: 'initialisation_pending' });
  }

  // ---------------------------------------------------------------- helpers

  private async project(workspaceId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.deps.projects.findById(projectId);
    assertSameWorkspace(workspaceId, project, { targetType: 'project' });
    return project as ProjectRecord;
  }

  private async append(
    ctx: ActingContext,
    project: ProjectRecord,
    correlationId: string,
    startedAt: Date,
    outcome: ProvisioningRecord['outcome'],
    completed: readonly ProvisioningStep[],
    written: readonly string[],
    failure: StepFailure | null,
    // FR-LPW-004 (T1395): what the attempt was about, for the audit entry. The
    // path is the host's, never the write root; defaults to the project's own.
    about: { hostPath: string | null; agentIntegration: string | null; scriptType: string | null } = {
      hostPath: project.rootPath,
      agentIntegration: project.agentIntegration,
      scriptType: project.scriptType,
    },
  ): Promise<ProvisioningRecord> {
    const record = await this.deps.records.append({
      id: randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      actorId: ctx.userId,
      correlationId,
      startedAt,
      endedAt: this.now(),
      outcome,
      stepsCompleted: [...completed],
      failedStep: failure?.step ?? null,
      failureReason: failure === null ? null : this.sanitise(failure.inner.message),
      engineTag: completed.includes('write_project_json') ? this.deps.config.engineTag : null,
      bundleVersion: this.deps.bundle.version,
      filesWritten: [...written],
    });
    await this.deps.audit?.record({
      workspaceId: project.workspaceId,
      actorId: ctx.userId,
      // 'update' — the closed AuditAction vocabulary has no 'provision'; the detail says which update.
      action: 'update',
      targetType: 'project',
      targetId: project.id,
      outcome: outcome === 'failed' ? 'refused' : 'success',
      detail: {
        kind: 'provision',
        outcome,
        path: about.hostPath,
        agentIntegration: about.agentIntegration,
        scriptType: about.scriptType,
        stepsCompleted: [...completed],
        ...(failure ? { failedStep: failure.step } : {}),
        nextStep: nextStep(completed),
      },
    });
    return record;
  }

  /** Never a path outside the root, never a credential (data-model.md §2). */
  private sanitise(message: string): string {
    let text = message.replace(/pmi_ct_[A-Za-z0-9_-]{20,}/g, '<credential>');
    if (this.deps.config.root) text = text.split(this.deps.config.root).join('<root>');
    if (this.deps.config.hostRoot) text = text.split(this.deps.config.hostRoot).join('<root>');
    return text.slice(0, 500);
  }
}

/** Entries of a directory, or null when it does not exist. */
async function listEntries(directory: string): Promise<string[] | null> {
  try {
    const s = await stat(directory);
    if (!s.isDirectory()) {
      throw new ValidationFailedError(`The project directory cannot be used: a file already exists at ${directory}.`, {
        fields: [{ field: 'rootPath', reason: 'not a directory' }],
      });
    }
    return await readdir(directory);
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** `git init`, as a tool on PATH. Composed at the root; tests inject a fake. */
export async function gitInit(directory: string): Promise<void> {
  const { execFile } = await import('node:child_process');
  await new Promise<void>((resolve, reject) => {
    execFile('git', ['init', '--quiet'], { cwd: directory }, (error) => (error ? reject(error) : resolve()));
  });
}
