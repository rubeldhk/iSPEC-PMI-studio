# D-45 — where does containerised local deployment live, and does it wait for the closure gate?

**Status**: **DECIDED 2026-08-24** by the project owner — **amend `EPIC-014` and carve an early
phase**; the "runs last" dependency is scoped to the release gate, not to the whole Epic ·
**Raised**: 2026-08-24 during `EPIC-036` UAT
**Owner**: EPIC-014 (owns developer enablement and the promotion pipeline)
**Evidence**: [`R-036-3`](../../036-application-shell/research.md) · [`EPIC-036` closure record](../../036-application-shell/closure.md)

## The question

A UAT session asked for the platform to be rebuilt and deployed to local Docker. It cannot be.
`docker-compose.yml` defines **only `postgres` and `valkey`**; there is no `Dockerfile` anywhere in
the repository; the API runs from source through `tsx` on the host; and **nothing serves the built
web client at all**.

`EPIC-036` recorded that gap rather than filling it. `R-036-3` states it plainly — *"Nothing else in
this repository serves the built client… the production case belongs to whoever owns serving the
client — which today is **nobody**"* — and names the consequence in `EPIC-036`'s closure record:
that Epic does **not** prove deep links survive a refresh outside the Vite dev server.

So: who builds it, and when?

## The two answers

**(a) A new Epic — `EPIC-037 Containerised Deployment`.** Rejected, for three reasons that
compound:

1. **`R-036-3` already names the owner**: *"the gap is `EPIC-014`'s."* Standing up a second Epic for
   it would create **two owners for deployment**, which is the shape `PP-002` (Single Source of
   Truth) exists to prevent and the shape `EPIC-036` spent four convergence passes removing from its
   own registry.
2. **It would spend the last identifier.** 998 of 999 three-digit task prefixes are allocated;
   `T864` is the only one free. Burning it on a duplicate owner leaves the corpus with none while
   **`EPIC-026` still owes the widening decision** (`T441n`, `EPIC-036` `handovers.md`).
3. It answers a scheduling problem with a governance change, which is the more expensive of the two.

**(b) Amend `EPIC-014`, and carve the work as an early phase — in force.** Containerised local
deployment is **developer enablement**, which this Epic already owns and has already delivered twice:
`T149`/`T149a` (the seed) and `T150`/`T452` (the README) are done and closed. It needs **no new
three-digit prefix** — sub-lettering under the Epic's existing block is the established pattern here
(`T149a`, `T151a`, `T152a`, `T152b`, `T155a` all exist), so `T864` stays free.

## What this changes in `EPIC-014`, and why it is a correction

The Epic's *Depends on* section reads:

> **Every other epic, including EPIC-015** — this is the final closure gate and runs last

**That sentence is already inaccurate**, and has been since 2026-08-20: four tasks — the seed, its
unit tests, the README and its conformance check — ran and closed long before the other Epics. The
Epic has always contained work that depends on nothing.

The dependency is real, but it belongs to the **release gate** (`T151`–`T156`, `F-11.2`), not to the
Epic. Confirming fifteen `closure.md` records genuinely must run last. Writing a `Dockerfile` does
not. Amending the line to say which half it governs makes the document describe what the Epic has
been doing all along, and unblocks the containerisation work without weakening the gate by a single
clause.

## What was deliberately not decided here

- **Which base images, which static server, which compose topology.** Design belongs in
  `/speckit-plan`, not in the decision that says where the work lives.
- **Whether `dev`, `stage` or `prod` are containerised.** This Epic delivers **local**.
  Constitution VII's promotion path is untouched, and `BR-0090` still owns it. A container that runs
  on a developer's machine proves nothing about a deployed environment, and the amended scope says
  so rather than implying otherwise.
- **Whether the reference local stack survives.** It must — `EPIC-036` `T442l` defines it and
  `SC-SHL-006`'s p95 was measured on it. A measurement taken on a different stack answers a
  different question, so the containerised stack is an **addition**, never a replacement.
