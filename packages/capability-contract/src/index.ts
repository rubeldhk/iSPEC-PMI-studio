/**
 * `@pmi/capability-contract` (EPIC-039, `R-039-2`) — what a platform caller and
 * a capability adapter must agree on, and nothing else: no Nest, no Prisma, no
 * provider name. The backend module and every adapter package depend on it; it
 * depends on nothing in the repository.
 */
export * from './vocabulary.js';
export * from './schema.js';
export * from './contract.js';
export * from './capabilities.js';
export * from './fact.js';
export * from './health.js';
export * from './errors.js';
export * from './adapter.js';
export * from './eligibility.js';
export * from './redaction.js';
export * from './ports.js';
