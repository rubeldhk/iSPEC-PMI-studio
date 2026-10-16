/** EPIC-039 — the composed Integration Hub, as one injection token (its own file, so controllers avoid a cycle). */
export const HUB = Symbol('INTEGRATION_HUB');

/**
 * EPIC-039 `T2215` — `EPIC-032`'s `AttestationSource`, filled by the Hub's
 * registry. Exported by `IntegrationsModule`; `EvidenceModule` binds
 * `EVIDENCE_ATTESTATION_SOURCE` to it (`R-039-11`).
 */
export const INTEGRATIONS_ATTESTATION_SOURCE = Symbol('INTEGRATIONS_ATTESTATION_SOURCE');

/**
 * EPIC-039 `T2218` — `EPIC-038`'s `EmbeddingPort`, filled by the Hub's
 * `HubEmbeddingPort` (`R-039-18`). Exported by `IntegrationsModule`;
 * `ContextModule` binds `EMBEDDING_PORT` to it, so the context module names a
 * token here and never the Hub's internals (`T2152` rule 3, `T2219`).
 */
export const INTEGRATIONS_EMBEDDING_PORT = Symbol('INTEGRATIONS_EMBEDDING_PORT');
