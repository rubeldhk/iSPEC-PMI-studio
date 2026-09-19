# Register: Research

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Research items — `R-AI-001`…`014` (Native §26) and `R-027-1`…`8`.

Native §26: *"Do not make unsupported assumptions where research is required."* `blocks` names what
cannot be decided until the item is answered, so an unanswered item is visible as a blocker rather
than as a gap.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Twenty-two items, and nine of them are uninvestigated

Native §26 names fourteen `R-AI-*` items; this epic added eight `R-027-*`. `blocks` names what
cannot be decided until the item is answered, so an unanswered item is visible as a **blocker**
rather than as a gap.

**Nine of the fourteen `R-AI-*` items are uninvestigated, and the register says so.** That is the
honest number and it is deliberately not tidied: §26 says *"Do not make unsupported assumptions where
research is required"*, and a register where everything is marked answered would be claiming research
nobody did. `G-27-08` asserts at least one item remains uninvestigated for exactly that reason.

**The four that matter most right now**:

- **`R-AI-001` / `R-AI-002`** — whether `claude -p <command>` inside a container is a supported
  server-side execution model. `ClaudeAgent` is written against the documented CLI contract and has
  never been run. `T646b` is the task that would settle both.
- **`R-AI-011`** — secure git credential delegation. `D-27` names the model; the mechanism has never
  been verified against what GitHub, GitLab and Bitbucket actually support, and the credential broker
  is unbuilt and unowned.
- **`R-AI-014`** — MCP least-privilege authorization. `D-26` moved the agent-facing MCP surface to
  near-term, and it cannot ship without this.

Five items are `answered` because EPIC-028 answered them by building: the agent contract design
(`R-AI-008`), cancellation and timeout semantics (`R-AI-012`), the persistent-versus-ephemeral
trade-off (`R-AI-010`), and Spec Kit's behaviour in persistent repositories narrowed by `D-29`
(`R-AI-006`, `R-AI-007`).

## Register

| id | question | blocks | owner | status |
|---|---|---|---|---|
| R-AI-001 | What is the currently supported server-side Claude Code / Agent SDK execution model? | ADR-0006 ; T646b | tech-lead | uninvestigated |
| R-AI-002 | Is Claude Code headless / container execution supported as a server-side model? | ADR-0006 ; T646b | tech-lead | uninvestigated |
| R-AI-003 | How does Claude MCP integration and authorization work? | ADR-0010 | tech-lead | uninvestigated |
| R-AI-004 | Are Claude hooks and subagents applicable to PMI governance? | ADR-0010 ; ADR-0015 | tech-lead | uninvestigated |
| R-AI-005 | What remote, cloud, CLI and agent integration does Cursor support? | ADR-0006 | tech-lead | uninvestigated |
| R-AI-006 | How does Spec Kit behave inside persistent versus disposable repositories? | ADR-0009 | tech-lead | answered |
| R-AI-007 | What is the best mechanism for preserving Spec Kit project state between agent runs? | ADR-0009 | tech-lead | answered |
| R-AI-008 | What does a provider-neutral agent contract look like? | ADR-0006 | tech-lead | answered |
| R-AI-009 | What sandbox network and credential isolation do coding agents need for package, repository and MCP access? | ADR-0013 | tech-lead | uninvestigated |
| R-AI-010 | Persistent workspace versus ephemeral worktree or container — what are the trade-offs? | ADR-0008 ; ADR-0009 | tech-lead | answered |
| R-AI-011 | How is Git credential delegation to ephemeral agents done securely? | ADR-0012 | tech-lead | uninvestigated |
| R-AI-012 | What are the correct agent cancellation and timeout semantics? | ADR-0006 | tech-lead | answered |
| R-AI-013 | What model, context and cost metadata is available across providers? | ADR-0020 | tech-lead | uninvestigated |
| R-AI-014 | What is the MCP least-privilege authorization model? | ADR-0010 ; ADR-0011 | tech-lead | uninvestigated |
| R-027-1 | How should the reconciliation register be machine-readable without being unreadable? | T597 ; T601 | tech-lead | answered |
| R-027-2 | What grain should the clause register use — one row per clause, or per capability? | T608 ; SC-AMD-001 | project-owner | answered |
| R-027-3 | Which of the fourteen conformance checks should block CI? | T632 ; blocking policy | project-owner | answered |
| R-027-4 | What knowledge-graph traversal performance is required for impact analysis? | ADR-0019 | tech-lead | uninvestigated |
| R-027-5 | How should the three Rooms share a workflow engine without collapsing into one surface? | ADR-0018 | tech-lead | uninvestigated |
| R-027-6 | What context-assembly latency and token budget is acceptable for curated agent context? | ADR-0019 | tech-lead | uninvestigated |
| R-027-7 | Does self-hosted remain a supported deployment after the SaaS decision? | D-40 | project-owner | answered |
| R-027-8 | Should the Human/AI responsibility model become a platform-wide register in _shared/? | D-37 | project-owner | uninvestigated |
