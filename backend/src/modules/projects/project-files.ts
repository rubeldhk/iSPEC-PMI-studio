/**
 * `T1338` (EPIC-041) — the two files the platform writes into a project directory.
 *
 * `FR-LPW-009`, `FR-LPW-024`, `R-041-10`; `contracts/project-files.md`. These are
 * the product's contract with the developer's agent — a user will look for them
 * by name — so their shapes are specification, not implementation.
 *
 * Two rules bind both: **no credential, ever** (`.mcp.json` names an environment
 * variable, never a value), and **merge, never replace** (`.mcp.json` is the
 * agent's own file, checked into the user's repository; overwriting it would
 * destroy servers the user configured).
 *
 * Framework-free (PC-1). Unit test: `backend/tests/unit/projects/project-files.spec.ts`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The literal the agent expands from the user's environment. Never a value. */
export const PMI_STUDIO_TOKEN_REFERENCE = '${PMI_STUDIO_TOKEN}';

export const PROJECT_JSON_PATH = '.pmi/project.json';
export const MCP_JSON_PATH = '.mcp.json';

export interface ProjectJsonInput {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly projectName: string;
  /** From `PMI_PUBLIC_URL` — never inferred from the request (analysis `U2`). */
  readonly platformUrl: string;
  readonly agentIntegration: string;
  readonly scriptType: 'sh' | 'ps';
  readonly engineTag: string;
  readonly bundleVersion: string;
  readonly preparedAt: Date;
}

/** `\n` endings and a trailing newline regardless of platform, so a re-provision leaves git clean. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/\r\n/g, '\n') + '\n';
}

/** Writes `.pmi/project.json`; returns the relative path written. */
export async function writeProjectJson(directory: string, input: ProjectJsonInput): Promise<string> {
  const target = join(directory, PROJECT_JSON_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    stableJson({
      schemaVersion: 1,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      projectName: input.projectName,
      platformUrl: input.platformUrl,
      agentIntegration: input.agentIntegration,
      scriptType: input.scriptType,
      engineTag: input.engineTag,
      bundleVersion: input.bundleVersion,
      provisionedBy: 'pmi-studio',
      preparedAt: input.preparedAt.toISOString(),
    }),
    'utf8',
  );
  return PROJECT_JSON_PATH;
}

export interface McpServerEntry {
  readonly type: 'stdio';
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export function mcpServerEntry(input: { publicUrl: string; mcpServerVersion: string; mcpServerCommand?: string | undefined }): McpServerEntry {
  const env = { PMI_STUDIO_URL: input.publicUrl, PMI_STUDIO_TOKEN: PMI_STUDIO_TOKEN_REFERENCE };
  // EPIC-043 R-043-11 — a checkout runs the same server from source; the
  // published package is the default and the only thing the container writes.
  const override = input.mcpServerCommand?.trim().split(/\s+/).filter((part) => part.length > 0) ?? [];
  if (override.length > 0) {
    return { type: 'stdio', command: override[0] as string, args: override.slice(1), env };
  }
  return {
    type: 'stdio',
    command: 'npx',
    args: ['-y', `@pmi/mcp-server@${input.mcpServerVersion}`],
    env,
  };
}

/** The user's file did not parse. It is left exactly as it was. */
export class McpJsonUnparseableError extends Error {
  constructor(detail: string) {
    super(`.mcp.json exists and does not parse as JSON; it was left untouched. ${detail}`);
    this.name = 'McpJsonUnparseableError';
  }
}

export interface MergeResult {
  readonly path: string;
  readonly action: 'created' | 'merged';
}

/**
 * Add or replace `mcpServers["pmi-studio"]` and nothing else. Key order of the
 * existing document is preserved; a file that fails to parse is not touched.
 */
export async function mergeMcpJson(directory: string, entry: McpServerEntry): Promise<MergeResult> {
  const target = join(directory, MCP_JSON_PATH);
  let existing: Record<string, unknown> | undefined;
  try {
    const text = await readFile(target, 'utf8');
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new McpJsonUnparseableError('The document is not a JSON object.');
      }
      existing = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof McpJsonUnparseableError) throw error;
      throw new McpJsonUnparseableError((error as Error).message);
    }
  } catch (error) {
    if (error instanceof McpJsonUnparseableError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const servers = { ...((existing?.['mcpServers'] as Record<string, unknown> | undefined) ?? {}) };
  servers['pmi-studio'] = entry;
  const document: Record<string, unknown> = existing ? { ...existing } : {};
  document['mcpServers'] = servers;

  await writeFile(target, stableJson(document), 'utf8');
  return { path: MCP_JSON_PATH, action: existing ? 'merged' : 'created' };
}

// ---------------------------------------------------------------- EPIC-042

export const FIRST_RUN_MARKER_PATH = '.pmi/first-run';
export const CONSTITUTION_PATH = '.specify/memory/constitution.md';

/**
 * EPIC-042 `T1505` (`R-042-8`, `FR-EXT-046`): the first-run marker the begin
 * hook reads. One line — when it was written and by which provisioning run —
 * so a person opening it understands it. The platform's own record (no
 * completed `specify` execution) is the tie-breaker; the hook removes the
 * marker after the first run, or when the platform says it is stale.
 */
export async function writeFirstRunMarker(directory: string, input: { readonly at: Date; readonly correlationId: string }): Promise<string> {
  const target = join(directory, FIRST_RUN_MARKER_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${input.at.toISOString()} ${input.correlationId}\n`, 'utf8');
  return FIRST_RUN_MARKER_PATH;
}

/**
 * EPIC-042 `T1522` (`FR-EXT-028`): the constitution render, written as
 * received — `\n` endings, one trailing newline — so its digest is the render's.
 */
export async function writeConstitutionFile(directory: string, content: string): Promise<string> {
  const target = join(directory, CONSTITUTION_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content.replace(/\r\n/g, '\n'), 'utf8');
  return CONSTITUTION_PATH;
}
