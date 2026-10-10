/**
 * EPIC-039 `T2166` (`R-039-5`) — the `pmi-studio` server's tool names and
 * version as plain data.
 *
 * The Integration Hub's registry lists this server as its first inbound entry
 * and reads its facts from here rather than keeping a copy that could drift.
 * Plain data on purpose: importing it loads neither the MCP SDK nor `zod`, and
 * `tests/tool-names.spec.ts` asserts it equals what the server registers.
 */
import { readFileSync } from 'node:fs';

export const TOOL_NAMES: readonly string[] = Object.freeze([
  'pmi.artifacts.sync',
  'pmi.constitution.get',
  'pmi.execution.appendEvent',
  'pmi.execution.comment',
  'pmi.execution.complete',
  'pmi.execution.history',
  'pmi.execution.proposeStatus',
  'pmi.execution.register',
  'pmi.execution.sync',
  'pmi.health',
  'pmi.project.context',
  'pmi.project.decompose',
  'pmi.requirements.list',
  'pmi.tasks.sync',
]);

/** The manifest's version, read once — never a literal repeated here (`T1470`). */
export const MCP_SERVER_VERSION: string = ((): string => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
  return manifest.version ?? '0.0.0';
})();
