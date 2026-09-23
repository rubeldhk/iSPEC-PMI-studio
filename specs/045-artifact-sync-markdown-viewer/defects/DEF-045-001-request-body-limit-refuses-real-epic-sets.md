# DEF-045-001 — the API's request-body limit refused any real Epic's markdown set

**Epic**: `EPIC-045` | **Raised**: 2026-09-05 | **Status**: CLOSED 2026-09-05

**Originating task**: `T1638` (the sync route) and `T1645` (the limits documented) · found in the
branch review, reproduced against the composed application
**Severity**: HIGH — the finish hook sends an Epic's whole markdown set in one request; a real
Epic's four core files run past 110 KB, and the transport refused anything above about 100 KB as
`500 internal_error` before either documented artifact limit was consulted

## Expected

`FR-ART-002`, `FR-ART-008`: a sync carries up to `PMI_ARTIFACT_MAX_FILES` (200) files of up to
`PMI_ARTIFACT_MAX_BYTES` (1 MiB) each; a file over a limit is refused per file with a code. A body
the transport cannot accept is refused with a coded status, never a 500.

## Actual

Neither `main.ts` nor the test helper configured a body limit, so the framework default applied.
A sync carrying one 150 KB `analysis.md` answered `500 {"error":{"code":"internal_error"}}`: the
body parser's refusal is neither a `PlatformError` nor a framework `HttpException`, so
`ErrorFilter` mapped it to 500. Every integration scenario synced files of a few bytes, so the
suite could not see it; `EPIC-044`'s own `spec.md` (46 KB) plus `tasks.md` (36 KB) already exceed
the default together.

## Resolution

- `backend/src/core/http-body.ts` — the application is created with `bodyParser: false` and
  `configureBodyParsing` installs the JSON parser with `PMI_ARTIFACT_SYNC_BODY_BYTES` (default 16
  MiB) as its limit, in `main.ts` and in the test helper alike, so a deployment and an integration
  test share one limit. Global rather than per route: the parser runs before routing, and the
  routes that can carry a large body are exactly the ones this Epic already bounds.
- `ErrorFilter` translates the parser's `entity.too.large` to `413 payload_too_large` with the
  limit and the length in `details`; `payload_too_large` joins the error vocabulary (413).
- Documented in `.env.example`, README §Setup and the operator guide; `readme-conformance.spec.ts`
  now requires the third variable beside the two.
- Tests: `artifact-sync.spec.ts` — a 150 KB file syncs (`201`); a 20-file body above 16 MiB is
  `413 payload_too_large`.

## Lesson

Two limits were specified, implemented and documented while a third, older limit sat in front of
them and was never mentioned because nobody had set it. Every integration fixture was small enough
to pass under it. A test that carries a realistically sized payload belongs beside every limit a
spec names.
