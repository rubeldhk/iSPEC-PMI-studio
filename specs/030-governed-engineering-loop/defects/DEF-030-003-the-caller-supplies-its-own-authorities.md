# DEF-030-003 — the transition caller supplies its own authorities

**Epic**: `EPIC-030` (owns `backend/src/modules/loop/`)
**Raised**: 2026-08-28 | **Status**: **OPEN — latent**
**Found by**: the `R4` assessment, authorised after `DEF-033-001` found the same controller shape
**Severity**: **MEDIUM** — a privilege-escalation path that is **not reachable in the current
wiring**, and becomes reachable the moment either half of the loop's configuration is completed

## The finding

`LoopController.transition` binds `TransitionBody`, which declares:

```ts
readonly actor: TransitionInput['actor'];
readonly actorAuthorities?: readonly string[];
```

`LoopService.transition` passes it straight through:

```ts
actor: {
  kind: input.actor.kind === 'human' ? 'human' : 'automation',
  id: input.actor.id,
  authorities: input.actorAuthorities ?? [],
},
```

and `evaluateAuthority` decides on it:

```ts
const basis = required.find((authority) => input.actorAuthorities.includes(authority));
```

So the authority gate asks: **does the list you sent me contain the authority I require?**

This is a category beyond `DEF-033-001`. The Room let a caller assert an *identity*; this lets a
caller assert an *authorisation*. It sits on `POST /v1/loop/objects/:id/transitions` — the governed
lifecycle transition, which is the authority EPIC-037 was built to keep connectors away from.

Sixteen lines above it, the same function states the principle it then breaks:

> *"FR-GEL-004 — the OBJECT's type resolves the configuration, never the caller's. A caller naming a
> workflow type is a caller choosing its own rules."*

A caller naming its own authorities is choosing its own rules more directly than naming a workflow
type would.

## Why it is latent, and not live

This was probed against the composed application on a real database, and the module is **inert as
wired**. Three independent reasons, any one of which is sufficient:

| Wiring | Effect |
|---|---|
| `LOOP_STAGE_HANDLERS` → `new StageRegistry([])`, and nothing registers handlers | Every workflow type is refused at `declareObject`. **All four types tried returned `500`** — no loop object can be created through the API |
| `LOOP_STORE` → `InMemoryLoopStore` | Nothing persists. A `loop_objects` row seeded directly in PostgreSQL was invisible to every route (`404 no loop object lo_secret`), because the API never reads that table |
| `LoopService` is constructed as `new LoopService(store, configs)` — no `AuthorityMap` | It defaults to `{}`, and `evaluateAuthority` refuses on `required === undefined` **before** `actorAuthorities` is read |

The third is the important one: today the caller's list is never consulted, because no transition
has a configured requirement. `FR-GEL-062` makes that absence a refusal rather than a pass, and the
module header is explicit that the asymmetry is deliberate — an in-memory store loses data visibly,
whereas a default policy that permits is invisible.

So this is an honest incomplete-and-fail-closed state, not a hole someone left open.

**It flips to live the moment `AuthorityMap` is populated.** That is the tenant half of the
configuration — the half the loop exists to enforce — so it will be populated.

## Two further latent defects in the same controller

Recorded here rather than separately, because one fix addresses all three.

**The read routes carry no tenancy at all.** `history(objectId)`, `progressOf(objectId)` and
`exceptions(objectId)` take an object id and nothing else — no workspace, from the session or
otherwise. Today the in-memory store is empty in production, so nothing leaks; the moment a
persistent store is wired, any object id becomes readable by anyone who can reach the port. This is
`DEF-037-001`'s `GET …/history` exactly, one epic over, waiting for a store.

**`declareObject` takes `workspaceId` and `actorId` from the body**, and `actor.kind` on a transition
is the same self-declaration `DEF-033-001` documents — a body claiming `human` is recorded as human.

## The remedy already exists in this module

`PolicyProvider` declares an authoritative resolver, and `adjudicator.service.ts` already uses it:

```ts
const held = await this.policy.actorAuthorities(proposal.workspaceId, actorId);
```

So the adjudication path resolves authorities from the policy provider, while the transition path
reads them from the request body. The two halves of the same module disagree about where an
authority comes from, and the wrong half is the one on the public route.

The fix is to make the transition path do what the adjudication path already does, and to take
`workspaceId` and the actor from the session as `EPIC-033` now does (`T1148`–`T1155`).

## Recommendation — sequence, not urgency

No containment is proposed. Unmounting the controller, as `DEF-037-001` required, would be
disproportionate: nothing is reachable, nothing is stored, and the routes refuse.

What matters is **ordering**. This must be fixed *before* either of these lands:

1. anything that populates `AuthorityMap`;
2. anything that replaces `InMemoryLoopStore` with a persistent one.

Either one converts every finding above from latent to live, and both are ordinary next steps for
this Epic rather than distant ones. A fix afterwards would be a fix to a system that had already
been running with a self-service authority gate.

## Related

- [`DEF-033-001`](../../033-requirement-room/defects/DEF-033-001-the-approver-and-the-actor-kind-are-caller-supplied.md)
  — same controller shape, found first, live rather than latent, fixed 2026-08-28. Its remedy is the
  template: resolve in the service, consume `EPIC-024`, keep the existing checks as the second line.
- [`DEF-037-001`](../../037-governed-execution-registry/defects/DEF-037-001-execution-history-readable-without-authentication.md)
  — the unauthenticated `GET …/history` this Epic's read routes will become once a store is wired.
- [`DEF-030-001`](./DEF-030-001-unmatched-route-returns-500.md) — why every `declareObject` refusal
  above reads `500 An unexpected error occurred` instead of naming the unregistered workflow type.
  It made this assessment slower and would make a real diagnosis slower still.
