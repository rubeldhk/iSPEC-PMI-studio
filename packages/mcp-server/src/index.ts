/**
 * `@pmi/mcp-server` — the `pmi-studio` stdio server (EPIC-043).
 *
 * A REST client of PMI Studio's mounted registry and reads, bound to the MCP
 * protocol. Imports nothing from the backend (`R-043-1`; enforced by
 * `backend/tests/architecture/mcp-server-boundary.spec.ts`).
 */
export { createServer, SERVER_NAME, type ServerOptions } from './server.js';
export { createPlatformClient, type FetchLike, type PlatformCall, type PlatformClientOptions, type PlatformPort, type PlatformResult } from './platform-client.js';
export { registryOverClient } from './registry-adapter.js';
export { credentialInArguments, refuse, sanitise, type Refusal, type ToolRefusalResult } from './refusals.js';
export { compose, resolveEnvironment, packageVersion, PACKAGE_VERSION, type ComposeOptions, type ResolvedEnvironment } from './main.js';
