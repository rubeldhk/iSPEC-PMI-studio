# Session Labelling

**Epic**: [`EPIC-018`](../specs/018-repository-governance/) · **Requirement**: `FR-RGP-014` ·
**Constitution**: VIII · **Version**: 1 · **Check**: `G-08`

Constitution VIII requires every session to be labelled. This document states the format, where it
is applied, and when it changes — so that the requirement is executable rather than a matter of
individual habit.

## Label format

A session label names the epic it is working on and reads as a phrase:

```regex session-label
^EPIC-\d{3} [A-Z][A-Za-z0-9&/ -]{2,60}$
```

Examples: `EPIC-018 Repository Governance`, `EPIC-004 Workspace Tenancy & Audit`.

The corresponding branch name:

```regex branch-name
^epic/\d{3}-[a-z0-9]+(-[a-z0-9]+)*$
```

Examples: `epic/018-repository-governance`, `epic/001-platform-foundation`.

Check `G-08` tests the branch regex against the branch actually checked out. A naming convention no
branch follows is a document, not a convention — so the check reads the live branch rather than a
restatement of the rule.

## Deriving one from the other

The two are mechanically related, which is what makes the pairing checkable:

- **Branch → label**: take the three digits as `EPIC-nnn`, then title-case the slug.
  `epic/018-repository-governance` → `EPIC-018 Repository Governance`.
- **Label → branch**: lowercase the phrase, replace spaces with hyphens, drop punctuation, prefix
  with `epic/` and the number. `EPIC-018 Repository Governance` → `epic/018-repository-governance`.

Where the slug differs from the epic's directory name, the **directory name wins** — it is the one
other files link to.

## Where it is applied

| Surface | How | Why |
|---|---|---|
| **Branch** | `epic/<nnn>-<slug>`, matching the epic's `specs/` directory | The durable record. Checked by `G-08` |
| **Terminal** | Window or tab title set to the session label | Two open sessions are told apart at a glance, which is what `WS-001` depends on |
| **Worktree** | Directory named for the branch when a separate working copy is used | A second concurrent session clones rather than sharing; the name says which epic it holds |
| **Closing report** | Names the epic and the branch | Ties the work to the session that did it — see [`closing-report.md`](./closing-report.md) |

The branch is the surface that must be right. Terminal and worktree naming exist so a person can
tell two sessions apart before they collide; the branch is what survives after they have.

## When to relabel

- **When the epic changes.** A session that finishes EPIC-018 and starts EPIC-004 relabels and
  branches. It does not carry the old label onto new work.
- **When an epic is split.** Sessions on the children take the children's labels; the parent label
  is retired, not reused.
- **Never mid-epic for convenience.** Relabelling to reflect a sub-task makes the branch stop
  matching the epic directory, which is the one property `G-08` relies on.

## What this does not cover

- **Commit message format** — not governed here.
- **Which epic to work on next** — [`specs/README.md`](../specs/README.md) holds the build order and
  wave sequence.
- **Working-copy isolation mechanics** — [`steering/workspace.md`](./steering/workspace.md)
  `WS-001` and `WS-002`.
