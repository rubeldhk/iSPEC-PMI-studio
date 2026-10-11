# DEF-039-001 — the application refuses to start when the database is unreachable, because the Embed binding observation is awaited at boot

**Status**: fixed · **Severity**: HIGH
**Found**: 2026-10-11, by `backend/tests/architecture/executions-mounted.spec.ts` (`T1418`, live half) during `T2235`'s architecture run · **Requirement**: `FR-HUB-084`, `R-039-18`; the platform's non-fatal-composition rule recorded in `T1418` (2026-09-19)

## Observed

`T1418`'s live half boots the real `AppModule` against an unreachable `DATABASE_URL`
(`postgresql://unused:unused@127.0.0.1:1/unused`) to show that every executions route is mounted
and refuses an absent credential. On this branch its `beforeAll` failed with
`PrismaClientInitializationError` thrown from `PrismaIntegrationsStore.latestObservation`
(`deploymentCapabilityBinding.findFirst`), the nine live cases were skipped, and the file failed.

## Expected

The application composes and serves its routes when the database is unreachable at boot — the
platform made the engine-registration load non-fatal for exactly this reason (`T1418`'s note of
2026-09-19). The Hub's snapshot of the deployment's `Embed` binding is held in memory; recording it
is an append-only history, and a failure to append must not take the application down.

## Cause

`IntegrationsModule.onModuleInit` awaits `DeploymentBindingService.observeAtBoot()` (`T2201`), whose
`record()` reads the latest observation and appends a changed one through the store. An unreachable
store made the read throw, and the throw propagated out of `onModuleInit`, aborting composition.
Introduced by `T2201` (`533b5d0`); not seen earlier because the architecture project had not been run
in full on this branch since.

## Fix

`observe()` keeps the snapshot it computed (the in-memory truth `HubEmbeddingPort` reads) and, when
recording fails, records the failure on the service (`recordingFault`) instead of throwing. The next
`recheck()` on the health tick compares with the latest row again and appends — so the history
catches up on the first tick after the store is reachable, and nothing is silently lost.

## Evidence

- `backend/tests/unit/integrations-deployment-binding.spec.ts` — new case *"an unreachable store
  does not abort boot; the next recheck records the observation"*: observed failing (the boot
  rejected) before the fix, green after.
- `backend/tests/architecture/executions-mounted.spec.ts` — the live half composes again: 13 of 13
  (previously 9 skipped, the file failed).
