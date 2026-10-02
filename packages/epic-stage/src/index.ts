/**
 * `@pmi/epic-stage` — the ONE stage derivation (EPIC-044, `R-06`, `FR-EPB-010`).
 *
 * This repository's governance register (`tests/governance/epic-stage/`) and the
 * product's Spec Journey Board (`backend/src/modules/epics/`) both import this
 * package, so they cannot disagree about what a stage means. The package holds
 * the configuration document, the contiguity rule, readiness, and two evidence
 * adapters — one over a `specs/` tree, one over execution records. It imports
 * nothing but `node:` modules (`FR-EPB-014`).
 */
export * from './config.js';
export * from './derive.js';
export * from './readiness.js';
export * from './evidence-files.js';
export * from './evidence-executions.js';
