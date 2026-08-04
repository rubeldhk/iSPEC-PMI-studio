/**
 * Spec Kit adapter — package scaffold (T006).
 *
 * The adapter itself is built by **EPIC-003** (F-08.6 sandbox, F-08.7 invocation):
 * per research R-001, `specify` only scaffolds a workspace; the `/speckit-*`
 * commands are prompt templates executed by an AI coding agent. Generation
 * therefore means orchestrating a container, not calling an API.
 *
 * What EPIC-001 delivers here is the correlation boundary (T162), because
 * threading a correlation id across a locked-down sandbox is far cheaper to
 * design in than to retrofit (PC-3).
 */
export { buildSandboxEnvironment, SANDBOX_CORRELATION_ENV } from './correlation.js';
