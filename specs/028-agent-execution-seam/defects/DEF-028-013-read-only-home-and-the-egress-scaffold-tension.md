# DEF-028-006 — a read-only HOME, and the scaffold the egress profile may forbid

**Epic**: `EPIC-028` · blocks **`SC-AGT-001`**
**Raised**: 2026-08-19 | **Status**: **FIXED** 2026-08-20 — HOME fixed (`T697`); the egress half resolved by `D-28` delivery; see Resolution
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

## `T698` outcome — the chain now carries what it legitimately can

Diagnostics were being dropped at **two** links, both now fixed:

- `runAgent` threw `StepFailure('agent_run', reason, message)` and discarded
  `result.failure.diagnostics`, so the agent's stderr never reached the engine.
- The engine's mapping point built its diagnostics as `step=${error.step}` alone, discarding the
  detail as well. Every failing run said *what* failed and never *why* — which is why three separate
  causes in one day each had to be reproduced by hand against the image.

Both now propagate, redacted, and the runner prints them to the **console only**, never to the
committed transcript: a redaction bug in a committed file is a credential in git history, while the
same bug on a terminal is a line that scrolls away.

**And the chain stops there, correctly.** The failing run now reports:

```
step=agent_run
The agent exited 1.
```

The reason is not there because **the Claude CLI writes its errors to stdout, not stderr** —
measured: `stderr bytes=0` in every probe, with `API Error: 404 …` on stdout. The adapter carries
stderr and deliberately never carries stdout, because stdout is model output (PC-3, `FR-AGT-012`).

So the last hop is closed by a privacy rule rather than by a defect, and widening it would mean
routing model output into a diagnostic — the exact thing `DEF-028-002` was raised to stop. `T698` is
complete: it isolated the failure as far as the rule permits and named why it stops.

**What that leaves.** The same chain, under identical constraints but with open networking, exits 0
and produces a specification; under `GENERATION_EGRESS_PROFILE` it exits 1. The egress hypothesis is
now the only surviving explanation, and `T699`'s pre-baked scaffold tests it directly: if the
scaffold needs no network, a run that still fails proves the hypothesis wrong.

## Resolution (2026-08-20)

The pre-baked scaffold ran and the failure persisted, which disproved the scaffold hypothesis and
re-raised the cause as **`DEF-028-015`** (the network was `--internal`: containment, not the
profile). That defect is now FIXED — `D-28` Option A delivered the proxy sidecar (EPIC-028
Phase 8), so the profile's one destination is reachable and nothing else is.

Both of this record's halves are therefore closed:

- **HOME**: fixed by `T697` (`HOME="$PWD"`), unchanged.
- **The egress/scaffold tension**: dissolved rather than chosen — the pre-baked scaffold (`T699`)
  needs no network, generation needs only `api.anthropic.com`, and the proxy provides exactly that.
  Proven by the 2026-08-20 `V6` run: specification generated through the enforced shape,
  `v6-transcript.md` Outcome PASSED, `.specify/` produced in the session workspace (`T695`).
