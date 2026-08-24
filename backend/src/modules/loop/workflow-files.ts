/**
 * T945 — reading the programme's workflow files at composition time.
 *
 * PC-1: framework-free.
 *
 * **Every file in the directory, and a refusal if any one of them is wrong.**
 * Not "load what parses and skip the rest": a workflow type that silently failed
 * to load would make `declareObject` refuse it as *unknown*, which is a true
 * statement about the registry and a misleading one about the file — the
 * operator would go looking for a missing file that is sitting right there.
 *
 * This is the same directory `backend/tests/architecture/loop-config-conformance.spec.ts`
 * (`T931`) checks. Two readers, one rule: the test asserts the files conform
 * before anything runs; this refuses at composition if they do not.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LoopConfigRegistry } from './config-registry.js';
import { loadLoopConfig, type ResolvedLoopConfig } from './loop-config.loader.js';

const here = dirname(fileURLToPath(import.meta.url));

/** `packages/loop-contract/workflows/`, from `backend/src/modules/loop/`. */
export const WORKFLOWS_DIR = resolve(here, '../../../../packages/loop-contract/workflows');

export function readWorkflowConfigs(
  registeredStages: readonly string[],
  directory: string = WORKFLOWS_DIR,
): ResolvedLoopConfig[] {
  const names = readdirSync(directory).filter(
    (name) => name.endsWith('.json') && name !== 'schema.json',
  );
  return names.map((name) => {
    const raw: unknown = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    return loadLoopConfig(raw, { registeredStages });
  });
}

export function buildConfigRegistry(
  registeredStages: readonly string[],
  directory?: string,
): LoopConfigRegistry {
  return new LoopConfigRegistry(readWorkflowConfigs(registeredStages, directory));
}
