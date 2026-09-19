# DEF-026-005 — `DOR-11` passed on a directory git never carried

**Epic**: `EPIC-026` (owns the DOR) · corrections land across **22 Epic directories**
**Raised**: 2026-08-19 | **Status**: **CLOSED — FIXED 2026-08-19**
**Found by**: CI run `32268636044`, on the first push where a `Held`-free Epic reached `Ready`
**Severity**: **HIGH** — the register published a readiness verdict that CI could not reproduce

## What happened

`fc88688` committed a register showing **EPIC-003** and **EPIC-004** as `Ready | /speckit-implement`.
Every local gate passed, including `G-26-03`, which asserts the committed register agrees
byte-for-byte with a fresh generation. CI regenerated it and disagreed at line 16:

```
committed:  | EPIC-003 | … | delivery | Ready    | —       | Ready     | `/speckit-implement` |
generated:  | EPIC-003 | … | delivery | Analyzed | stalled | Not ready | `DOR evaluation`     |
```

## Why

`DOR-11` requires the `defects/` folder to exist, and its reasoning is correct:

> Constitution VI requires the folder. Its absence means no defect COULD have been recorded, which
> is not the same as none having occurred.

The folder exists in the working tree of anyone who has run the programme. It is **empty** in 22 of
the 28 Epics — and **git does not track empty directories**. So `defects/` was never committed, never
checked out in CI, and `DOR-11` evaluated two different trees:

| | local | CI |
|---|---|---|
| `specs/003-specification-engine/defects/` | exists, empty | **absent** |
| `DOR-11` | passes — no open defects | fails — folder missing |
| EPIC-003 | `Ready` | `Analyzed`, `stalled` |

## The class this belongs to

**A check that names the right condition and cannot observe it** — the twelfth instance recorded in
this repository, and the first where the unobservable half was the *version control system* rather
than the code. `DOR-11` is not wrong. Constitution VI is not wrong. The repository simply could not
carry the evidence the check depends on, and nothing said so.

It also explains why this surfaced only now. `DOR-11` has been divergent since it was written, but
until 2026-08-19 the only Epics near readiness were EPIC-018, 026, 027 and 028 — every one of which
has **real defect files**, so their folders were tracked and the two trees agreed by accident of
content. The divergence needed an Epic with a genuinely empty `defects/` to reach `Ready`, which
happened the moment the `D-1` deferral cleared the checklist gate.

**Local gates were not weaker than CI's — they measured a tree CI does not have.** That is the part
worth remembering: a green local run is evidence about the local working tree, and only about that.

## The fix

A tracked `.gitkeep` in each of the 22 empty `defects/` folders, so the directory git already
required is one git can actually carry.

Rejected: relaxing `DOR-11` to pass when the folder is absent. That inverts Constitution VI —
"nobody recorded a defect" and "nobody could have recorded a defect" would become the same verdict,
which is exactly the distinction the condition exists to draw.

## The guard

`G-26-13` asserts that every Epic directory carrying a `defects/` folder has it **tracked by git**,
by consulting the index rather than the filesystem. A check that reads only the working tree cannot
see this class of fault, which is how it survived to begin with.
