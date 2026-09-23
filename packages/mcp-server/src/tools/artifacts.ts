/**
 * `T1640` (EPIC-045, `R-045-8`, `contracts/artifacts-api.md` §1) —
 * `pmi.artifacts.sync`, **live**.
 *
 * `EPIC-043` reserved this name and validated its arguments while refusing
 * `not_available_until EPIC-045`; `EPIC-042`'s finish hook has been calling it
 * ever since. This file is the whole of what changes on the client side: one
 * `ToolSpec` translating the same arguments to
 * `POST /v1/projects/me/artifacts/sync`. The hook is not edited (`FR-ART-046`).
 *
 * ## `me`, not a project id
 *
 * The server never knows a project id — it addresses the project its credential
 * opens (`EPIC-043` `T1445`). The guard resolves `me` to the credential's
 * project, so a client cannot address another project by guessing.
 *
 * ## `epicNumber` is accepted and dropped
 *
 * The reserved schema tolerated it, so an older extension may still send it.
 * It is stripped rather than forwarded, because the Epic comes from the
 * execution's binding and never from an argument (`R-045-2`): forwarding it
 * would create a second, contradictable source for the same fact.
 */
import { z } from 'zod';
import type { ToolSpec } from './shared.js';
import { passthroughObject } from './shared.js';

export const ARTIFACT_TOOLS: readonly ToolSpec[] = [
  {
    name: 'pmi.artifacts.sync',
    title: 'Sync artifacts',
    description:
      "Upload one Epic's markdown set bound to an execution. Each file is accepted, reused or refused on its own; the answer names every refusal and its code. A replay with the same idempotency key returns the original answer.",
    input: {
      contractVersion: z.string().optional(),
      executionId: z.string(),
      files: z.array(z.object({ path: z.string(), digest: z.string(), content: z.string() })),
      idempotencyKey: z.string().optional(),
      /** Tolerated for older extensions and dropped before the call (`R-045-2`). */
      epicNumber: z.number().int().optional(),
    },
    output: passthroughObject({
      syncId: z.string(),
      epicId: z.string().nullable(),
      created: z.number(),
      reused: z.number(),
      refused: z.array(z.object({ path: z.string(), code: z.string() }).passthrough()),
    }),
    mutating: true,
    route: () => ({ method: 'POST', path: '/v1/projects/me/artifacts/sync' }),
    strip: ['epicNumber'],
  },
];
