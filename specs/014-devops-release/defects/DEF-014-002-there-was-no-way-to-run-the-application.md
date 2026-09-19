# DEF-014-002 — there was no way to run the application

**Epic**: `EPIC-014` (owns developer enablement)
**Raised**: 2026-08-23 | **Status**: **CLOSED — FIXED 2026-08-23** (`T149`, `T150`)
**Found by**: rebuilding the stack against local Docker for a UAT — the step after
[`DEF-014-001`](./DEF-014-001-quickstart-setup-names-a-service-that-does-not-exist.md)
**Severity**: **HIGH** — the application could not be started by any documented means. Every
validation scenario, and every UAT, begins by starting it

## What it is

`specs/_shared/quickstart.md`'s Setup block ends:

```bash
pnpm dev                             # api :3000, worker, web :5173
```

There is **no `dev` script** in the root `package.json`. There was none in `backend/package.json`
either — that file held exactly one script, `typecheck` — and none in `worker/package.json`. The
only runnable surface in the repository was `frontend`'s `vite`.

So the documented command fails, and there is no undocumented one to fall back on. The API and the
worker had entry points (`backend/src/main.ts` listens on `PORT ?? 3000`; `worker/src/main.ts`
exists) and no way to invoke them that anybody had written down.

`backend`'s missing `seed` script is the same defect one line earlier:
`pnpm --filter backend seed` is documented, and was not a script.

## Why it survived

The same reason as `DEF-014-001`, one step further along: **nothing executes the Setup block.**
`T153` runs validation scenarios V1–V12, which begin after the environment is up. Every test suite
imports modules directly — `AppModule` in a reachability test, `App` in a jsdom render — so the
whole test estate can be green while the application cannot be started by a person.

This is the same shape as the eight built-but-never-wired defects, applied to the repository rather
than to a module: each part existed and behaved, and nothing asked whether the thing as a whole
could be run.

## Fix

- `backend/package.json` — `dev`, `start`, and `seed`, all via
  `tsx --env-file-if-exists=../.env` so the root `.env` is loaded. Without that flag Prisma and the
  API cannot see `DATABASE_URL`, because `--filter` moves the working directory.
- `worker/package.json` — `dev` and `start`, same shape.
- `specs/_shared/quickstart.md` and `README.md` — the three commands, run in separate terminals.

**No process runner was added.** `concurrently`, `npm-run-all` and `turbo` are all absent, and
`specs/_shared/dependencies.md` states that *"a new runtime dependency is a plan change, not a task
decision"* (Constitution I). Writing a root `pnpm dev` that started only the web client would have
made the documentation true and the comment beside it false, which is worse than the original
defect. Three commands that work beat one that lies.

## What is still not checked

`T452` compares the README against the quickstart, so the two now agree — but agreement is not
execution. Nothing runs `pnpm --filter backend start` and asserts the API answers. A smoke check
that boots the stack and hits `/v1/auth/me` would have caught both of these defects on the day they
appeared, and belongs with `T153`'s scenario run.

## Links

- `backend/src/main.ts`, `worker/src/main.ts` — the entry points that existed all along
- `specs/_shared/dependencies.md` — the dependency policy that rules out a process runner here
