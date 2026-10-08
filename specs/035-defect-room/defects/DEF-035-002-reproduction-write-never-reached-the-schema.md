# DEF-035-002 — a reproduction cannot be written to PostgreSQL

**Epic**: `EPIC-035` | **Raised**: 2026-10-08 | **Status**: OPEN
**Found by**: `EPIC-032` `T1797` (convergence), binding `EvidenceStore` and driving
`POST /rooms/defect/:id/reproduction` through the composed application
**Severity**: HIGH — every reproduction recorded through the API answers `500`, and binding the
evidence store first would leave orphaned evidence behind each one

## Expected

`spec.md` §Key Entities: *"Reproduction: environment, steps, intermittency and evidence for the
contested behaviour."* The table `defect_reproductions` (migration `20260831000000_epic035_defect_room`)
agrees: `"steps" TEXT NOT NULL`, `"affectedBehaviour" TEXT NOT NULL`.

## Actual

The domain and the schema disagree in two places, and `PrismaDefectRoomStore.recordReproduction`
spreads the domain row straight into `prisma.reproduction.create({ data: { ...row } })`:

| Domain (`ReproductionRow`, `RecordReproductionInput`) | Schema (`Reproduction`) |
|---|---|
| `affectedBehaviourRef` | `affectedBehaviour` — no such field `affectedBehaviourRef` |
| *(absent — no `steps` anywhere in the input or the row)* | `steps` — required |

So the create is rejected, `ErrorFilter` reports `internal_error`, and nothing is written. The
in-memory store accepts the row, which is why every unit test is green.

**Why nothing noticed.** The one HTTP test of this route
(`defect-room-triage-route.spec.ts`, *"refuses evidence while EPIC-032 is unbound"*) sends evidence,
and `EvidenceStore` was unbound — so the request was refused with `400` **before** the write, and the
write was never reached. A reproduction with no evidence (`not-reproduced`) would hit the same `500`.

## What `EPIC-032` did and did not do

- **Built** `backend/src/modules/defect-room/evidence-store.adapter.ts` — the `EvidenceStore` port
  over `EvidenceService.contribute`, attesting the version the defect contests (`FR-EVS-042`), with
  `defect-room-evidence-store-adapter.spec.ts` (9 tests).
- **Did not bind it.** Binding first would file the evidence in the append-only store and then
  `500` on the reproduction — evidence citing a reproduction that does not exist, which is worse than
  today's clean refusal. The binding is a three-line change in `defect-room.module.ts`
  (`imports: [..., EvidenceModule]`, inject `EvidenceService`, pass
  `new EvidenceServiceStore(store, evidence)` to `ReproductionService`) and waits on this record.

## Resolution needed (EPIC-035)

1. Decide where `steps` comes from — the spec names it; the API never asks for it — and add it to
   `RecordReproductionInput`, the controller and `ReproductionRow`.
2. Map `affectedBehaviourRef` ↔ `affectedBehaviour` in `defect-room.store.prisma.ts`, both ways.
3. A Prisma-backed test that records a reproduction — with and without evidence — through the route.
4. Then bind `EvidenceStore` (`EPIC-032` `T1797`).
