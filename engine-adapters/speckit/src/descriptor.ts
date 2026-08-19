/**
 * T092 — descriptor version capturing BOTH Spec Kit and AI model identity.
 *
 * Contract rule E10, FR-022. The same Spec Kit release driven by a different
 * model produces different output, so treating them as one version would make
 * provenance actively misleading: two artifacts would claim the same engine
 * version and not be reproducible from it.
 *
 * The version is therefore a composite of every input that can change the
 * output, and it changes when ANY of them changes.
 */
import { PHASE_1_CAPABILITIES, type EngineDescriptor } from '@pmi/engine-contract';

export const SPECKIT_ENGINE_NAME = 'speckit';

export interface EngineToolVersions {
  /** The pinned `specify` CLI version from the image (ARG SPECIFY_VERSION). */
  specifyVersion: string;
  /** The pinned AI agent CLI version from the image (ARG AGENT_CLI_VERSION). */
  agentCliVersion: string;
  /** The model the agent actually ran. Not the CLI version — the model. */
  agentModel: string;
}

export class IncompleteProvenanceError extends Error {
  constructor(missing: string[]) {
    super(
      `Refusing to build an engine descriptor without ${missing.join(', ')} — ` +
        `an artifact recorded against an incomplete version cannot be reproduced (FR-022).`,
    );
    this.name = 'IncompleteProvenanceError';
  }
}

/**
 * Build the descriptor for a Spec Kit engine run.
 *
 * Refuses rather than defaulting. A placeholder like "unknown" in a version
 * string is worse than a failed run: the run succeeds, the artifact is stored,
 * and the provenance is wrong forever with nothing to flag it.
 */
export function buildEngineDescriptor(versions: EngineToolVersions): EngineDescriptor {
  const missing: string[] = [];
  if (!versions.specifyVersion?.trim()) missing.push('a Spec Kit version');
  if (!versions.agentCliVersion?.trim()) missing.push('an agent CLI version');
  if (!versions.agentModel?.trim()) missing.push('an agent model');
  if (missing.length > 0) throw new IncompleteProvenanceError(missing);

  return {
    name: SPECKIT_ENGINE_NAME,
    version: formatEngineVersion(versions),
    capabilities: [...PHASE_1_CAPABILITIES],
  };
}

/**
 * `speckit-<specify>+agent=<cli>+model=<model>`
 *
 * Readable on purpose: an operator reading a job row should be able to see
 * which model produced an artifact without decoding a hash.
 */
export function formatEngineVersion(versions: EngineToolVersions): string {
  return (
    `${SPECKIT_ENGINE_NAME}-${versions.specifyVersion.trim()}` +
    `+agent=${versions.agentCliVersion.trim()}` +
    `+model=${versions.agentModel.trim()}`
  );
}
