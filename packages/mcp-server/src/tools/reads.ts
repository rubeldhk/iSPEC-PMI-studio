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
    // EPIC-042 T1491 (R-042-5): the on-disk constitution digest, null when the file is absent.
    input: { ...common, extensionVersion: z.string().optional(), toolkitVersion: z.string().optional(), serverVersion: z.string().optional(), constitutionDigest: z.string().nullable().optional() },
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

/**
 * EPIC-042 `T1491` (`R-042-11`, `contracts/governance-api.md` §2) — the two
 * reads `EPIC-043` reserved by name, now live: the rendered constitution with
 * the on-disk digest classified, and the decomposition plan for a first run.
 */
export const GOVERNANCE_READ_TOOLS: readonly ToolSpec[] = [
  {
    name: 'pmi.constitution.get',
    title: 'Constitution',
    description: 'The current rendered constitution, its version and digest, and — given the on-disk digest — whether the file is current, stale, drifted or missing.',
    input: { ...common, onDiskDigest: z.string().nullable().optional() },
    output: passthroughObject({ version: z.number(), digest: z.string(), content: z.string(), state: z.string() }),
    mutating: false,
    route: (a) => ({
      method: 'GET',
      path: `/v1/projects/me/constitution${a['onDiskDigest'] !== undefined ? `?onDiskDigest=${encodeURIComponent(a['onDiskDigest'] === null ? '' : String(a['onDiskDigest']))}` : ''}`,
    }),
  },
  {
    name: 'pmi.project.decompose',
    title: 'Decomposition plan',
    description: 'The decomposition plan for a first specify: whether this is a first run, the policy, each Epic with its requirement bundle, and the unassigned requirements.',
    input: { ...common },
    output: passthroughObject({ firstRun: z.boolean(), policy: z.record(z.unknown()), epics: z.array(z.record(z.unknown())), unassigned: z.array(z.record(z.unknown())) }),
    mutating: false,
    route: () => ({ method: 'GET', path: '/v1/projects/me/decomposition' }),
  },
];
