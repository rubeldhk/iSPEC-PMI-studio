# Contract: the Change Room surface

**Epic**: `EPIC-034` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

**This Epic publishes no shared package.** The Room pattern is `EPIC-033`'s
`packages/room-contract`, imported unchanged (`R-034-3`). What this document specifies is the Change
Room's own surface: the types it owns, the ports it consumes, and the boundaries an architecture
test asserts.

---

## 1. Imported, not defined

```ts
import type {
  RoomShellProps,   // six required named region slots — UX-0030, UX-0035
  Epistemic,        // 'fact' | 'inference' | 'recommendation' | 'open-question'
  Labelled,
  RoomObjectRef,
} from '@pmi/room-contract';
```

**This Room defines no region vocabulary.** `EPIC-033` made the six regions required named JSX props,
so omitting one does not compile and a seventh has nowhere to go — a guarantee that only holds while
every Room imports rather than re-derives. `EPIC-033` Phase 2 is a **hard prerequisite** of this
Epic's implementation.

`RoomObjectRef.workflowType` is `'change-room'` — a value, not a new type. The field is an open
string precisely so the shared contract does not enumerate its consumers.

---

## 2. Impact — three states, eight areas, no absences

```ts
export const IMPACT_AREAS = [
  'requirements', 'specifications', 'architecture', 'tasks',
  'code', 'tests', 'release-scope', 'operational-effects',
] as const;

export type ImpactState = 'impacted' | 'not-impacted' | 'unknown';

export interface ImpactArea {
  readonly area: (typeof IMPACT_AREAS)[number];
  readonly state: ImpactState;
  readonly items?: readonly ArtifactRef[];      // when 'impacted'
  readonly unknownReason?: string;              // REQUIRED when 'unknown'
}

/** All eight, always. */
export type ImpactView = Readonly<Record<(typeof IMPACT_AREAS)[number], ImpactArea>>;
```

**`ImpactView` is a `Record` over the eight areas, not an array.** An array can be short; a record
cannot. `FR-CHR-032` says an undeterminable area must render `unknown` rather than be omitted, and
the spec gives the reason: *"an absent row and a clean row must not look alike."* A fixed record with
a required `state` makes the absent row unrepresentable.

`unknownReason` is required when `unknown` so the screen can say **why** — including the honest case
*"violation check not owned (`BR-0073`, `U-17`)"*, which is `FR-CHR-034`.

---

## 3. Trade-offs — six dimensions, each answered

```ts
export const TRADEOFF_DIMENSIONS = [
  'schedule', 'cost', 'quality', 'security', 'compatibility', 'delivery',
] as const;

export interface ChangeOption {
  readonly optionId: string;
  readonly summary: string;
  readonly reasoning: string;
  readonly tradeOffs: Readonly<Record<(typeof TRADEOFF_DIMENSIONS)[number], string | 'not-applicable'>>;
}

export type ChangeOptions = readonly [ChangeOption, ChangeOption, ...ChangeOption[]];
```

**`ChangeOptions` is a tuple of at least two.** `FR-CHR-040` requires two or more, and a
minimum-length tuple makes one option a compile error — the same move `EPIC-032` used for a
non-empty `subject`.

**`tradeOffs` is a `Record` over all six**, so a dimension cannot be skipped; it can only be answered
`'not-applicable'`, which is a statement rather than a silence. `FR-CHR-041` names security
explicitly, and a record is what stops it being the one that quietly goes missing.

Options are carried as `Labelled<ChangeOption>` with `epistemic: 'recommendation'` — never `fact`
(`FR-CHR-042`).

---

## 4. Re-plan — an obligation type, deliberately not an action

```ts
export interface RePlanObligation {
  readonly affectedSpecificationId: string;
  readonly whatMustChange: string;
  readonly why: string;
  readonly state: 'recorded' | 'discharged-by-U-12';
}
```

**There is no `execute()` and no call to `TaskRegenerationService`.** That service replaces a task
list; `BR-0154` requires revision **without destroying completed-work history** (`R-034-2`). The
contract offers no way to trigger a destructive regeneration from this Room, which is the difference
between a boundary and an intention.

`state` names `U-12` explicitly so the obligation's owner is legible from the type.

---

## 5. Ports this Room consumes

| Port | Filled by | Absent behaviour |
|---|---|---|
| `LoopEngine` | `EPIC-030` | refuse |
| `PolicyProvider` | `EPIC-031` | **refuse** — baseline change is permanently high band |
| `EvidenceContractSource` | `EPIC-032` | **refuse** — closure cannot complete on an unevaluated Contract |
| `BaselineReader` | `EPIC-033` | refuse — a change with no baseline is not a change |
| `ImpactSource` | `EPIC-020` / `dependencies` | **degrade to `unknown`**, do not refuse — see below |
| `TransferIntake` | `EPIC-035` | n/a — inbound |

**`ImpactSource` degrades rather than refusing**, and the asymmetry is deliberate — the second such
case in the Wave, after `EPIC-033`'s `AgentGateway`. An unavailable impact traversal does not mean
the change is ungoverned; it means one input is missing, and the type already has a member for that:
the affected areas become `unknown` with a reason. Refusing would block change control on a
traversal's availability, and `FR-CHR-032` exists precisely so a missing answer is representable.

Every other absent port means a **governance guarantee** cannot be evaluated, so refusing is correct.

---

## 6. HTTP surface — the real entry points

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/rooms/change/requests` | raise a Change Request against a baseline (`FR-CHR-010`) |
| `POST` | `/rooms/change/requests/:id/transfer-intake` | receive a Defect Room transfer (`FR-CHR-012`, `BR-0057`) |
| `GET` | `/rooms/change/requests/:id/impact` | the eight-area view (`FR-CHR-030`) |
| `POST` | `/rooms/change/requests/:id/options` | two or more, six dimensions each (`FR-CHR-040`) |
| `POST` | `/rooms/change/requests/:id/decide` | authorized human decision (`FR-CHR-050`) |
| `POST` | `/rooms/change/requests/:id/rebase` | explicit recorded rebase (`FR-CHR-013`, `R-034-5`) |
| `POST` | `/rooms/change/requests/:id/apply` | re-baseline; record the re-plan obligation (`FR-CHR-060`) |
| `POST` | `/rooms/change/requests/:id/close` | closure, gated on evidence (`FR-CHR-070`) |
| `GET` | `/rooms/change/requests/:id/delta` | the baseline delta (`FR-CHR-063`) |

`403` when policy refuses, carrying the `EPIC-031` decision id so the Room renders the refusing
policy (`FR-CHR-084`, `UX-0033`). `409` on a second change applying to a baseline the first already
superseded, carrying the rebase affordance (`FR-CHR-054`).

---

## 7. What this Room must never contain

Asserted by `backend/tests/architecture/change-room-independence.spec.ts`:

- **no region vocabulary of its own** — it imports `RoomShellProps`; deriving a shell would make
  `EPIC-033`'s compile-time `UX-0035` guarantee decorative;
- **no second impact traversal** — `FR-CHR-031`. A local traversal feels faster and is the boundary
  most likely to be crossed;
- **no call to `TaskRegenerationService`** — asserted as an import ban, because `R-034-2`'s trap is
  a service whose name matches the requirement it would violate;
- no requirement text — `EPIC-033` holds baselines by version id, and so does this Room;
- no Defect Room vocabulary — `EPIC-035` owns the transfer decision, this Room owns the reception.
