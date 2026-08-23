# Contract: the Room pattern and the Requirement Room surface

**Epic**: `EPIC-033` · **Phase**: 1 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Two contracts, and the first one is not this Epic's alone.

**`packages/room-contract`** holds the shared Room pattern — the six regions, the epistemic label,
the Room-object reference. `EPIC-034` and `EPIC-035` import it rather than re-deriving it.
**`frontend/src/rooms/RoomShell.tsx`** is its user-interface half.

**This Epic is the first Room, so what it names here the other two inherit.** That is the reason
this document exists as a shared contract rather than as a section of the Requirement Room's own.

---

## 1. The six regions — `UX-0030`, `UX-0035`, as a compile error

```tsx
export interface RoomShellProps {
  readonly objectState: React.ReactNode;
  readonly loopProgress: React.ReactNode;
  readonly aiAnalysis: React.ReactNode;
  readonly decision: React.ReactNode;
  readonly evidence: React.ReactNode;
  readonly activityTimeline: React.ReactNode;
}

export function RoomShell(props: RoomShellProps): JSX.Element;
```

**Six required named props, and deliberately no `children`.**

- A Room omitting a region **does not compile**. `UX-0030` stops being a convention.
- A Room inventing a seventh region has **nowhere to put it**. `UX-0035` — *"if one Room needs a
  seventh region, the pattern changes for all three"* — becomes a change to this file, which is
  exactly what that rule asks for.
- **The region vocabulary is the prop names.** Defined once, in one file, imported by three Epics.

React's documentation names the mechanism: `children` is for a hole filled with arbitrary JSX, and a
separate named prop is for *"if you want every `Card` to always have a title"* (`R-033-3`). Six
always-required regions is that case, six times.

`RoomShell` also owns the `UX-0041` breakpoints and the `UX-0040` 360px floor, so no Room sets its
own — `UX-0042` requires state, decision and evidence to remain visible at 360px, and one component
honouring that is better than three agreeing to.

---

## 2. The epistemic label — `UX-0031`, `FR-RQR-011`

```ts
export type Epistemic = 'fact' | 'inference' | 'recommendation' | 'open-question';

export interface Labelled<T> {
  readonly epistemic: Epistemic;   // required — no default, no optional variant
  readonly value: T;
}
```

**An unlabelled element is not constructible.** `FR-RQR-011` says it must not be *presentable*; a
required discriminant makes it unrepresentable one step earlier.

The visual treatment is **derived** from the discriminant by an `EPIC-029` token mapping, so the
label and the styling cannot disagree. `UX-0031` calls an unlabelled recommendation *"a governance
failure expressed as a styling choice"* — a failure introducible by a styling choice should not be
prevented only by one.

---

## 3. The Room object reference

```ts
export interface RoomObjectRef {
  readonly workflowType: string;   // 'requirement-room' | 'change-room' | 'defect-room'
  readonly objectId: string;       // EPIC-030 loop object
}
```

`workflowType` is a **string, not a union of the three Rooms**. A closed union here would make
`packages/room-contract` know its consumers, which is the coupling `FR-RQR-003` and `FR-GEL-061`
both forbid — and it would break the moment a fourth governed workflow is configured, which
`BR-0064` explicitly permits.

---

## 4. Ports this Room requires

| Port | Filled by | Absent behaviour |
|---|---|---|
| `LoopEngine` | `EPIC-030` | refuse — no transition without the loop |
| `PolicyProvider` | `EPIC-031` | **refuse** — `FR-GEL-062`; an undecided decision is not an approval |
| `EvidenceContractSource` | `EPIC-032` | refuse — a baseline cannot complete with an unevaluated Contract |
| `RequirementRegister` | **`EPIC-007`** | refuse — and **never** substituted by a local store (`FR-RQR-002`) |
| `AgentGateway` | `EPIC-028`, capability `analyze` | **degrade, do not refuse** — see below |

**`AgentGateway` is the one port that degrades rather than refusing**, and the asymmetry is
deliberate. Every other absent port means a governance guarantee cannot be evaluated, so refusing is
correct. An absent *analysis* provider means the AI could not help — the human can still clarify,
decide and baseline by hand. Refusing there would make the governed path depend on a model being
reachable, which inverts `RULE-03`: AI recommends, humans and policy govern.

---

## 5. HTTP surface — the real entry points

| Method | Route | Requirement |
|---|---|---|
| `POST` | `/rooms/requirement/intake` | multi-source intake → candidates (`FR-RQR-010`) |
| `POST` | `/rooms/requirement/:id/clarifications` | ask and answer, in one set (`FR-RQR-012`) |
| `GET` | `/rooms/requirement/:id/analysis` | labelled candidates, conflicts, gaps (`FR-RQR-014`) |
| `POST` | `/rooms/requirement/:id/options` | two or more, each a recommendation (`FR-RQR-020`) |
| `POST` | `/rooms/requirement/:id/decide` | authorized human decision (`FR-RQR-040`) |
| `POST` | `/rooms/requirement/:id/baseline` | freeze the set (`FR-RQR-050`) |
| `POST` | `/baselines/:version/handoff` | select as specification input (`FR-RQR-060`) |
| `GET` | `/rooms/requirement/:id/readiness` | what is blocking (`FR-RQR-073`) |

`403` when policy refuses the decision, carrying the `EPIC-031` decision id so the Room can render
the refusing policy (`FR-RQR-043`, `UX-0033`). `409` on an in-place edit of a baselined requirement,
carrying the Change Request affordance (`FR-RQR-051`).

---

## 6. What the Room contract must never contain

Asserted by `backend/tests/architecture/room-contract-independence.spec.ts`:

- **no requirement-storage type** — `FR-RQR-002`, `D-33`. This is the boundary this Epic is most
  likely to cross, because a local cache of requirement text would feel convenient every single day;
- no Change Room or Defect Room vocabulary, and no import from either module;
- no loop stage names — `EPIC-030` owns that vocabulary and `RoomShell` renders its projection;
- no risk band and no evidence type — `EPIC-031` and `EPIC-032` own those;
- **no closed union of workflow types** (§3), which would make the shared contract know its
  consumers.
