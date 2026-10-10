/**
 * `T2166` (EPIC-039, `R-039-5`, `FR-HUB-021`, `FR-HUB-022`) — the inbound
 * connectors' facts, **read, not copied**.
 *
 * `pmi-studio`'s version and operations come from the server's own exported
 * table, the integration contract version from `CONTRACT_VERSION`, the surfaces'
 * operations from the connector scope registry. This file is the one place the
 * integrations module touches `packages/mcp-server` — and only its tool-name
 * table and version (`integrations-connector-unchanged.spec.ts`). It writes to
 * no connector table: listing a connector does not change it.
 */
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { MCP_SERVER_VERSION, TOOL_NAMES } from '@pmi/mcp-server/tool-names';
import { registeredConnectorScopes } from '../connector/connector-scope.js';

/** The `EPIC-037` surfaces listed beside `pmi-studio` (`mcp-client` IS `pmi-studio`; `fixture` is omitted). */
export const LISTED_SURFACES = Object.freeze(['ide-extension', 'local-cli', 'ci-cd', 'managed-sandbox'] as const);
export type ListedSurface = (typeof LISTED_SURFACES)[number];

export const CONNECTOR_KEYS: readonly string[] = Object.freeze(['pmi-studio', ...LISTED_SURFACES.map((s) => `surface:${s}`)]);

export const OMITTED_CONNECTORS = Object.freeze([{ key: 'surface:fixture', reason: 'a test surface (EPIC-037 fixture connector); it is not a way anything reaches this platform in use' }]);

export function isConnectorKey(key: string): boolean {
  return CONNECTOR_KEYS.includes(key) || key.startsWith('surface:');
}

export interface StaticConnectorFacts {
  readonly pmiStudioVersion: string;
  readonly pmiStudioTools: readonly string[];
  readonly integrationContract: string;
  readonly surfaceOperations: readonly string[];
}

export function staticConnectorFacts(): StaticConnectorFacts {
  return { pmiStudioVersion: MCP_SERVER_VERSION, pmiStudioTools: [...TOOL_NAMES], integrationContract: CONTRACT_VERSION, surfaceOperations: registeredConnectorScopes() };
}

/** Per-project connector facts, by shape — counts and instants only, never a credential. */
export interface ProjectConnectorFacts {
  /** An active `pmi_ct_` connector credential exists for the project, and who minted it when. */
  activeCredential(workspaceId: string, projectId: string): Promise<{ createdById: string; createdAt: Date } | null>;
  /** The latest workstation connection instant, or null. */
  lastConnection(workspaceId: string, projectId: string): Promise<string | null>;
}
