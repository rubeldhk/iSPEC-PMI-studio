/**
 * `T1553` (EPIC-044, `FR-EPB-011`, `FR-EPB-012`, `R-044-2`) — the stage
 * configuration is a document this package reads. Canonical here; mirrored as
 * `governance/epic-stage.config.json` and asserted identical by `G-44-01`.
 * Nothing in this file names a stage or a command: the document does.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StageDefinition {
  readonly order: number;
  readonly name: string;
  readonly evidence: string;
  readonly next: string;
  /**
   * The governed command whose COMPLETED execution reaches this stage when the
   * evidence is execution records (`R-044-4`); `null` for the readiness verdict.
   */
  readonly reachedBy?: string | null;
  /** Epic kinds this stage's next command reaches — absence means every kind (`DEF-026-007`). */
  readonly nextAppliesTo?: readonly string[];
}

export interface DorConditionDefinition {
  readonly id: string;
  readonly condition: string;
  readonly reads: string;
  readonly appliesTo?: readonly string[];
}

export interface StageConfig {
  readonly epicDirectoryPattern: string;
  readonly taskIdentifierPattern: string;
  readonly taskIdentifierRecogniser: string;
  /** Before the first stage: an Epic with no completed execution, and the first command to run (`FR-EPB-003`, `FR-EPB-007`). */
  readonly notStarted: { readonly name: string; readonly next: string };
  /** The register's seven stages (`FR-ESK-001`). */
  readonly stages: StageDefinition[];
  /** The product's two further stages (`FR-EPB-003`); the product profile is `stages ++ productStages`. */
  readonly productStages: StageDefinition[];
  /** Which readiness conditions a consumer evaluates (`FR-EPB-046`). */
  readonly readinessProfiles: Record<string, 'dor' | 'none'>;
  readonly postureKinds: Record<string, { readonly meaning: string; readonly requires: string }>;
  readonly epicKinds: Record<string, { readonly terminalStage: string; readonly evaluatesDor: boolean; readonly requires?: string }>;
  readonly dorConditions: DorConditionDefinition[];
  readonly waiverRoles: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = join(here, '..');
export const CONFIG_PATH = join(PACKAGE_DIR, 'epic-stage.config.json');

const cache = new Map<string, StageConfig>();

/** The stage model, read once per path. Configuration, never a literal in a check (`FR-ESK-015`). */
export function loadStageConfig(path: string = CONFIG_PATH): StageConfig {
  let config = cache.get(path);
  if (!config) {
    config = JSON.parse(readFileSync(path, 'utf8')) as StageConfig;
    cache.set(path, config);
  }
  return config;
}

/** The product's stage sequence: the register's stages followed by the product stages, by order. */
export function productProfile(config: StageConfig = loadStageConfig()): StageDefinition[] {
  return [...config.stages, ...config.productStages].sort((a, b) => a.order - b.order);
}

/** The package version, read from the manifest — what the register records and the board states (`FR-EPB-012`). */
export function packageVersion(): string {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version: string };
  return manifest.version;
}
