# Grammar corpus — EPIC-046 `T1696`

This file is the worked specification of `FR-KAN-001`, not an afterthought of the
tests (`FR-KAN-008`). Every line below is a case, and `task-grammar.spec.ts`
asserts the parser's verdict on all of them. Prose like this paragraph must be
ignored without being reported.

## Accepted

- [ ] T1701 Write the failing test in `backend/tests/unit/task-sync/task-grammar.spec.ts`
- [X] T1702 Implement the parser in `backend/src/modules/task-sync/task-grammar.ts`
- [x] T1703 Lower-case checkbox is the same as upper-case
- [ ] T1704 [P] The parallel marker in `packages/mcp-server/src/tools/tasks.ts`
- [ ] T1705 A description naming no path at all is a fact, not an error
- [ ] T1706 Two paths, `frontend/src/pages/TaskBoard.tsx` and `frontend/src/services/api.ts`
- [ ] T1707 A cross-reference is description text (unit test: T0nn), never a second task

## Ignored without report

Only a line that begins a task-list item at the start of the line is considered.

* [ ] T1708 A star bullet is not this grammar's task-list item
+ [ ] T1709 Nor is a plus
-  [ ] T1710 Nor is a double space after the bullet
- [~] T1711 Nor is a checkbox character the grammar does not know
  - [ ] T1712 A nested item belongs to the line above it, not to the board
- Not a checkbox at all
| T1713 | a table row |

### A heading is not a task

## Refused with a code

- [ ] Tidy up the module
- [ ] Txyz The identifier does not match the configured pattern
- [ ] T1714
- [ ] T1715 pmi_ct_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA is a credential shape
- [ ] T1701 The identifier already appeared above

## Not inferred from position

The heading below says *Done*. The line under it is unchecked, and stays
`not_started` — `FR-KAN-004`: no status is inferred from position, section,
ordering or prose.

### Done

- [ ] T1716 Sitting under a heading called Done proves nothing
