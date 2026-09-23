# DEF-033-001 — the Room's approver, decider and actor kind are whatever the caller says they are

**Epic**: `EPIC-033` (owns `backend/src/modules/requirement-room/`) · affects **S1** and **S4**
**Raised**: 2026-08-27 | **Status**: **CLOSED — FIXED 2026-08-28** (`T1148`–`T1155`, the binding slice)
**Found by**: the S1/S4 reconsideration, applying `DEF-037-001`'s method — probe the mounted routes
rather than read them
**Severity**: **HIGH** — a baseline's approver, a decision's decider, and the human-versus-AI
distinction are all unverified strings taken from the request body, on routes that answer
unauthenticated callers

## What it does

`RequirementRoomModule` is registered in the production `AppModule` and its controller is mounted.
No route reads `@Req()`; none calls `requireWorkspaceContext`. Every route takes its workspace, its
actor and its authority from `@Body()` or `@Param()`. There is **no authorization call anywhere** in
`backend/src/modules/requirement-room/` — no `WorkspaceBoundaryService`, no access-scope check, no
delegation check.

Three consequences, in increasing order of seriousness.

### 1. Unauthenticated write into an arbitrary workspace

```
POST /v1/rooms/requirement/intake        (no cookie, no header)
  body: {"workspaceId":"ws_room", "projectId":"proj_1", "roomObjectId":"ro_1",
         "sourceRef":"doc_1", "text":"The system shall do the thing."}

  -> 201 {"id":"fb20e8a6-…","workspaceId":"ws_room","projectId":"proj_1",
          "normalizedText":"The system shall do the thing.","epistemic":"fact", …}
```

Verified 2026-08-27 against the composed `AppModule` on a Testcontainers PostgreSQL. A row was
created. The workspace came from the body.

### 2. The baseline approver is unverified — `S1`

`CreateBaselineInput.approvedBy` is a `string`, listed in `REQUIRED` so it must be **present**. It is
never resolved against `users`, never checked for membership of the workspace, never checked for
authority to approve. The same holds for `BaselineExceptionInput.authorizedBy`, which records who
waived a missing-acceptance-criteria precondition.

`S1`'s second acceptance scenario reads: *"the baseline is immutable and carries its approver,
rationale, timestamp and version."* It carries an approver. Nothing establishes that the approver
approved it.

The immutability is real — the trigger and the supersession chain do what they claim. That is what
makes this worse rather than better: the platform durably and unalterably records an attribution it
never verified.

### 3. The AI-decision refusal is a self-declaration — `S4`

This is the sharpest one. `decision.service.ts`:

```ts
if (input.actor?.kind !== 'human') {
  throw new ValidationFailedError(`a requirement decision is taken by a human; …`);
}
```

and the table carries `requirement_decisions_decided_by_a_human`, a `CHECK` over a `DecidedByKind`
enum of exactly `human | agent`.

Both are correct, and both read the same caller-supplied field. An agent posting
`{"actor":{"kind":"human","id":"u_anyone"}}` satisfies the service check, satisfies the constraint,
and is recorded as a human decision.

`backend/tests/integration/requirement-room-no-ai-decision.spec.ts` is a careful suite — it proves
the constraint refuses an `agent` row, that no third enum member exists to slip through, that the
rule is on the table rather than a droppable trigger, and it includes the acceptance control. Every
test inserts the kind directly. None asks where the value comes from. Its own comment names the
threat model precisely and narrowly:

> *"a well-formed row from a batch import or an automation that … got the one field that matters
> wrong"*

That is an honest automation getting it wrong. The unhandled case is a dishonest one getting it
right.

## Why this is the same defect as `DEF-037-001`

Both artifacts enforce the property they can see, and the property that matters is upstream of them.
EPIC-037's controller resolved a snapshot authoritatively and compared it to a sibling body field;
the Room checks an actor kind and compares it to a constraint over the value it just stored. In each
case the check is real, the comparison is sound, and both operands originate with the caller.

The distinction is worth stating because it will recur: **resolving or validating a field is not
authenticating its author.**

## Why it was not caught earlier

Nothing here is untested. S1 and S4 have 21 completed tasks and a substantial suite, including a
dedicated AI-refusal file. The tests exercise the services and the schema, and both are correct at
their own boundary. The missing test is the one that could only be written after asking a different
question — not *"does the service refuse an agent?"* but *"what makes `actor.kind` true?"*

## Fix — applied 2026-08-28 (`T1148`–`T1155`)

Authorised by the Project Owner as the binding slice.

**Where the rule lives.** In `RequirementRoomService`, not only the controller. The Room's own PC-1
principle says every capability stays callable without HTTP, and an MCP surface is planned — a
transport-level check would have left the next surface to repeat this. `DEF-037-001` is the same
lesson: a route that merely *reaches* its handler is readily mistaken for one that authenticated its
caller.

- `RequirementRoomService` takes a **required** `PrincipalResolver`. Required, not optional: an
  absent resolver would mean silently falling back to caller-supplied identity, which is the
  default-open this defect is.
- Every entry point begins with `acting()`, **before** any validation of the body. Validating first
  would tell an unauthenticated caller which fields a route wants.
- `workspaceId`, `approvedBy`, `askedBy`, `answeredBy`, `selectedBy` and `actor.kind` are taken from
  the resolved record. The returned `workspaceId` is the directory's, so nothing downstream can
  widen scope by naming another.
- `WorkspaceBoundaryService` (EPIC-024) is **consumed, not re-implemented**. It already refuses an
  actor that is unknown, in another workspace, suspended or revoked, and returns the record rather
  than echoing what it was handed.
- The controller reads `@Req()`, refuses with `401` via the same local `requireAuth` its thirteen
  siblings carry, and strips identity fields from every body. The strip changes no outcome — the
  service overwrites them anyway — but it states the rule where a reader looks first.
- The service check and the `requirement_decisions_decided_by_a_human` constraint are **unchanged**.
  They are now the second line they were always meant to be, checking a resolved fact.

**Proof** — `backend/tests/integration/requirement-room-identity-binding.spec.ts`, driven over real
HTTP against the composed application (19 tests):

- all nine routes answer `401` without a session, and nothing is written;
- a `workspaceId` in the body is ignored, and nothing reaches the workspace it named;
- an agent's session is refused **for being non-human** while its body claims `kind: 'human'` — with
  a human control that is not refused for that reason;
- a suspended principal and a cross-workspace session are both refused.

The `T1153` case is worth one note. Its first draft sent no options, and the refusal that came back
was the options rule rather than the actor rule — a passing test that proved nothing about identity.
It now sends two fully-stated options so the actor is the only thing left to refuse.

`ActorRecord.kind` maps to `ActorRef.kind` with `service` → `automation`. Dropping the member would
have quietly made a service account human.

## Why the remedy exists now and did not before

C3B delivered:

- `TrustedPrincipalFactory` (EPIC-028) — mints an unforgeable principal context, refusing unknown,
  foreign, suspended and revoked principals;
- `CompositePrincipalDirectory` (EPIC-024) — resolves humans against `users` and non-humans against
  the principal registry, so `kind` becomes a **resolved** property rather than a declared one;
- `PrincipalDelegationService` — with `NEVER_DELEGABLE` actions, which is where "approve a baseline"
  belongs.

When S1 and S4 were written none of this existed — that was `Y2`, which stopped EPIC-037 Band A at
C3A. A body-supplied `actor.kind` was, at the time, the only thing available. The defect is better
read as work that outran its dependency than as a check somebody forgot.

## How wide is this

Surveyed while confirming the fix was available. Of the nineteen controllers in
`backend/src/modules/`, **fourteen** resolve the caller through `requireAuth(ctx)` or
`requireWorkspaceContext(ctx)`; `projects` additionally calls `stripScope(body)` so a caller-supplied
workspace cannot widen the query. The pattern is established, documented and normal here.

Five do not:

| Controller | Assessment |
|---|---|
| `auth` | **Correct.** It serves unauthenticated callers by definition — sign-in |
| `engines` | One `@Get()` with no parameters. Low risk |
| `executions` | **Fixed** — unmounted at C3C closure (`DEF-037-001`) |
| `requirement-room` | **This defect.** Mounted, unguarded, unauthenticated write confirmed at `201` |
| `loop` | **Needs its own assessment.** Same shape — `POST /v1/loop/objects`, `POST /v1/loop/objects/:id/transitions`, and three `GET`s, with workspace from body or query. Both routes probed unauthenticated on 2026-08-27 returned `500`: the handler was **reached** without a session and failed on data, not on authentication. No successful unauthenticated write was demonstrated, so this is recorded as an observed pattern needing verification, **not** as a confirmed disclosure |

The Room is therefore an outlier rather than the norm, which is the encouraging reading. The
discouraging one is that `POST /v1/loop/objects/:id/transitions` is EPIC-030's transition endpoint —
the authority EPIC-037 was built to keep away from connectors — and it is in the same five.

## Related

- [`DEF-037-001`](../../037-governed-execution-registry/defects/DEF-037-001-execution-history-readable-without-authentication.md)
  — same class, found the same way, failed closed because EPIC-037 had no authentication boundary
  available. The Room's case differs: a **human** session boundary does exist and is simply not used.
- `S1` acceptance scenario 2; `S4` acceptance scenarios 2 and 3 and the story's premise, *"after an
  authorized human decides"*.
