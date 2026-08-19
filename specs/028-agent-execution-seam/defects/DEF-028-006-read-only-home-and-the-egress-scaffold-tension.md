# DEF-028-006 — a read-only HOME, and the scaffold the egress profile may forbid

**Epic**: `EPIC-028` · blocks **`SC-AGT-001`**
**Raised**: 2026-08-19 | **Status**: **PARTIALLY FIXED** — HOME fixed (`T697`); the egress tension is open
**Found by**: `T646b`, once `T696` granted the agent tools
**Severity**: **HIGH**

## Defect 1 — the agent had nowhere to write its own state *(FIXED, `T697`)*

The sandbox is `ReadonlyRootfs: true` with a tmpfs on `/workspace` — correctly, since that is what
makes the container disposable. But `HOME=/home/engine` is on the read-only root, and Claude Code
writes `~/.claude.json` at startup:

```
Error: EROFS: read-only file system, open '/home/engine/.claude.json'
```

**And then it exited 0.** The rejection was unhandled and never set a status, so the adapter read
success from a process that had crashed before doing any work. That zero is why the symptom
presented as `empty_output` from the read-back, two steps from the cause — the same shape as
`DEF-028-004`, and the reason `T692` mattered: with exit codes now honest, the next failure named
itself as `engine_error` instead of hiding.

Fixed by binding `HOME="$PWD"` in the invocation. `$PWD` rather than a literal path, so the adapter
says *"HOME is the working directory"* — true in any provider — instead of learning where Docker
mounts things. The config lands in the ephemeral workspace and dies with it, which is a better
property than a HOME that outlives the run.

**Verified end to end under the real constraints.** With `--read-only`, a tmpfs workspace, the
sandbox uid/gid and `HOME="$PWD"`, the full chain runs and the agent produces a specification:

```
exit=0
spec=./specs/001-todo-app/spec.md
  — 6 success criteria, edge cases and assumptions documented
  — checklists/requirements.md, 16/16 passed, zero [NEEDS CLARIFICATION] markers
```

That is the first specification this programme has generated in a real container.

## Defect 2 — the scaffold may need network the generation profile forbids *(OPEN)*

The `v6` run still fails, now as `engine_error` — the agent runs and exits non-zero. The one
difference remaining between the passing probe and the failing run is **networking**:

| | probe | sandbox |
|---|---|---|
| network | default bridge, open | `GENERATION_EGRESS_PROFILE` |
| allowed destinations | everything | **`api.anthropic.com` only** |

`specify init` fetches its templates over the network. Under the generation profile it cannot reach
GitHub, so the scaffold may be incomplete or absent while `specify_init` still reports success — and
an agent asked to run `/speckit-specify` against an unscaffolded workspace fails.

**Recorded as a hypothesis, not a finding.** What is proven is that the chain succeeds with open
networking and fails under the profile; the causal step has not been isolated. `T698` isolates it by
capturing the agent's stderr from the failing run rather than inferring from the difference.

**If it holds, it is a real architectural tension rather than a bug.** `ADR-0002` freezes the
generation profile to the AI provider endpoint precisely so a generation run cannot reach anything
else, and that is the control working as designed. Scaffolding needs a different, earlier network
posture — or a pre-baked scaffold in the image, which is what an air-gapped generation environment
would want anyway. Either answer changes what `ADR-0002` promises, so it is the owner's.

## Remaining work

- `T698` — capture the agent's stderr from the failing sandbox run and isolate the cause, rather
  than inferring it from the difference between two environments
- `T699` — settle whether the scaffold is pre-baked into the image or granted an earlier network
  posture, once `T698` names the cause
