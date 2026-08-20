# DEF-001-005 — every implicitly-injected controller dependency is undefined at runtime

**Epic**: `EPIC-001` (owns the API bootstrap and its runtime) · **affects** EPIC-006, EPIC-007,
EPIC-008, EPIC-013 — every product capability with a controller
**Raised**: 2026-08-20 | **Status**: **FIXED** 2026-08-20 by `T847`–`T850`; see Resolution
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

## Resolution (2026-08-20)

Fixed by EPIC-001 Phase 9, guard first.

- **`T847`** — `backend/tests/unit/core/controller-composition.spec.ts` resolves **every**
  controller from the composed graph and asserts no injected property is `undefined`. Confirmed
  failing first, naming all four controllers and all seven properties. It enumerates controllers
  from the Nest metadata of `AppModule`'s imports — including `DynamicModule` forms, which
  `AuthModule.register()` introduced — so a controller added later is covered without anyone
  remembering this file exists.
- **`T848`** — explicit `@Inject(Token)` at all seven sites. Two further traps surfaced while
  applying it, both invisible to the type checker:
  - **`import type` erases the token.** Four of the services were imported type-only, so
    `@Inject(Service)` referenced a binding that does not exist at runtime —
    `ReferenceError: EngineRegistryService is not defined`. Converted to value imports, with the
    narrow interface kept as the declared parameter type so the controllers still depend on a
    contract rather than an implementation (PC-1).
  - **`SpecificationsController` was already wired — and the wiring was never used.** Its module
    supplies a factory provider for the controller in `providers:`, but Nest builds controllers
    from `controllers:` by dependency injection and ignores a same-token entry in `providers:`.
    The wiring looked correct in review and did nothing. Its parameters are also *interfaces*,
    which erase entirely, so the concrete service classes are now the tokens.

**Verified in the running application** (`T850`), through the browser's own path via the Vite
proxy: sign-in `200` → `GET /v1/projects` `200` → `POST /v1/projects` `201`, project persisted and
returned in the subsequent list. 1101 unit tests, typecheck and lint clean.

**The runtime question is recorded, not settled** — see `T849` and
`specs/014-devops-release/`. Explicit tokens are now the enforced convention *and* the guard makes
a lapse fail immediately; a build step that emits `design:paramtypes` would make the convention
unnecessary. That is EPIC-014's call to make with the rest of the build.
