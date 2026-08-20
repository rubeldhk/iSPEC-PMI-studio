# DEF-001-005 — every implicitly-injected controller dependency is undefined at runtime

**Epic**: `EPIC-001` (owns the API bootstrap and its runtime) · **affects** EPIC-006, EPIC-007,
EPIC-008, EPIC-013 — every product capability with a controller
**Raised**: 2026-08-20 | **Status**: **OPEN** — found by browser UAT, not fixed here
**Found by**: the second local UAT session, immediately after `DEF-005-001` unblocked sign-in
**Severity**: **CRITICAL** — the entire product surface 500s on every request; four Epics that
closed as delivered cannot serve a single call

## What was observed

Signed in successfully (the `DEF-005-001` fix holding), the Projects page returned:

```
GET  http://localhost:5173/v1/projects  500 (Internal Server Error)
POST http://localhost:5173/v1/projects  500 (Internal Server Error)
```

and the API log recorded them correctly as `"status":500` at `error` level — `DEF-001-004`'s fix
working, and the first time this platform's telemetry has accurately reported its own failure.

## Cause — measured across every controller

Resolving each controller from the composed graph and listing properties that are `undefined`:

```text
ProjectsController        UNDEFINED: projects
RequirementsController    UNDEFINED: requirements, retirer
EnginesController         UNDEFINED: registry
AuditController           ok
SpecificationsController  UNDEFINED: generation, reads, search
```

Seven dependencies across four controllers resolve to nothing. Each is declared the same way:

```ts
constructor(private readonly projects: ProjectsService) {}
```

Nest resolves a class-typed parameter through the `design:paramtypes` metadata TypeScript emits
under `emitDecoratorMetadata`. **The runtime is `tsx`, which compiles with esbuild, and esbuild
does not emit that metadata.** The container therefore injects `undefined` — silently, because a
missing metadata entry is indistinguishable from "no dependency" — and the first method call
throws `Cannot read properties of undefined`.

`AuditController` is unaffected for the reason that names the fix: it injects **by token**
(`@Inject(AUDIT_READER)`), which needs no metadata.

## Why every test passes

Controller unit tests construct their subject directly — `new ProjectsController(service)` — so
they exercise the class and never the container. Integration tests until today used the same
shortcut or bypassed HTTP. Nothing booted `AppModule` and issued a request, so nothing ever
observed what the container actually built. **This is the same gap that hid `DEF-005-001`**, and
it is the fifth instance of built-tested-called-by-nothing (`DEF-001-001`, `DEF-001-002`,
`DEF-028-005`, `DEF-005-001`).

It is also **not a dev-only concern**. `backend/package.json` defines no build script — the API
runs through `tsx` in every environment that exists today — so this is how the application would
behave in production as it currently ships.

## Remaining work

- Inject by token or with an explicit `@Inject(Class)` at all seven sites, matching
  `AuditController` and the two auth sites already corrected under `DEF-005-001`.
- Pair it with a check that can fail for this reason: extend
  `backend/tests/unit/auth/composition.spec.ts`'s approach to **every** controller — resolve each
  from the composed graph and assert no property is `undefined`. One test, all present and future
  controllers, and it fails the moment someone adds an implicitly-typed dependency.
- Decide, at platform level, whether the runtime should emit `design:paramtypes` at all (an SWC
  or `tsc` build step) rather than relying on discipline at every injection site. Either answer is
  defensible; leaving it undecided is what produced this defect.
- This record exists so the fix enters through a task (Constitution I, VI). **No code was changed
  by this UAT session.**
