/**
 * T935 — injection tokens for the seams the loop declares and does not fill.
 *
 * `@Inject(Token)` everywhere, explicitly. `emitDecoratorMetadata` is
 * deliberately absent from `tsconfig.base.json` (`D-40`) because nothing here is
 * compiled by `tsc` — the API runs through `tsx` and esbuild emits no
 * `design:paramtypes` — so implicit injection asserted something the runtime
 * contradicted, which is how `DEF-001-005` got seven undefined dependencies past
 * 1000+ green tests.
 *
 * **Every one of these is optional at the container and refused at use**, which
 * is the shape `FR-GEL-062` asks for. Making them required at the container
 * would stop the application booting; defaulting them to a permissive no-op
 * would install the `ADR-0025` failure mode at the foundation. So an absent
 * provider resolves to `undefined` here and produces a **refusal with a named
 * reason** the first time a transition needs it — which is a fact the caller can
 * read, and a record `FR-GEL-014` keeps.
 */

/** `EPIC-031` — the Decide seam. Absent ⇒ refuse (`FR-GEL-062`). */
export const LOOP_POLICY_PROVIDER = Symbol('LOOP_POLICY_PROVIDER');

/** `EPIC-032` — the Evidence seam. Absent ⇒ the Evidence stage cannot be configured in. */
export const LOOP_EVIDENCE_PROVIDER = Symbol('LOOP_EVIDENCE_PROVIDER');

/** `EPIC-021` — gate evaluation. Absent ⇒ a transition requiring a gate refuses. */
export const LOOP_GATE_PROVIDER = Symbol('LOOP_GATE_PROVIDER');

/** `EPIC-004` — the audit sink, whose `tx` is not optional (`FR-GEL-041`). */
export const LOOP_AUDIT_SINK = Symbol('LOOP_AUDIT_SINK');

/**
 * The registered `StageHandler`s, keyed by stage.
 *
 * `FR-GEL-007` / `R-030-5` — a configuration naming a stage with no handler
 * fails to load. There is no no-op default anywhere in this module: a no-op
 * `Decide` handler is an auto-approval wearing a placeholder's name.
 */
export const LOOP_STAGE_HANDLERS = Symbol('LOOP_STAGE_HANDLERS');

/** Where loop objects and transitions are read and appended. */
export const LOOP_STORE = Symbol('LOOP_STORE');

/** Where instance configurations are read. */
export const LOOP_CONFIG_SOURCE = Symbol('LOOP_CONFIG_SOURCE');
