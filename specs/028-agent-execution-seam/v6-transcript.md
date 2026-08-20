# V6 — real container run transcript

**Task**: `T646b` · **Outcome**: FAILED · **Started**: 2026-08-20T00:11:52.966Z

**Image digest**: `sha256:5fbd6aefd23d9fc244a6957f6d3192eaaac8f86693849cc1c8773d4b0edb6dad`

## Steps

- [PASS] resolve_environment — docker
- [PASS] resolve_agent — anthropic/claude-opus-5
- [PASS] start_container
- [PASS] record_image_digest — sha256:5fbd6aefd23d9fc244a6957f6d3192eaaac8f86693849cc1c8773d4b0edb6dad
- [FAIL] generate_specification — engine_error: The engine ran and failed.
- [PASS] stop_container

## What this transcript does and does not prove

- It proves a **real container started** on a real daemon.
- It identifies **which image** ran, by digest, rather than by a moving tag.
- It does **not** prove a specification was generated. The engine did not complete, so `SC-AGT-001` is **NOT** satisfied by this run — see the failing step above for where it stopped.
- It does **not** prove CI can do the same. RAID `R-04` blocks
  container-in-container, so this is run by hand and committed as evidence.
- A green CI run is **not** evidence for `T646b` and must never be reported as one.
