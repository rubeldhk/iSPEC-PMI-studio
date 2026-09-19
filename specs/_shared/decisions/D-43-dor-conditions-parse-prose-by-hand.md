# D-43 — every DOR condition parses prose by hand, and nine have now read it wrong

**Status**: **OPEN — raised 2026-08-20, deliberately not acted on in the same session**
**Owner**: EPIC-026 (owns the Epic Stage Register and the Definition of Ready)
**Raised by**: the second `/speckit-analyze` run on EPIC-029, which found the eighth and ninth
instances within an hour of each other
**Evidence**: `DEF-026-001` … `DEF-026-009`

## The question

`DEF-026-008` and `DEF-026-009` are being fixed as individual defects. **Should they be?** Or is the
individual fix now the wrong unit of work?

## The count

Nine defects in one Epic, all the same shape — *a DOR condition reads an artifact with a hand-rolled
regex, and the regex does not match what the artifact actually says*:

| | What it read wrong |
|---|---|
| `DEF-026-001` | `DOR-08` over-reported — counted tasks it should not have |
| `DEF-026-003` | Checks contradicted their own contracts |
| `DEF-026-004` | A test paired **by path** was not recognised as a pairing |
| `DEF-026-005` | `DOR-11` read an untracked directory |
| `DEF-026-006` | `DOR-03` matched a field **label**, never the value beside it |
| `DEF-026-007` | The next-command projection ignored Epic kind |
| **`DEF-026-008`** | `DOR-09` matches an ID format `/speckit-analyze` never produces |
| **`DEF-026-009`** | `DOR-06` matches one marker before `FAIL` and misses the others |

Each was fixed correctly and in isolation. The rate has not fallen.

## Why the shape recurs

Three properties, and every DOR condition has all three:

1. **The producer and the consumer are different documents that never meet.** `/speckit-analyze`
   says how to write a findings table; `dor.ts` says how to read one. Nothing checks them against
   each other, because nothing reads the command definitions at all. `DEF-026-008` is exactly this.
2. **Markdown prose is an unversioned interface.** A heading, a field label, an emoji before a
   status word — each is load-bearing, none is declared, and any author may reasonably write it
   differently.
3. **The default for an unrecognised input is PASS.** A regex that fails to match yields "no
   problem found", so every one of these defects failed **open**. That is the wrong default, and it
   is why they stayed hidden: a gate that wrongly refuses gets reported within a day, and a gate
   that wrongly permits gets reported only when someone goes looking.

Property 3 is the dangerous one. `DOR-09` already reasons about it explicitly for its severity
vocabulary — *"an unrecognised word would be silently treated as non-blocking, and 'silently
non-blocking' is the wrong default"* — and then treats an unrecognised **ID format** as
non-blocking, one line above.

## Options

**(a) Keep fixing them individually.** In force today. Cheap per defect, and each fix is verifiable.
Accepts a tenth instance; nothing about how conditions read artifacts changes.

**(b) A shared, tested reading layer.** One parser for the structures DOR conditions consume —
findings tables, Constitution Check tables, traceability fields — with the *expected shape* declared
once and asserted from both ends, so a command that writes a table and a gate that reads one are
checked against the same definition. Larger, and it is the fix that addresses property 1.

**(c) Fail closed.** Make an unrecognised input a **failure** rather than a pass, across every
condition. Small change, addresses property 3 directly, and would have caught six of the nine on the
day they were written. Costs noise: every artifact not matching the expected shape starts failing
at once, including old ones.

**(d) Check the producers.** Extend governance to read the Spec Kit command definitions and assert
that what they instruct authors to write is what the gates parse. Directly targets property 1 and
would have caught `DEF-026-008` specifically. Novel — nothing in the repository reads `.claude/`
today.

## Recommendation, for whoever takes this

**(c) then (d)**, and not (b) first. Failing closed is small, mechanical, and converts the whole
class from silent to loud — which is what makes the remaining instances findable at all. Checking
the producers then removes the cause rather than the symptom. **(b) is the most satisfying answer
and the least urgent**: a shared parser written before the class is understood would encode the same
assumptions in one place instead of nine.

## Why this is not being decided now

The session that raised it had already made three decisions and was mid-remediation on a different
Epic. A structural change to the readiness gates — which every Epic's `Ready` verdict depends on —
should not be taken as a side effect of fixing two defects, which is the same conflation
[`D-40`](../../014-devops-release/decisions/D-40-runtime-metadata-vs-explicit-tokens.md) was written
to avoid.

`DEF-026-008` and `DEF-026-009` are fixed individually under option (a) meanwhile. That is
deliberate and is **not** a decision against (c) or (d).

## Links

- [`DEF-026-008`](../../026-epic-stage-kanban/defects/DEF-026-008-dor-09-cannot-see-the-findings-it-reads.md)
- [`DEF-026-009`](../../026-epic-stage-kanban/defects/DEF-026-009-dor-06-cannot-see-a-marked-fail.md)
- `tests/governance/epic-stage/dor.ts` — the twelve conditions
- Constitution **V** — a check that cannot fail is decoration; every one of these nine could not fail
