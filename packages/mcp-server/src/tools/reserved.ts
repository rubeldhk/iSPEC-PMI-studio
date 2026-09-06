/**
 * Reserved tools (`FR-PIC-002`, `FR-PIC-034`, `FR-PIC-045`): listed, their
 * arguments validated against the shapes PMI-DOC-007 §4.1 describes, and then
 * refused by naming the Epic that supplies them. A client can tell *not yet*
 * from *never*, and is validated even while the content is absent.
 *
 * EPIC-045 `T1640` removed `pmi.artifacts.sync` from this list: it is live in
 * `tools/artifacts.ts`. **Two** rows remain — `pmi.execution.sync` (EPIC-037's
 * provisional intake) and `pmi.tasks.sync` (EPIC-046).
 */
import { z, type ZodTypeAny } from 'zod';

export interface ReservedToolSpec {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** Validated in the handler, so a schema failure is a tool refusal, not a protocol error. */
  readonly schema: ZodTypeAny;
  readonly epic: string;
  readonly what: string;
}

export const RESERVED_TOOLS: readonly ReservedToolSpec[] = [
  {
    name: 'pmi.execution.sync',
    title: 'Reconcile provisional executions',
    description: 'Offer a queued offline batch for intake. Reserved until EPIC-037 delivers its provisional intake.',
    schema: z.object({ contractVersion: z.string().optional(), batch: z.array(z.record(z.unknown())) }).strict(),
    epic: 'EPIC-037',
    what: 'Reconciliation of provisional executions',
  },
  {
    name: 'pmi.tasks.sync',
    title: 'Sync tasks',
    description: 'Parse tasks.md into task rows bound to an execution; returns the diff. Reserved until EPIC-046.',
    schema: z.object({ contractVersion: z.string().optional(), executionId: z.string().optional(), tasksMarkdown: z.string().optional() }).strict(),
    epic: 'EPIC-046',
    what: 'Task sync',
  },
];
