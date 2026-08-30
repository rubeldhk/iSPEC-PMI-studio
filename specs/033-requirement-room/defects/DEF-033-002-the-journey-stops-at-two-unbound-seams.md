# DEF-033-002 — the journey stops at two unbound governance seams, and says "An unexpected error occurred"

**Epic**: `EPIC-033` (found here) · **owned by** `EPIC-031` and `EPIC-032`
**Raised**: 2026-08-29 | **Status**: **OPEN** — item 3 closed by `EPIC-001` `T1195`; items 1 and 2 remain
**Found by**: driving the Room in a browser after Phase 11 built the decision and baseline controls
**Severity**: **HIGH** — the Epic's headline journey cannot be completed by anyone, and the reason
is invisible to the person it stops

## What happens

Phase 11 put the last two controls on the screen. A person can now enter two fully stated options,
choose one, give a rationale, and press **Record decision**. The response is:

> The decision was not recorded: **An unexpected error occurred.**

Approving a baseline fails the same way. So `SC-RQR-008` — *"a person can carry unstructured intent
through to an approved baseline"* — is **unreachable**, and stays unreachable however much UI is
built.

## Why, precisely

Two ports that `ROOM_PORTS` declares `absent: 'refuse'` have never been bound:

| Port | Filled by | Consequence |
|---|---|---|
| `PolicyProvider` | `EPIC-031` | `DecisionService.decide` throws `PolicyUnavailableError` before any decision is recorded |
| `EvidenceContractSource` | `EPIC-032` | `BaselineService.approve` throws `EvidenceSourceUnavailableError` before it reads the set |

**Both refusals are correct.** `FR-GEL-062` will not treat an undecided decision as an approval, and
`FR-RQR-053` will not let a baseline complete on an unevaluated Evidence Contract — `BR-0144` is
explicit that declaring completion is not the evidence. Neither seam should default to permitting;
the ports say so, and the reasoning is sound.

What is wrong is that nothing anywhere **says** this is the state.

## The message is the defect, and EPIC-033 was right not to fix it locally

`PolicyUnavailableError` **was** deliberately not a `PlatformError` — since `T1195` it is one. Its
comment recorded why it could not be:

> *"no documented status code means 'a governance seam is unbound', and `DEF-008-001` is what
> happens when an Epic that does not own `platform-api.md` invents one."*

That judgment holds, and this defect does not ask for it to be reversed. `provider_unavailable` (502)
looks like a fit and is not: it is documented in `platform-api-epic-002.md` for an unreachable
**storage provider**, and borrowing another Epic's documented meaning is the same mistake in a
different direction.

So the gap is real and belongs upstream: **the platform error vocabulary has no code for "a declared
governance seam is unbound"**, and until it does, every such refusal reaches a user as
`internal_error` — indistinguishable from a crash.

## What Phase 11 did about it

Not a workaround. The controls now **surface** the refusal rather than swallowing it, and keep what
was typed:

- `Decision` catches the failure, shows it in an `alert`, and preserves all ten fields — without
  this the form cleared and looked as though it had worked.
- `Baseline` never offers approval while readiness reports anything outstanding, and treats unknown
  readiness as not-ready. When it does refuse, the message is shown.

That is the honest local behaviour for a refusal this component cannot resolve.

## What is needed, and by whom

1. **`EPIC-031`** — **implement and then bind** a `PolicyProvider`. This was first written here as
   "bind a seam, same shape as `T1178`". That was wrong, and measuring it is what corrected it.
2. **`EPIC-032`** — the same for `EvidenceContractSource`.
3. ~~**Whoever owns `platform-api.md`** — a documented status and code for an unbound governance
   seam.~~ **Done 2026-08-29** — `EPIC-001` `T1195` added `governance_seam_unbound` (503). Both
   errors now carry it, and `decide` answers with *"the PolicyProvider seam is unbound — EPIC-031
   supplies it"* rather than *"An unexpected error occurred."*

**Items 1 and 2 are larger than this defect first implied.** Neither is a binding exercise: on
2026-08-29 `EPIC-031` had **92 open tasks and no backend module**, and `EPIC-032` had **83 open
tasks**. There is no implementation to register. A stub is not available either — `FR-GEL-062` and
`ROOM_PORTS` exist precisely because *a default that permits is invisible*, so a permissive
`PolicyProvider` would be the failure they were written to prevent, and a refusing one changes
nothing. Completing the journey means implementing those Epics.

**Why (3) was worth doing on its own.** It does not unblock the journey and was never going to. It
stops the *next* unbound seam presenting itself as a crash, which is the failure mode that made this
one take a browser session to find.

## Related

- **`X20`** — `LoopStore` could not list objects. Same class: a consumer reaching for a capability
  that had an owner and no schedule. Closed by `EPIC-030` `T1176`–`T1177`.
- **`T1178`** — thirteen in-memory stores, none overridden at the composition root. Same class again,
  and the reason this one is recognisable on sight.
- **`DEF-001-006`** — why the client sees `internal_error` rather than the thrown message.
