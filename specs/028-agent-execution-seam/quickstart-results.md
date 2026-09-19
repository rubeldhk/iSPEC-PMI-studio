# Quickstart Results — EPIC-028

**Task**: `T591` · **Run**: 2026-08-17, V6 updated 2026-08-20 · **Machine**: Windows 11, Node 22,
pnpm 9.15.9, Docker 28.3.3 *(recorded as "no container runtime" on 2026-08-17 — disproved by
`DEF-028-004`'s fix; the daemon was unreachable, not absent)*

Every scenario in [quickstart.md](./quickstart.md), including `V6` as of 2026-08-20.

**Passes and unrun are distinguished throughout** (Constitution IX). A scenario is recorded as
passing only if its assertions actually executed.

| Scenario | Proves | Command | Result |
|---|---|---|---|
| **V0** The test harness is not lying | `T537` — no Vitest project collects zero tests | `pnpm test:governance` (`vitest-projects.spec.ts`) | ✅ **PASS** — 15 assertions. Caught two real regressions during this epic |
| **V1** The AI provider swaps without touching the engine | `SC-AGT-002` | `vitest --project backend-integration -t T561` | ✅ **PASS** — 7 assertions. Identical result shape, identical failure classification, distinct provenance, `--integration` resolved per descriptor |
| **V2** The build fails when a provider is named outside an agent adapter | `C-19`, `FR-AGT-004` | `pnpm test:arch` | ✅ **PASS** — 22 assertions across engine-, agent- and transport-independence |
| **V3** Capability negotiation refuses before it runs | `FR-AGT-003`, E7 | `vitest --project agent-adapters` (conformance C4) | ✅ **PASS** — refusal names the missing capability, and the session records zero commands |
| **V4** Cancellation is never reported as a timeout | `FR-AGT-006`, C1/C2 | `vitest --project agent-adapters` (conformance C1, C2) | ✅ **PASS** — 38 assertions, run against **both** adapters. See the note below: this scenario found `DEF-028-001` |
| **V5** Egress and workspace bindings are validated, not trusted | `FR-AGT-010`, `FR-AGT-011` | `vitest --project execution-contract` | ✅ **PASS** — 33 assertions: wildcard and empty destination lists rejected, a provider without network-policy support cannot accept a profile, a credential ref without `expiresAt` rejected |
| **V6** A real container produces a specification | `SC-AGT-001` | `pnpm v6:real-run` | ✅ **PASS** — run 2026-08-20 through the `D-28`-enforced proxy; all seven steps including a refused non-allowlisted probe. Transcript committed. *(Recorded as unrun on 2026-08-17; the daemon existed after all — see below)* |
| **V7** Spec Kit is the default engine, and it resolves | `FR-018` | `vitest --project backend-integration -t T572` | ✅ **PASS** — 9 assertions. Resolves to `speckit`; the composed chain generates a specification through engine → agent → environment |
| **V8** The `generation` egress control is untouched | `SC-AGT-005` | `pnpm test:governance` (`generation-egress-frozen.spec.ts`) | ✅ **PASS** — **but only after `DEF-028-003` was fixed.** See below |

## V4 found a defect, which is the point of running it

Extracting the conformance suite so it could run against a second adapter (`T565`) revealed that
case **C2** — *"a hung step self-terminates at the wall clock"* — was driven by a `FixtureAgent`
constructor flag, not by a hanging session. The real code path awaited `session.exec` directly and
**hung forever**. Recorded as
[`DEF-028-001`](./defects/DEF-028-001-hung-step-case-tested-a-flag-not-a-hang.md), fixed by moving
`raceWallClock` into the contract so every adapter inherits one implementation.

`V4` now passes against a session that genuinely never resolves.

## V8 passed only after the check was repaired

`T549a` compared the frozen manifest against `main` — and **neither frozen file exists on `main`**,
which is at `7980f9f`, predating EPIC-003. The comparison threw, the check took its skip branch, and
printed a SKIPPED line on every run on every machine including CI.

So the check added *because* `SC-AGT-005` had no enforcement that could fail **still had none**,
while the suite was green. Recorded as
[`DEF-028-003`](./defects/DEF-028-003-frozen-egress-check-cannot-run.md) and fixed by pinning the
content hashes as committed constants.

**Mutation-verified**: changing `"policy": "deny-all"` to `"allow-all"` in `sandbox.json` now turns
the check red. Before the fix it did not.

## V6 — run and PASSED (updated 2026-08-20; original 2026-08-17 record struck below)

~~`T646b` requires a machine with a Docker daemon. This one has none. **`SC-AGT-001` is
UNVERIFIED.** No real container has started in this programme, and this epic has not changed
that.~~ *(The daemon was present all along — `DEF-028-004` was the transport, not the absence. The
original wording is kept struck because it records what was believed and verified on the day.)*

What actually happened, across three run days:

- **2026-08-17** — first real container in the programme's history; stopped at the missing
  credential (correct `E7` refusal). Six defects found and fixed on the way (`DEF-028-004`–`010`).
- **2026-08-19** — credential provisioned; the run surfaced `DEF-028-011`–`013` (masked exit codes,
  wrong model, read-only HOME), each fixed with tests (`T692`–`T698`).
- **2026-08-20** — `D-28` proxy delivered (Phase 8). **All seven steps PASS**: specification
  generated through the enforced `--internal` + sidecar shape, probe of a non-allowlisted
  destination **refused**, image digest recorded. [`v6-transcript.md`](./v6-transcript.md),
  Outcome PASSED. **`SC-AGT-001` is SATISFIED.**
- Governance: `G-28-01` gates the transcript's form; `G-28-02` (new) fails any PASSED transcript
  that does not prove enforcement — it rejected the first 2026-08-20 transcript for exactly that,
  and the evidence was regenerated by a second real run rather than edited.

**A green CI run is not evidence for `T646b` and must not be reported as one.**

## Commands, for reproduction

```bash
pnpm -r typecheck        # 14 packages
pnpm lint                # 0 errors, 0 warnings
pnpm test:unit           # 601 passed, 53 files
pnpm test:arch           # 22 passed
pnpm test:governance     # 200 passed, 14 files
pnpm typecheck:governance
pnpm test:integration    # 29 passed; audit-immutability FAILS — needs a container runtime (EPIC-004 T649)
```
