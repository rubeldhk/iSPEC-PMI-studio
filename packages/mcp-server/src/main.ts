/**
 * `pmi-studio` bootstrap (`T1427`, `FR-PIC-007`).
 *
 * Reads the environment and nothing else: `PMI_STUDIO_URL` (required) and
 * `PMI_STUDIO_TOKEN` (the credential; empty is absent — the server still
 * starts and every tool refuses, so `.mcp.json` fails loudly rather than
 * hanging). Composes the platform client and the server, and serves stdio.
 * The published package and a checkout (`PMI_MCP_SERVER_COMMAND`) run this
 * same file.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createPlatformClient, type FetchLike } from './platform-client.js';
import { createServer } from './server.js';

export interface ResolvedEnvironment {
  readonly baseUrl: string;
  readonly credential: string;
}

export function resolveEnvironment(env: Record<string, string | undefined>): ResolvedEnvironment {
  const baseUrl = env['PMI_STUDIO_URL']?.trim() ?? '';
  if (baseUrl === '') {
    throw new Error('pmi-studio: PMI_STUDIO_URL is required — the platform address .mcp.json carries.');
  }
  return { baseUrl, credential: env['PMI_STUDIO_TOKEN']?.trim() ?? '' };
}

export interface ComposeOptions {
  readonly fetch?: FetchLike;
  readonly serverVersion: string;
}

export function compose(env: ResolvedEnvironment, options: ComposeOptions): McpServer {
  const platform = createPlatformClient({ baseUrl: env.baseUrl, credential: env.credential, ...(options.fetch ? { fetch: options.fetch } : {}) });
  return createServer(platform, { serverVersion: options.serverVersion });
}

/** The manifest's version, read at start — never a literal repeated here (T1470). */
export function packageVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
  return manifest.version ?? '0.0.0';
}

export const PACKAGE_VERSION = packageVersion();

export async function run(): Promise<void> {
  let env: ResolvedEnvironment;
  try {
    env = resolveEnvironment(process.env);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
  const server = compose(env, { serverVersion: PACKAGE_VERSION });
  await server.connect(new StdioServerTransport());
  if (env.credential === '') {
    process.stderr.write('pmi-studio: PMI_STUDIO_TOKEN is not set; every tool will refuse until it is.\n');
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) void run();
