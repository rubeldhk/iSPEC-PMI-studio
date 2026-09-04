/**
 * The reads a local agent needs to begin (`FR-PIC-002`, `FR-PIC-040`–`046`;
 * `contracts/mcp-tool-surface.md` §2). `{id}` in every route is the
 * credential's project: the server never knows a project id, so the routes
 * take `me` and the platform resolves it from the credential.
 */
import { z } from 'zod';
import type { ToolSpec } from './shared.js';
import { passthroughObject } from './shared.js';

const common = { contractVersion: z.string().optional() };

export const READ_TOOLS: readonly ToolSpec[] = [
  {
    name: 'pmi.health',
    title: 'Health',
    description: 'Confirms the credential opens this project; returns the project id, the contract and API versions; records this workstation as connected.',
    input: { ...common, extensionVersion: z.string().optional(), toolkitVersion: z.string().optional(), serverVersion: z.string().optional() },
    output: passthroughObject({ projectId: z.string(), contractVersion: z.string() }),
    mutating: false,
    route: () => ({ method: 'POST', path: '/v1/projects/me/health' }),
  },
  {
    name: 'pmi.project.context',
    title: 'Project context',
    description: 'The project id, name, agent integration, script type, versions, platform address and Epic list.',
    input: { ...common },
    output: passthroughObject({ projectId: z.string(), name: z.string(), epics: z.array(z.record(z.unknown())), epicSource: z.string() }),
    mutating: false,
    route: () => ({ method: 'GET', path: '/v1/projects/me/context' }),
  },
  {
    name: 'pmi.requirements.list',
    title: 'Requirements by Epic',
    description: 'Every active requirement of the project, grouped by Epic, unassigned ones visible as such.',
    input: { ...common },
    output: passthroughObject({ groups: z.array(z.record(z.unknown())), epicSource: z.string() }),
    mutating: false,
    route: () => ({ method: 'GET', path: '/v1/projects/me/requirements?groupBy=epic' }),
  },
];
