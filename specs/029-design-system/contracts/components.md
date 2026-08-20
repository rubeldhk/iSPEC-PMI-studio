# Contract: Phase 1 Component Inventory

**EPIC-029** · Phase 1 · the fifteen components of `FR-DS-023` and the states each MUST implement

The **states column is the contract**. `FR-DS-020` says every applicable state must be implemented;
"applicable" is declared here so a test knows what to assert and a missing state is a failure
rather than an omission nobody notices (`SC-DS-004`).

Legend: **D**efault · **H**over · **F**ocus · **A**ctive · **Di**sabled · **L**oading · **E**rror ·
**Em**pty

| # | Component | D | H | F | A | Di | L | E | Em | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Button | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | loading state MUST keep its label; a spinner replacing text loses the announcement |
| 2 | TextInput | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | error state paired with FormField's message |
| 3 | Select | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | empty = no options to choose |
| 4 | Checkbox | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | indeterminate is a value, not a state |
| 5 | Radio | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | |
| 6 | FormField | ✓ | — | — | — | ✓ | — | ✓ | — | owns label, hint, and the error message announced to assistive tech (`FR-DS-021`) |
| 7 | Table | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | **MUST offer filtering** (`FR-DS-041`); row hover/focus are distinct |
| 8 | EmptyState | ✓ | — | — | — | — | — | — | — | explains *why* empty and what to do next (`FR-DS-021`) |
| 9 | ErrorState | ✓ | — | — | — | — | — | — | — | says what went wrong and what to do; exposes no internal detail (`FR-DS-022`) |
| 10 | LoadingIndicator | ✓ | — | — | — | — | — | — | — | MUST NOT block unrelated interaction |
| 11 | Modal | ✓ | — | ✓ | — | — | ✓ | ✓ | — | focus trapped on open, restored on close; Escape closes |
| 12 | Toast | ✓ | ✓ | ✓ | — | — | — | ✓ | — | announced politely; never the sole carrier of an error the user must act on |
| 13 | Navigation | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | current location exposed to assistive tech, not by colour alone (`FR-DS-012`) |
| 14 | PageHeader | ✓ | — | — | — | — | ✓ | — | — | |
| 15 | StatusPill | ✓ | — | — | — | — | — | — | — | status carried by **text or icon as well as colour** (`FR-DS-012`) |

## Universal obligations

Every component in this inventory:

1. contains **no literal visual value** — tokens only (`FR-DS-051`);
2. renders correctly in **both themes** (`FR-DS-010`);
3. if interactive, is **keyboard-operable with a visible focus indicator** (`FR-DS-033`);
4. passes the axe check with the tag set of research `R-029-2` — including the explicitly enabled
   `target-size` rule, without which the WCAG 2.2 delta is untested;
5. has a test asserting **each state its row declares**.

## Deliberately out of Phase 1

Tabs, accordion, date picker, combobox, tooltip, drawer, pagination. Each is real work with real
accessibility depth; none is required by a delivered page or by the four Epics next in the
dependency order. They arrive when a screen needs them, against this same contract.

## Dependency on `D-42`

Whether these are **built here or adopted** from a library is decision `D-42` (`PMI-DOC-005`
`RULE-05`). This contract is written to survive either answer: an adopted library must satisfy
every row and every universal obligation, and does not get to redefine them (`FR-DS-030`).
