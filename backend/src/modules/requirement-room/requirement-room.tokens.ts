/**
 * T337r — injection tokens for the five seams. `FR-RQR-002`, `FR-RQR-003`,
 * `FR-GEL-062`.
 *
 * `@Inject(Token)` everywhere, explicitly. `emitDecoratorMetadata` is absent
 * from `tsconfig.base.json` (`D-40`) because nothing here is compiled by `tsc` —
 * the API runs through `tsx` and esbuild emits no `design:paramtypes` — so
 * implicit injection asserts something the runtime contradicts, which is how
 * `DEF-001-005` got seven undefined dependencies past 1000+ green tests.
 *
 * **The absent-behaviour of each token is declared in `@pmi/room-contract`'s
 * `ROOM_PORTS`, not restated here.** Four refuse, one degrades, and the reasons
 * live with the declaration so `EPIC-034` and `EPIC-035` inherit them rather
 * than re-deriving them. This file binds names to symbols; it does not decide
 * policy.
 *
 * **Nothing is defaulted.** No permissive `PolicyProvider`, no in-memory
 * requirement register. `EPIC-030`'s module comment states the asymmetry that
 * applies here too: an in-memory *store* loses data, which is visible and
 * testable, while a default that *permits* is indistinguishable at every call
 * site from a policy that said yes.
 */

/** `EPIC-030` — transitions. Absent ⇒ refuse. */
export const ROOM_LOOP_ENGINE = Symbol('ROOM_LOOP_ENGINE');

/** `EPIC-031` — decision authority, the `BR-0005` record. Absent ⇒ refuse. */
export const ROOM_POLICY_PROVIDER = Symbol('ROOM_POLICY_PROVIDER');

/** `EPIC-032` — the Evidence Contract a baseline completes against. Absent ⇒ refuse. */
export const ROOM_EVIDENCE_CONTRACT_SOURCE = Symbol('ROOM_EVIDENCE_CONTRACT_SOURCE');

/**
 * `EPIC-007` — the requirement register. Absent ⇒ refuse, and **never
 * substituted by a local store** (`FR-RQR-002`, `D-33`).
 *
 * This is the boundary this Epic is most likely to cross, because a local cache
 * of requirement text would feel convenient every single day.
 */
export const ROOM_REQUIREMENT_REGISTER = Symbol('ROOM_REQUIREMENT_REGISTER');

/** `EPIC-028`, capability `analyze`. Absent ⇒ **degrade** — the one exception (`RULE-03`). */
export const ROOM_AGENT_GATEWAY = Symbol('ROOM_AGENT_GATEWAY');

/** Where this Room's own candidates, clarifications, decisions and baselines live. */
export const REQUIREMENT_ROOM_STORE = Symbol('REQUIREMENT_ROOM_STORE');
