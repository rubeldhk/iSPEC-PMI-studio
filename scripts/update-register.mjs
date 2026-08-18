/**
 * T467 — `pnpm register:update`.
 *
 * The task specifies the script as `UPDATE_REGISTER=1 vitest run --project
 * governance`. That form **does not work on this repository's own machine**:
 * pnpm runs scripts through `cmd.exe` on Windows, where a leading `VAR=value`
 * is parsed as a command name.
 *
 *     > FOO=bar node -e "console.log(process.env.FOO)"
 *     'FOO' is not recognized as an internal or external command
 *
 * Verified before writing this file, not assumed. Adding `cross-env` would fix
 * it with a dependency; this repository has consistently preferred not to take
 * one for a small job — the Docker provider talks to the Engine API rather than
 * pull in `dockerode` for four endpoints — so the launcher is six lines instead.
 *
 * The behaviour is exactly what the task specifies: set `UPDATE_REGISTER=1` and
 * run the governance project, which puts `register.spec.ts` into write mode
 * (`R-026-5`) so the committed register is regenerated rather than compared.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--project', 'governance'],
  {
    stdio: 'inherit',
    env: { ...process.env, UPDATE_REGISTER: '1' },
  },
);

// Surface the real outcome. Swallowing a non-zero status here would report a
// failed regeneration as a successful one, which is the class of thing the
// register exists to prevent.
process.exit(result.status ?? 1);
