/**
 * `T1345` (EPIC-041) — initialise a project directory for Spec Kit, on the host.
 *
 * `R-041-8`, `R-041-9`, `FR-LPW-006`, `FR-LPW-008`. The one place outside
 * `worker/` and the workspace bundle that names Spec Kit for the local workspace:
 * it runs `uvx --from git+…@<tag> specify init --here --force --integration <i>
 * --script <s>` with the project directory as cwd, copies the PMI extension in,
 * registers its hooks, and verifies the structure. Composed at the worker's
 * root, never imported by `backend/` (`engine-independence.spec.ts`).
 *
 * `uvx` runs the pinned tag without a permanent install, so the worker host's
 * requirement is *"`uv` on PATH"*, not *"Spec Kit installed at the right
 * version"*. A missing `uv` is `initialiser_unavailable` — distinguishable from
 * a failed init, because the setup skill answers each differently.
 *
 * Unit test: `engine-adapters/speckit/tests/unit/local-init.spec.ts` (T1344).
 */
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { mergeExtensionsRegistry } from '@pmi/workspace-bundle';
import { join } from 'node:path';

export const SPEC_KIT_REPOSITORY = 'git+https://github.com/github/spec-kit.git';

export type InitialiseStep = 'run_engine_init' | 'copy_extension' | 'register_hooks' | 'verify_structure';

export interface InitialiseInput {
  readonly directory: string;
  readonly agentIntegration: string;
  readonly scriptType: 'sh' | 'ps';
  readonly engineTag: string;
  readonly bundleVersion: string;
  /** The bundle's extension half, copied to `.specify/extensions/pmi/`. */
  readonly extensionDir: string;
}

export type InitialiseResult =
  | { readonly ok: true; readonly stepsCompleted: readonly InitialiseStep[]; readonly filesWritten: readonly string[] }
  | {
      readonly ok: false;
      readonly failedStep: InitialiseStep;
      readonly reason: string;
      readonly stepsCompleted: readonly InitialiseStep[];
      readonly filesWritten: readonly string[];
    };

export interface ExecResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** A tool on PATH, run with a working directory. Injected so the test needs no `uv`. */
export type Exec = (command: string, args: readonly string[], cwd: string) => Promise<ExecResult>;

export interface InitCommand {
  readonly command: string;
  readonly args: readonly string[];
}

/** Exactly the documented invocation. The integration is whatever the project recorded. */
export function buildInitCommand(input: Pick<InitialiseInput, 'engineTag' | 'agentIntegration' | 'scriptType'>): InitCommand {
  return {
    command: 'uvx',
    args: [
      '--from',
      `${SPEC_KIT_REPOSITORY}@${input.engineTag}`,
      'specify',
      'init',
      '--here',
      '--force',
      '--integration',
      input.agentIntegration,
      '--script',
      input.scriptType,
    ],
  };
}

export interface LocalInitialiser {
  initialise(input: InitialiseInput): Promise<InitialiseResult>;
}

export class LocalSpecKitInitialiser implements LocalInitialiser {
  constructor(private readonly deps: { exec: Exec }) {}

  async initialise(input: InitialiseInput): Promise<InitialiseResult> {
    const completed: InitialiseStep[] = [];
    const written: string[] = [];
    const fail = (failedStep: InitialiseStep, reason: string): InitialiseResult => ({
      ok: false,
      failedStep,
      reason: sanitise(reason, input.directory),
      stepsCompleted: [...completed],
      filesWritten: [...written],
    });

    // 1 — specify init, at the pinned tag, in the directory.
    const command = buildInitCommand(input);
    try {
      const result = await this.deps.exec(command.command, command.args, input.directory);
      if (result.code !== 0) {
        return fail('run_engine_init', `specify init exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return fail('run_engine_init', 'initialiser_unavailable: `uv` is not on PATH, so `uvx` cannot run Spec Kit. Install uv, or complete initialisation with /setup-PMIStudio.');
      }
      return fail('run_engine_init', (error as Error).message);
    }
    completed.push('run_engine_init');

    // 2 — the PMI extension, from the bundle.
    try {
      const target = join(input.directory, '.specify', 'extensions', 'pmi');
      await mkdir(target, { recursive: true });
      await cp(input.extensionDir, target, { recursive: true });
      written.push('.specify/extensions/pmi/extension.yml');
    } catch (error) {
      return fail('copy_extension', (error as Error).message);
    }
    completed.push('copy_extension');

    // 3 — hooks. EPIC-042 T1499: the bundle's registry fragment is merged in —
    // `pmi` added to `installed` once, one mandatory entry per event unless
    // present, every other extension's entries byte-identical
    // (contracts/extension-and-hooks.md §2). An extension dir without a
    // fragment (the v0.1 mechanism) registers none, as before.
    try {
      const file = join(input.directory, '.specify', 'extensions.yml');
      const existing = await readOrNull(file);
      const fragment = await readOrNull(join(input.extensionDir, 'extensions-fragment.yml'));
      if (fragment !== null) {
        const merged = mergeExtensionsRegistry(existing, fragment.replace(/\r\n/g, '\n'));
        if (merged !== existing) {
          await writeFile(file, merged, 'utf8');
          written.push('.specify/extensions.yml');
        }
      } else if (existing === null) {
        await writeFile(file, '# Registered by PMI Studio (EPIC-041). Hooks arrive with EPIC-042.\nhooks: {}\n', 'utf8');
        written.push('.specify/extensions.yml');
      } else if (!/^hooks:/m.test(existing)) {
        await writeFile(file, `${existing.replace(/\s*$/, '')}\nhooks: {}\n`, 'utf8');
        written.push('.specify/extensions.yml');
      }
    } catch (error) {
      return fail('register_hooks', (error as Error).message);
    }
    completed.push('register_hooks');

    // 4 — the structure the contract promises (SC-LPW-002).
    const required = ['.specify', '.specify/memory', '.specify/templates', '.specify/extensions/pmi/extension.yml'];
    for (const path of required) {
      if (!(await exists(join(input.directory, path)))) {
        return fail('verify_structure', `${path} is missing after specify init for integration "${input.agentIntegration}".`);
      }
    }
    completed.push('verify_structure');

    return { ok: true, stepsCompleted: [...completed], filesWritten: [...written] };
  }
}

/** The directory is the user's; a reason that quotes it verbatim leaks their layout into a record. */
function sanitise(reason: string, directory: string): string {
  return reason.split(directory).join('<project>').slice(0, 500);
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
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

/** The production `Exec`: `execFile`, capturing both streams, never a shell. */
export const execFileOnHost: Exec = async (command, args, cwd) => {
  const { execFile } = await import('node:child_process');
  return new Promise<ExecResult>((resolve, reject) => {
    execFile(command, [...args], { cwd, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') return reject(error);
      const code = error && typeof (error as { code?: unknown }).code === 'number' ? ((error as { code: number }).code) : error ? 1 : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
};
