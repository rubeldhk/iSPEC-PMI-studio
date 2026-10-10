/**
 * `@pmi/capability-adapter-fixture` (EPIC-039) — complete, scriptable fixture
 * providers for the v1 capabilities (`R-039-9`).
 */
export { FixtureAdapter, FIXTURE_BINDING_SCHEMA, FIXTURE_VERSION, commitFor, type FixtureScript, type InvokeScript } from './shared.js';
export { FixtureGitAdapter } from './git.fixture.js';
export { FixtureCiAdapter } from './ci.fixture.js';
