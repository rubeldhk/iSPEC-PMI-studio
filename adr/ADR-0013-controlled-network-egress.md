# ADR-0013 — Controlled network egress

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: Tech lead (architecture) · project owner (open items)

> Created by **EPIC-027 `T627`/`T659`** under decision `D-35`: all seventeen ADR subjects
> named by Native §27 and Cosmos §9 are recorded now, each either decided or explicitly
> **open naming what it awaits**. Native §26 forbids answering by assumption, and an ADR that
> exists as an open question is what prevents one.

## Context

Conflict `C-22`, and the amendment's **only direct conflict with a built and tested control**.
`ADR-0002` permits egress to the AI provider endpoint only, asserted by a test. Native §19 requires
that policy re-evaluated because implementation agents may need package registries, repository
endpoints and MCP servers — while also warning: *"Do NOT simply open general internet access."*

## Decision

**Named `EgressProfile` values, proxy-enforced** (`D-28`).

`generation` keeps today's policy **and today's test, unchanged** — frozen by a committed content
hash so a change to it fails a check rather than passing quietly.

`implementation` is a new, deliberately minimal profile with one destination. A guessed
npm/PyPI/GitHub list would be untested, would read as authoritative, and would be inherited as
settled (`R-028-6`).

`assertEgressProfile` rejects `*`, `0.0.0.0/0`, `::/0` and an empty destination list. A provider
declaring `supportsNetworkPolicy: false` cannot accept any profile at all.

**`ADR-0002` is EXTENDED, not superseded** (`D-36`).

## Consequences

**Positive** — the policy becomes auditable rather than merely configured, which matters more
under `D-31` because the sandbox host is shared between tenants.

**Negative** — a proxy is a new operational component, and it lands on the SaaS platform rather than
on a customer. The concrete destination list for `implementation` stays open (`R-AI-009`).

## Delivery (amended 2026-08-19 — D-28 Option A, decided by the project owner)

**The proxy is delivered** (EPIC-028 Phase 8, `T701`–`T708`), and enforcement is expressed as:

- the profile's network `pmi-egress-<profile>` is **`--internal`** — the sandbox has no route out;
- a **proxy sidecar** (`pmi-egress-proxy-<profile>`, Tinyproxy in whitelist mode) is dual-homed
  between that network and a routable one, its allowlist **generated from the profile's
  `allowedDestinations`** (`proxy-config.ts`) — never written by hand, so filter and profile
  cannot drift;
- the sandbox is pointed at the sidecar via `HTTPS_PROXY`/`HTTP_PROXY`, injected at the provider
  seam from the profile name — `sandbox.json` and `GENERATION_EGRESS_PROFILE` stay frozen
  (`SC-AGT-005`);
- the provider's preflight refuses a network that merely exists: non-internal, or missing its
  sidecar, is `policy_refused` (`DEF-028-015`).

Operators bring the shape up with `node scripts/egress-proxy-up.mjs <profile>`. The alternative —
amending `ADR-0002`'s promise instead of building the enforcement — was considered and rejected:
the 2026-08-14 session had already refused to widen the generation posture, and a rule is worth
what it costs to keep on the day it is inconvenient.

## Traceability

C-22 · D-28 · D-36 · R-AI-009 · R-028-8 · DEF-028-015 · SC-AGT-005 · extends ADR-0002 ·
delivered by EPIC-028 `T701`–`T708`
