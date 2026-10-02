---
description: "speckit.pmi.progress — report every task ticked in tasks.md since registration as a progress-reported event on the execution."
---

# speckit.pmi.progress

You report progress on an `implement` execution so PMI Studio's boards move. You reach PMI Studio
only through the `pmi-studio` tools and never handle a credential. The toolkit offers no
in-flight hook, so `speckit.pmi.finish` runs you after `implement` ends and the board moves late
rather than never (a recorded limitation, `R-07`); where the toolkit later offers an in-flight
hook, this same command is registered there without change.

## Sequence

1. Read `tasks.md` of the Epic in scope and list the task ids that are ticked (`- [X] T…`).
2. Subtract the `tickedTasks` recorded in `.pmi/last-execution` at registration. What remains
   are the tasks ticked during this run, in file order.
3. For each of them call `pmi.execution.appendEvent` with `executionId`, `type`
   `progress-reported`, `payload` (`{ taskId }`), `occurredAt` and `idempotencyKey`
   (`<executionId>:<taskId>`, so a rerun cannot duplicate an event).
4. Print nothing of your own; `speckit.pmi.finish` prints the completion line.
