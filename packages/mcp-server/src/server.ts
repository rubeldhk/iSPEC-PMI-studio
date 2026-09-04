/**
 * `createServer(platform)` — the `pmi-studio` MCP server (`T1425`, `R-043-1`,
 * `R-043-2`).
 *
 * A transport and nothing more: every live tool is a translation of one
 * mounted route through the `PlatformPort`; every refusal is a tool result
 * with `isError` and a structured code (`R-043-5`); the contract version is
 * declared for a person in `instructions` and for a program by `pmi.health`,
 * and a client naming another version is refused before any platform call
 * (`R-043-6`). No state between calls; no file read (`FR-PIC-007`,
 * `FR-PIC-011`).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { z } from 'zod';
import type { PlatformPort, PlatformResult } from './platform-client.js';
import { credentialInArguments, refuse } from './refusals.js';
import { EXECUTION_TOOLS } from './tools/execution.js';
import { READ_TOOLS } from './tools/reads.js';
import { RESERVED_TOOLS } from './tools/reserved.js';
import type { Args, ToolSpec } from './tools/shared.js';

export interface ServerOptions {
  /** The package version, advertised as `serverInfo.version`. */
  readonly serverVersion: string;
}

export const SERVER_NAME = 'pmi-studio';

type ToolResult = CallToolResult;

function ok(body: unknown): ToolResult {
  const structuredContent = (body !== null && typeof body === 'object' && !Array.isArray(body) ? body : { value: body }) as Record<string, unknown>;
  return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
}

function refused(code: string, message: string, detail: Record<string, unknown> = {}): ToolResult {
  return refuse(code, message, detail) as unknown as ToolResult;
}

function fromPlatform(result: PlatformResult): ToolResult {
  if (result.ok) return ok(result.body);
  const { code, message, ...detail } = result.refusal;
  return refused(code, message, detail);
}

/** The checks every tool performs before it does anything else. */
function preflight(args: Args): ToolResult | null {
  const version = args['contractVersion'];
  if (typeof version === 'string' && version !== CONTRACT_VERSION) {
    return refused('unsupported_contract_version', `Contract version ${version} is not supported; this server speaks ${CONTRACT_VERSION}.`, {
      supported: CONTRACT_VERSION,
      received: version,
    });
  }
  const hit = credentialInArguments(args);
  if (hit !== null) {
    return refused('credential_in_argument', `The argument "${hit}" carries a credential-shaped value. Credentials travel only in the environment.`, { argument: hit });
  }
  return null;
}

function registerLive(server: McpServer, platform: PlatformPort, spec: ToolSpec): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input,
      outputSchema: spec.output,
      annotations: { readOnlyHint: !spec.mutating, idempotentHint: true },
    },
    async (rawArgs): Promise<ToolResult> => {
      const args: Args = { ...rawArgs };
      const blocked = preflight(args);
      if (blocked) return blocked;
      delete args['contractVersion'];

      const route = spec.route(args);
      const body: Args = { ...args };
      // The registry negotiates the version in the body as well as the header
      // (EPIC-037); the server always speaks the one it was built with.
      if (spec.name === 'pmi.execution.register') body['contractVersion'] = CONTRACT_VERSION;
      for (const name of spec.strip ?? []) delete body[name];

      if (spec.name === 'pmi.health' && !platform.describe().credentialPresent) {
        return refused('invalid_connector_credential', 'Invalid connector credential.', { detail: 'credential_absent' });
      }

      const first = await platform.call({
        method: route.method,
        path: route.path,
        surface: 'mcp-client',
        ...(route.method === 'POST' ? { body, idempotencyKey: typeof body['idempotencyKey'] === 'string' ? body['idempotencyKey'] : undefined } : {}),
      });
      if (!first.ok) return fromPlatform(first);

      if (spec.also) {
        const second = spec.also(args);
        const snapshot = await platform.call({ method: second.method, path: second.path, surface: 'mcp-client' });
        return ok({ snapshot: snapshot.ok ? snapshot.body : null, events: Array.isArray(first.body) ? first.body : [] });
      }
      return ok(first.body);
    },
  );
}

function registerReserved(server: McpServer, spec: (typeof RESERVED_TOOLS)[number]): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      // Loose at the protocol layer so a schema failure is a tool refusal
      // (validated below), not a JSON-RPC error the client must special-case.
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({}).passthrough(),
      annotations: { readOnlyHint: true },
    },
    async (rawArgs): Promise<ToolResult> => {
      const blocked = preflight(rawArgs);
      if (blocked) return blocked;
      const parsed = spec.schema.safeParse(rawArgs);
      if (!parsed.success) {
        return refused('invalid_arguments', `Invalid arguments for ${spec.name}: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`, {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      return refused('not_available_until', `${spec.what} is not available until ${spec.epic} is delivered.`, { epic: spec.epic });
    },
  );
}

export function createServer(platform: PlatformPort, options: ServerOptions): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: options.serverVersion },
    {
      instructions:
        `pmi-studio speaks PMI Studio execution contract version ${CONTRACT_VERSION}. ` +
        'Every call requires PMI_STUDIO_TOKEN in the environment; never pass a credential as an argument. ' +
        'Mutating tools require an idempotencyKey. Refusals return isError with a structured code.',
    },
  );
  for (const spec of [...EXECUTION_TOOLS, ...READ_TOOLS]) registerLive(server, platform, spec);
  for (const spec of RESERVED_TOOLS) registerReserved(server, spec);
  return server;
}
