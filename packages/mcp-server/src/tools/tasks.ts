/**
 * `T1709` (EPIC-046, `R-046-8`, `contracts/tasks-api.md` §1) —
 * `pmi.tasks.sync`, **live**.
 *
 * `EPIC-043` reserved this name and validated its arguments while refusing
 * `not_available_until EPIC-046`; `EPIC-042`'s finish hook has been calling it
 * after every `tasks` and `implement` ever since. This file is the whole of
 * what changes on the client side: one `ToolSpec` translating the same
 * arguments to `POST /v1/projects/me/tasks/sync`. The hook is not edited
 * (`FR-KAN-061`) — reserving the tool was exactly so it would not have to be.
 *
 * ## No idempotency key
 *
 * The hook sends `{ executionId, tasksMarkdown }` and nothing else, so the
 * platform derives `tasks-sync:<executionId>:<sha256(markdown)>` (`R-046-8`).
 * Accepting a key here would create a second way to key a sync that no client
 * uses, and a replay of an unchanged file already returns the stored answer.
 *
 * ## The answer is a diff a client can print without interpreting prose
 *
 * `FR-KAN-037`. Every entry is a key and a value, never a sentence — so the
 * extension can report what a sync did without parsing English.
 */
import { z } from 'zod';
import type { ToolSpec } from './shared.js';
import { passthroughObject } from './shared.js';

const diffEntry = z.object({ taskKey: z.string() }).passthrough();

export const TASK_TOOLS: readonly ToolSpec[] = [
  {
    name: 'pmi.tasks.sync',
    title: 'Sync tasks',
    description:
      "Parse an Epic's tasks.md into task rows bound to an execution, and return the diff. A line that does not parse is reported with a code, never dropped; a bad file refuses the whole sync. A replay of the same execution and content returns the original answer.",
    input: {
      contractVersion: z.string().optional(),
      executionId: z.string(),
      tasksMarkdown: z.string(),
      /** Tolerated for older extensions and dropped before the call (`FR-KAN-030`). */
      epicNumber: z.number().int().optional(),
    },
    output: passthroughObject({
      syncId: z.string(),
      epicId: z.string().nullable(),
      tasksDigest: z.string(),
      counts: passthroughObject({
        linesConsidered: z.number(),
        parsed: z.number(),
        refused: z.number(),
        duplicates: z.number(),
      }),
      diff: passthroughObject({
        added: z.array(diffEntry),
        descriptionChanged: z.array(diffEntry),
        checkboxChanged: z.array(diffEntry),
        unchanged: z.number(),
        noLongerPresent: z.array(diffEntry),
      }),
      refusedLines: z.array(z.object({ line: z.number(), code: z.string(), text: z.string() }).passthrough()),
      markers: passthroughObject({ aheadOfFile: z.array(z.string()), supersededByFile: z.array(z.string()) }),
      outOfBandEdit: z.boolean(),
    }),
    mutating: true,
    route: () => ({ method: 'POST', path: '/v1/projects/me/tasks/sync' }),
    strip: ['epicNumber'],
  },
];
