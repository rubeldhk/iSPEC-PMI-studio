# DEF-028-005 — the model was never requested, and the agent is given no tools

**Epic**: `EPIC-028` · blocks **`SC-AGT-001`** · completes **`R-028-5`**
**Raised**: 2026-08-19 | **Status**: **PARTIALLY FIXED** — the model is fixed (`T694`); the tool grant is a decision
**Found by**: `T646b` with a valid Anthropic key, once `DEF-028-004` stopped masking failures
**Severity**: **HIGH** — one defect made every provenance record false; the other stops the run

## Defect 1 — the descriptor named a model the run never requested *(FIXED, `T694`)*

`CLAUDE_DESCRIPTOR` advertises `model: 'claude-opus-5'`. `invocationFor` was
`['claude', '-p', command]` — **no `--model`** — so the CLI used its own pinned default. In the
image's pinned `@anthropic-ai/claude-code@1.0.0` that default is `claude-sonnet-4-20250514`, which
the API now answers:

```
API Error: 404 {"type":"not_found_error","message":"model: claude-sonnet-4-20250514"}
```

**The 404 is the smaller half.** `FR-022` requires the engine and model version to be recorded on
every artifact. A descriptor naming one model while the run requested another makes every provenance
record wrong in a way nothing could detect — both halves internally consistent, disagreeing only
with reality. Had the pinned default still existed, this would have shipped silently and every
generated artifact would have carried a model attribution that was simply untrue.

Verified against the image, all three cases:

| Requested | Result |
|---|---|
| *(nothing — the old behaviour)* | 404 `claude-sonnet-4-20250514` |
| `--model opus` *(alias)* | 404 `claude-opus-4-20250514` — the alias is stale in the pinned CLI |
| `--model claude-opus-5` | **works** — returned the expected text, exit 0 |

Fixed by passing the descriptor's model, **by full name**. An alias would also make the record
unfalsifiable: "opus" names whatever was latest on the day, which nobody can check afterwards.

## Defect 2 — the agent has no tools, so it cannot write a specification *(OPEN — a decision)*

With a valid key and a valid model, `claude -p "/speckit-specify …"` **succeeds** — exit 0, 476 bytes
of output. **`R-028-5` is answered: `claude -p <command>` is a supported server-side execution
model.** The slash command is recognised and acted on.

What comes back is prose explaining why it cannot proceed:

> `/tmp/demo` is empty — Spec Kit isn't initialized here (no `.specify/` scripts or templates), so
> `/speckit-specify` has nothing to run against. **Bash permission was also declined.**

Two findings in one sentence:

1. **Headless Claude Code declines Bash by default.** An agent that cannot run a command cannot run
   Spec Kit's scripts, and therefore cannot create `spec.md`. The engine then reads back an empty
   workspace and reports `empty_output` — accurate, and three steps from the cause.
2. **The scaffold did not produce `.specify/`.** In the probe, `specify init demo
   --ignore-agent-tools` left the directory empty. Whether the adapter's own scaffold succeeds is a
   separate question `T695` settles, and the two must not be conflated: an agent with no tools would
   fail against a *perfect* scaffold too.

## Why this is a decision, not an edit

Granting the agent tools means `--allowedTools` or a permission mode, which lets a model run
commands and write files inside the sandbox. That is exactly what the sandbox is *for* — `ADR-0002`
contains it with a frozen egress profile, resource limits and an ephemeral workspace — but it widens
what a model may do unattended, and `PP-003` Human-in-the-Loop is a principle this programme
enforces rather than assumes.

The narrow grant (Bash and Write, nothing else) is almost certainly right. It is recorded rather
than taken because it is a security posture, and the owner sets those.

## Remaining work

- `T695` — verify the adapter's own scaffold produces `.specify/` inside the session workspace,
  separately from the tool grant
- `T696` — grant the headless agent the tools it needs, at the narrowest scope that lets
  `/speckit-specify` write a specification, once the posture is settled
