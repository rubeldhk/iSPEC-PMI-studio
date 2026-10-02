/**
 * `EPIC-037`'s execution tools — six live, `sync` reserved (`FR-PIC-001`,
 * `FR-PIC-034`). Each is a translation of one mounted route
 * (`contracts/mcp-tool-surface.md` §1); arguments are the contract's request
 * types minus what the platform derives, and the server never sends those.
 */
import { z } from 'zod';
import type { ToolSpec } from './shared.js';
import { passthroughObject } from './shared.js';

const inputBinding = z
  .object({
    targetType: z.string(),
    targetId: z.string(),
    targetVersion: z.number().int().optional(),
    baselineId: z.string().optional(),
    repositoryId: z.string().optional(),
    branch: z.string().optional(),
    worktree: z.string().optional(),
    commitBefore: z.string().optional(),
    inputArtifactDigests: z.array(z.string()).optional(),
  })
  .passthrough();

const outputBinding = z
  .object({
    commitAfter: z.string().optional(),
    resultingVersion: z.number().int().optional(),
    resultingBaselineId: z.string().optional(),
    generatedArtifactDigests: z.array(z.string()).optional(),
    evidenceRefs: z.array(z.string()).optional(),
  })
  .passthrough();

const common = { contractVersion: z.string().optional() };
// FR-PIC-004 (T1469): every mutating tool carries a correlation id. EPIC-037's
// append, complete and comment requests have none of their own, so on those
// it is optional and travels as the x-correlation-id header (platform-client.ts).
const correlated = { correlationId: z.string().optional() };

export const EXECUTION_TOOLS: readonly ToolSpec[] = [
  {
    name: 'pmi.execution.register',
    title: 'Register an execution',
    description: 'Register a governed command before it runs. Returns the execution snapshot; a replay with the same idempotency key returns the original.',
    input: {
      ...common,
      command: z.string(),
      argsSanitized: z.record(z.unknown()),
      input: inputBinding,
      correlationId: z.string(),
      causationId: z.string().optional(),
      idempotencyKey: z.string(),
      environment: z.string().optional(),
      parentExecutionId: z.string().optional(),
      executionId: z.string().optional(),
    },
    output: passthroughObject({ executionId: z.string() }),
    mutating: true,
    route: () => ({ method: 'POST', path: '/v1/executions' }),
  },
  {
    name: 'pmi.execution.appendEvent',
    title: 'Append an execution event',
    description: 'Append one immutable event to a registered execution.',
    input: {
      ...common,
      ...correlated,
      executionId: z.string(),
      type: z.string(),
      payload: z.record(z.unknown()),
      occurredAt: z.string(),
      idempotencyKey: z.string(),
      expectedSequence: z.number().int().optional(),
      localSequence: z.number().int().optional(),
    },
    output: passthroughObject({ sequence: z.number() }),
    mutating: true,
    route: (a) => ({ method: 'POST', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}/events` }),
    strip: ['executionId'],
    correlationAsHeader: true,
  },
  {
    name: 'pmi.execution.complete',
    title: 'Complete an execution',
    description: 'Append the terminal lifecycle event with outcome, output binding and the mandatory completion comment.',
    input: {
      ...common,
      ...correlated,
      executionId: z.string(),
      outcome: z.enum(['completed', 'partially-completed', 'failed', 'cancelled', 'timed-out']),
      occurredAt: z.string(),
      completionComment: z.string(),
      output: outputBinding.optional(),
      idempotencyKey: z.string(),
      expectedSequence: z.number().int().optional(),
    },
    output: passthroughObject({ sequence: z.number() }),
    mutating: true,
    route: (a) => ({ method: 'POST', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}/completion` }),
    strip: ['executionId'],
    correlationAsHeader: true,
  },
  {
    name: 'pmi.execution.comment',
    title: 'Comment on an execution',
    description: 'Append to the execution thread. Permitted after completion.',
    input: {
      ...common,
      ...correlated,
      executionId: z.string(),
      body: z.string(),
      commentType: z.string().optional(),
      parentCommentId: z.string().optional(),
      idempotencyKey: z.string(),
    },
    output: passthroughObject({ commentId: z.string() }),
    mutating: true,
    route: (a) => ({ method: 'POST', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}/comments` }),
    strip: ['executionId'],
    correlationAsHeader: true,
  },
  {
    name: 'pmi.execution.proposeStatus',
    title: 'Propose a status transition',
    description: 'Request a transition. The platform decides; a connector never applies one.',
    input: {
      ...common,
      executionId: z.string(),
      targetRef: z.string(),
      targetVersion: z.number().int(),
      expectedCurrentStatus: z.string(),
      proposedState: z.string(),
      rationale: z.string(),
      correlationId: z.string(),
      idempotencyKey: z.string(),
    },
    output: passthroughObject({ sequence: z.number() }),
    mutating: true,
    route: (a) => ({ method: 'POST', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}/proposals` }),
    strip: ['executionId'],
  },
  {
    name: 'pmi.execution.history',
    title: 'Read an execution',
    description: 'The execution snapshot and its ordered event stream.',
    input: { ...common, executionId: z.string() },
    output: passthroughObject({ snapshot: z.record(z.unknown()).nullable(), events: z.array(z.record(z.unknown())) }),
    mutating: false,
    route: (a) => ({ method: 'GET', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}/history` }),
    // The snapshot is read beside the history; both are the credential's project only.
    also: (a) => ({ method: 'GET', path: `/v1/executions/${encodeURIComponent(String(a['executionId']))}` }),
  },
];
