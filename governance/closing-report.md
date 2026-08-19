# Closing Report Format

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirement**: `FR-RGP-015` ·
**Constitution**: IX · **Version**: 1 · **Check**: `G-09`

Constitution IX makes a closing report mandatory and non-negotiable. This document states its shape
and the rule that makes it worth reading.

## Mandatory sections

Both are required. A report with one is not a closing report.

### Work Completed

What was done, with the evidence for each claim. Also what was **not** done, and why.

### Recommended Next Task

What the next session should pick up, and why that and not something else. A report that ends
without one hands the next session a decision it has less context to make than the session that
just finished.

## The honesty rule

This is the clause the format exists for. Without it, the sections above produce a document that
always says "done" — which is worse than no document, because it manufactures confidence rather
than reporting it.

- **An unrun check is never reported as passing.** If a suite was not executed, the report says it
  was not executed. "Should pass" and "passes" are different claims and only one of them is
  evidence.
- **Deferred work is never reported as complete.** Held, blocked, partially done and out-of-scope
  are each stated as what they are. Scaling work down is the owner's call, so it has to be visible
  to them.
- **Every completion claim names its evidence** — the command that was run, the test that covers
  it, or the file that holds it. A claim with no evidence is an intention.
- **A task marked `[X]` was verified, not merely attempted.** Where verification is not possible
  yet, the box stays `[ ]` and the reason is recorded.
- **Corrections are stated plainly.** A finding withdrawn or a task wrongly marked complete is
  reported as such, once, without preamble.

These are not stylistic preferences. Each one was written after the failure it prevents: a task
marked complete on a schema convention when no migration had been generated; a suite reported green
that had never been run alone; a coverage gap reported against an epic that had no tasks by design.

## Template

```markdown
# Closing Report: <EPIC-nnn Title>

**Session**: <session label> · **Branch**: `epic/<nnn>-<slug>` · **Date**: <ISO date>

## Work Completed

| Task | Outcome | Evidence |
|---|---|---|
| T### | done | `pnpm test:unit` — N tests, all passing |
| T### | not done | blocked on <input>, owner <role> |

<Prose: what changed and why it was done this way. State any correction to earlier work here.>

### Verified

<What was actually executed, and the result. Commands and counts, not adjectives.>

### Not verified

<What was not run, and why. If this section is empty, say so explicitly rather than omitting it.>

### Deferred

<What was left, who owns it, and what it waits on.>

## Recommended Next Task

<The single next task, with the reason it comes first. Name the epic and the task ids.>
```

## When there is no next task

Say so, and say what that means: whether the epic is closed, whether the whole build order is
blocked on an input, or whether the next move is a decision rather than a task. "Nothing further"
and "everything left is blocked on `PMI-DOC-004`" lead to different actions.

## Where reports live

`specs/<epic>/closure.md`, per [`repository-layout.md`](./repository-layout.md). The Phase Z tasks
of each epic write to it, and [EPIC-014](../specs/014-devops-release/) confirms it exists at release.

## Related documents

- [`session-labelling.md`](./session-labelling.md) — the label and branch a report names.
- [`steering/ai-governance.md`](./steering/ai-governance.md) `AIG-005` — the same rule as a standard
  on AI sessions.
