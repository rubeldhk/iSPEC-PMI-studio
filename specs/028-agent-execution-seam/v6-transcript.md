# V6 — real container run transcript

**Task**: `T646b` · **Outcome**: PASSED · **Started**: 2026-08-20T03:16:06.778Z

**Image digest**: `sha256:5fbd6aefd23d9fc244a6957f6d3192eaaac8f86693849cc1c8773d4b0edb6dad`

## Steps

- [PASS] resolve_environment — docker
- [PASS] resolve_agent — anthropic/claude-opus-5
- [PASS] start_container
- [PASS] record_image_digest — sha256:5fbd6aefd23d9fc244a6957f6d3192eaaac8f86693849cc1c8773d4b0edb6dad
- [PASS] generate_specification — produced "Feature Specification: Requirements-to-Specification Generation"
- [PASS] probe_refused_destination — probe of https://example.com was refused — no direct route out; the profile is enforced (D-28)
- [PASS] stop_container

## Egress enforcement (D-28)

- The run rode `pmi-egress-generation`, which the provider verified **internal** with
  the proxy sidecar `pmi-egress-proxy-generation` attached — the preflight refuses to
  start otherwise (`DEF-028-015`), so the started container is the proof of shape.
- The agent reached `api.anthropic.com` only through the sidecar, whose whitelist is
  generated from the profile; the refused probe above shows there was no other way out.

## What this transcript does and does not prove

- It proves a **real container started** on a real daemon.
- It identifies **which image** ran, by digest, rather than by a moving tag.
- It proves the engine ran **inside that container** and produced a specification.
- It does **not** prove CI can do the same. RAID `R-04` blocks
  container-in-container, so this is run by hand and committed as evidence.
- A green CI run is **not** evidence for `T646b` and must never be reported as one.
