/**
 * `T857a` — the evidence module's injection tokens.
 *
 * The three ports of `@pmi/evidence-contract` each get a token, and each is
 * allowed to resolve to `null`: an absent port is a declared state with a
 * declared behaviour — refuse — not a missing provider that crashes the graph.
 */
export const EVIDENCE_REPOSITORY = Symbol('EVIDENCE_REPOSITORY');
export const EVIDENCE_CATALOG = Symbol('EVIDENCE_CATALOG');
/** `EvidenceStorage` — `EPIC-025`. Null ⇒ every reference is unresolvable. */
export const EVIDENCE_STORAGE = Symbol('EVIDENCE_STORAGE');
/** `AccessPolicy` — `EPIC-024`. Null ⇒ every read is refused. */
export const EVIDENCE_ACCESS_POLICY = Symbol('EVIDENCE_ACCESS_POLICY');
/** `AttestationSource` — `EPIC-013` / `U-13`. Null ⇒ every external contribution is refused. */
export const EVIDENCE_ATTESTATION_SOURCE = Symbol('EVIDENCE_ATTESTATION_SOURCE');
