# D-40 — should the API be built by a compiler that emits `design:paramtypes`?

**Status**: **DECIDED 2026-08-20** by the project owner — **(a) explicit tokens**, and the dead
flag deleted · **Raised**: 2026-08-20 by `T849`
**Owner**: EPIC-014 (owns the build and the promotion pipeline)
**Evidence**: [`DEF-001-005`](../001-platform-foundation/defects/DEF-001-005-implicit-class-injection-is-undefined-at-runtime.md)

## The question

Nest resolves a class-typed constructor parameter through the `design:paramtypes` metadata
TypeScript emits under `emitDecoratorMetadata`. This repository's `tsconfig.base.json` sets that
flag — but nothing here is compiled by `tsc`. `backend/package.json` declares **no build script**;
the API runs through `tsx`, which compiles with esbuild, and esbuild does not emit that metadata.

So the flag is set, the code is written as though it applied, and at runtime it does not exist.
Seven dependencies across four controllers silently resolved to `undefined` and every product
endpoint returned 500 — found by browser UAT, not by 1000+ green tests.

## The two answers

**(a) Explicit tokens — in force today.** Every injection site uses `@Inject(Token)`, which needs
no metadata and works under any runtime. Already the house style for token-provided dependencies
(`AUDIT_WRITER`, `JOB_STORE`, `IDENTITY_PROVIDER`), now applied to the class-typed ones too, and
enforced by `backend/tests/unit/core/controller-composition.spec.ts`, which resolves every
controller from the composed graph and fails on any `undefined` property.

*Cost*: a convention to remember at every new injection site. *Mitigation*: the guard fails
immediately and names the property, so the convention cannot be forgotten silently.

**(b) A build step that emits the metadata** — `tsc` or SWC producing `dist/`, run in every
environment including local development.

*Benefit*: implicit injection simply works, and the `emitDecoratorMetadata` setting stops being a
statement the runtime contradicts. *Cost*: a real build in the loop; the dev runtime changes; and
the guard from (a) is still worth keeping, because it is what proves either answer is true.

## Why this belongs to EPIC-014 and not to the defect

The defect is closed either way — the application works today under (a). What remains is a
decision about **how this platform is built**, which is `F-11.2`'s subject alongside the Prisma
composition root every closure since EPIC-001 has deferred to the same place. Deciding it here, in
a defect record, would settle a build question inside a bug fix.

**Not deciding is what produced `DEF-001-005`**: the configuration said one thing, the runtime did
another, and nobody owned the gap. This record gives it an owner.

## The decision (2026-08-20)

**(a) Explicit tokens — and `emitDecoratorMetadata` deleted from `tsconfig.base.json`.**

The record as first written left the flag in place. That was incomplete: the flag is not neutral,
it is **the configuration that made incorrect code look correct**. Nothing else in the repository
needs it — validation is hand-rolled, with no `class-validator` or `class-transformer` anywhere —
so removing it costs nothing and removes the trap. `experimentalDecorators` stays; esbuild honours
that one and decorator syntax requires it.

**Why (a) over (b).** Explicit tokens are correct under `tsx` **and** under a compiled build. A
production `dist/` may well be wanted later — running `tsx` in production is unusual — but that is
a *packaging* question, and `F-11.2` still owns it. Choosing (b) now would settle packaging as a
side effect of fixing an injection bug: exactly the conflation this record was created to prevent.

**What this obliges**: every injection site uses `@Inject(Token)`, including class-typed ones. The
convention cannot be forgotten silently — `backend/tests/unit/core/controller-composition.spec.ts`
resolves every controller from the composed graph and fails on any `undefined` property, naming it.

**Verified**: `tsc --noEmit` clean across the backend and the composition guard green (13 tests)
with the flag removed — confirming it was inert, which was the whole finding.

**Left open for `F-11.2`**: whether the API ships as a compiled `dist/` or continues to run through
`tsx`. This decision is deliberately silent on that and stays valid either way.
